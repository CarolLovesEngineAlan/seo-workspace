/**
 * Run with: node --env-file=.env scripts/seed-model-prompts.mjs
 *
 * 1. Adds model_page prompts (Model Page — Outline / Copy)
 * 2. Updates prompt_text for Feature, Use Case, Model page prompts
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  Prefer: "return=representation",
};

async function query(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function readSeed(filename) {
  return readFileSync(path.join(root, "seeds/prompts", filename), "utf8").trim();
}

// ── 1. Ensure model_page prompts exist ───────────────────────────────────────

const existingModelPrompts = await query(
  "/seo_ps_prompts?page_type=eq.model_page&select=id,name",
  "GET"
);
console.log("Existing model_page prompts:", existingModelPrompts?.length ?? 0);

if (!existingModelPrompts || existingModelPrompts.length === 0) {
  console.log("Inserting Model Page prompts...");
  const inserted = await query("/seo_ps_prompts", "POST", [
    {
      name: "Model Page — Outline",
      page_type: "model_page",
      prompt_step: "A_outline",
      prompt_text: readSeed("model-page-outline.md"),
      recommended_model: "claude_sonnet",
      use_cache: true,
      version: "v1.0",
      required_variables: [
        { name: "primary_keyword", description: "Model name as primary keyword", example: "Seedance 2.0" },
        { name: "keyword_variants", description: "Comma-separated variants", example: "seedance video model, seedance ai" },
        { name: "competitor_notes", description: "Competitor model pages to reference", example: "https://kling.ai/" },
        { name: "notes", description: "Eyebrow tags and special instructions", example: "EYEBROW 1: RESOLUTION / EYEBROW 2: SPEED" },
      ],
    },
    {
      name: "Model Page — Copy",
      page_type: "model_page",
      prompt_step: "B_copy",
      prompt_text: readSeed("model-page-copy.md"),
      recommended_model: "claude_opus",
      use_cache: true,
      version: "v1.0",
      required_variables: [
        { name: "outline", description: "Full outline from Prompt A", example: "(paste outline)" },
      ],
    },
  ]);
  console.log("✓ Inserted:", inserted?.map((p) => p.name).join(", "));
} else {
  console.log("Model Page prompts already exist — updating prompt_text...");
  for (const p of existingModelPrompts) {
    const seedFile = p.name.includes("Outline") ? "model-page-outline.md" : "model-page-copy.md";
    await query(`/seo_ps_prompts?id=eq.${p.id}`, "PATCH", {
      prompt_text: readSeed(seedFile),
      updated_at: new Date().toISOString(),
    });
    console.log("✓ Updated:", p.name);
  }
}

// ── 2. Update prompt_text for Feature Page prompts ───────────────────────────

const featurePrompts = await query(
  "/seo_ps_prompts?page_type=eq.feature_page&select=id,name,prompt_step",
  "GET"
);
for (const p of featurePrompts ?? []) {
  const seedFile = p.prompt_step === "A_outline" ? "feature-page-outline.md" : "feature-page-copy.md";
  await query(`/seo_ps_prompts?id=eq.${p.id}`, "PATCH", {
    prompt_text: readSeed(seedFile),
    updated_at: new Date().toISOString(),
  });
  console.log("✓ Updated:", p.name);
}

// ── 3. Update prompt_text for Use Case Page prompts ──────────────────────────

const useCasePrompts = await query(
  "/seo_ps_prompts?page_type=eq.use_case_page&select=id,name,prompt_step",
  "GET"
);
for (const p of useCasePrompts ?? []) {
  const seedFile = p.prompt_step === "A_outline" ? "use-case-page-outline.md" : "use-case-page-copy.md";
  await query(`/seo_ps_prompts?id=eq.${p.id}`, "PATCH", {
    prompt_text: readSeed(seedFile),
    updated_at: new Date().toISOString(),
  });
  console.log("✓ Updated:", p.name);
}

console.log("\n✅ Done. Refresh the Prompt Library page to verify.");
