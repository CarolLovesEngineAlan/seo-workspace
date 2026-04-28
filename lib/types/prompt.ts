export type DocPromptRecord = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  fileName: string;
};

export type CustomPromptRecord = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  createdAt: string;
};

export type PromptLibrary = {
  docPrompts: DocPromptRecord[];
  customPrompts: CustomPromptRecord[];
};

export type PromptDetail = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  source: "doc" | "custom";
  fileName?: string;
};
