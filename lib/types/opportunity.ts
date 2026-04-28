export type OpportunityKeywordRow = {
  notionPageId: string;
  keyword: string;
  mainKeyword: string;
  keywordVariants: string;
  volume: number;
  contentType: string;
  contentTypeLlm: string;
  intent: string;
  priority: string;
  kd: number;
  url: string;
};

export type BriefGenerationRecord = {
  id: string;
  groupId: string;
  selectedRowIds: string[];
  inputMainKeywords: string[];
  inputContentTypes: string[];
  inputIntents: string[];
  inputKeywordVariants: string[];
  inputTopicClusterNames: string[];
  inputInternalLinkRoles: string[];
  inputPageBriefs: string[];
  briefMarkdown: string;
  model: string | null;
  createdAt: string;
};

/**
 * 页面机会（Opportunity 层输出），与 arc.md 对齐并补充 MVP 展示字段。
 */
export type PageOpportunity = {
  groupId: string;
  mainKeyword: string;
  allKeywords: string;
  keywordVariants: string;
  topicClusterName: string;
  intent: string;
  resolvedContentType: string;
  contentTypeSource: "content_type" | "content_type_llm" | "needs_review";
  volume: number;
  kd: number;
  variantCount: number;
  internalLinkRole: string;
  pageBrief: string;
  sourceUrls: string[];
  needsReview: boolean;
  opportunityScore: number;
  /** 聚合内的 Notion 页面数 */
  rowCount: number;
  /** 同一个 same_page_group_id 下的源关键词行，用于在工作台展示 group 明细。 */
  sourceKeywordRows?: OpportunityKeywordRow[];
};

/** 策略队列 / 生产流（Supabase 持久化） */
export type PipelineStatus =
  | "inbox"
  | "in_queue"
  | "in_production"
  | "shipped";

export type ProductionStage = "none" | "brief" | "draft" | "qa" | "done";
export type WorkflowStatus =
  | "pending"
  | "brief_done"
  | "draft_done"
  | "ready_to_upload"
  | "published";

export type WorkbenchOpportunity = PageOpportunity & {
  pipelineStatus: PipelineStatus;
  productionStage: ProductionStage;
  briefMarkdown: string | null;
  articleDraftMarkdown: string | null;
  whyNow: string | null;
  syncedAt: string | null;
};

export type NotionKeywordRow = {
  notionPageId: string;
  samePageGroupId: string | null;
  mainKeyword: string;
  keyword: string;
  keywordVariants: string;
  allKeywords: string;
  pageBrief: string;
  topicClusterName: string;
  volume: number;
  kd: number;
  variantCount: number;
  contentType: string;
  contentTypeLlm: string;
  intent: string;
  priority: string;
  internalLinkRole: string;
  url: string;
};
