import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  CustomPromptRecord,
  DocPromptRecord,
  PromptDetail,
  PromptLibrary,
} from "@/lib/types/prompt";

const PROMPT_FILE_EXTENSIONS = new Set([".md", ".txt", ".prompt"]);
const CUSTOM_PROMPTS_FILE = path.resolve(
  process.cwd(),
  "prompts",
  "custom-prompts.json"
);

function buildPromptNameFromFile(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

async function ensureCustomPromptsDir(): Promise<void> {
  await mkdir(path.dirname(CUSTOM_PROMPTS_FILE), { recursive: true });
}

export async function readDocPrompts(): Promise<DocPromptRecord[]> {
  const docDir = path.resolve(process.cwd(), "doc");

  let dirEntries;
  try {
    dirEntries = await readdir(docDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const prompts: DocPromptRecord[] = [];

  const filtered = dirEntries
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name.toLowerCase().includes("prompt"))
    .filter((entry) =>
      PROMPT_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of filtered) {
    const filePath = path.join(docDir, entry.name);
    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const headingIndex = lines.findIndex((line) => line.trim().startsWith("#"));
    const heading = headingIndex >= 0 ? lines[headingIndex].trim() : null;
    const name = heading
      ? heading.replace(/^#+\s*/, "").trim() || buildPromptNameFromFile(entry.name)
      : buildPromptNameFromFile(entry.name);

    let description: string | null = null;
    const startIndex = headingIndex >= 0 ? headingIndex + 1 : 0;
    for (let i = startIndex; i < lines.length; i += 1) {
      const trimmed = lines[i].replace(/^>\s*/, "").trim();
      if (!trimmed) {
        continue;
      }
      if (trimmed.startsWith("#")) {
        continue;
      }
      description = trimmed;
      break;
    }

    prompts.push({
      id: `doc-${entry.name.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      name,
      description,
      content,
      fileName: entry.name,
    });
  }

  return prompts;
}

async function readCustomPrompts(): Promise<CustomPromptRecord[]> {
  try {
    const content = await readFile(CUSTOM_PROMPTS_FILE, "utf8");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : "",
        name: typeof entry.name === "string" ? entry.name : "",
        description:
          typeof entry.description === "string" && entry.description.trim()
            ? entry.description.trim()
            : null,
        content: typeof entry.content === "string" ? entry.content : "",
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
      }))
      .filter(
        (item) =>
          item.id &&
          item.name.trim() &&
          item.content.trim() &&
          item.createdAt.trim()
      );
  } catch {
    return [];
  }
}

async function writeCustomPrompts(prompts: CustomPromptRecord[]): Promise<void> {
  await ensureCustomPromptsDir();
  await writeFile(CUSTOM_PROMPTS_FILE, JSON.stringify(prompts, null, 2), "utf8");
}

export async function readPromptLibrary(): Promise<PromptLibrary> {
  const [docPrompts, customPrompts] = await Promise.all([
    readDocPrompts(),
    readCustomPrompts(),
  ]);
  return {
    docPrompts,
    customPrompts,
  };
}

export async function saveCustomPrompt(input: {
  id?: string;
  name: string;
  description?: string | null;
  content: string;
}): Promise<CustomPromptRecord> {
  const prompts = await readCustomPrompts();
  const cleanedName = input.name.trim();
  const cleanedContent = input.content.trim();
  if (!cleanedName) {
    throw new Error("Prompt 名称不能为空。");
  }
  if (!cleanedContent) {
    throw new Error("Prompt 内容不能为空。");
  }

  const cleanedDescription =
    input.description && input.description.trim()
      ? input.description.trim()
      : null;
  const now = new Date().toISOString();

  const existingIndex = input.id
    ? prompts.findIndex((prompt) => prompt.id === input.id)
    : -1;

  if (existingIndex >= 0) {
    const existing = prompts[existingIndex];
    const updated: CustomPromptRecord = {
      ...existing,
      name: cleanedName,
      description: cleanedDescription,
      content: input.content,
    };
    prompts[existingIndex] = updated;
    await writeCustomPrompts(prompts);
    return updated;
  }

  const newPrompt: CustomPromptRecord = {
    id: `custom-${randomUUID()}`,
    name: cleanedName,
    description: cleanedDescription,
    content: input.content,
    createdAt: now,
  };
  prompts.push(newPrompt);
  await writeCustomPrompts(prompts);
  return newPrompt;
}

export async function findPromptDetailById(
  id: string
): Promise<PromptDetail | null> {
  const { docPrompts, customPrompts } = await readPromptLibrary();
  const docMatch = docPrompts.find((prompt) => prompt.id === id);
  if (docMatch) {
    return {
      id: docMatch.id,
      name: docMatch.name,
      description: docMatch.description,
      content: docMatch.content,
      source: "doc",
      fileName: docMatch.fileName,
    };
  }

  const customMatch = customPrompts.find((prompt) => prompt.id === id);
  if (customMatch) {
    return {
      id: customMatch.id,
      name: customMatch.name,
      description: customMatch.description,
      content: customMatch.content,
      source: "custom",
    };
  }

  return null;
}
