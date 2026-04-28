import { buildArticleDraftMarkdown } from "@/lib/production/article-draft";
import { buildBriefV2Markdown } from "@/lib/production/brief-v2";
import { buildWhyNowText } from "@/lib/production/why-now";
import { attachScores } from "@/lib/scoring/opportunity-score";
import type { PageOpportunity, WorkbenchOpportunity } from "@/lib/types/opportunity";

const baseFallbackOpportunities = attachScores([
  {
    groupId: "seo-automation-workflow",
    mainKeyword: "seo automation workflow",
    allKeywords:
      "seo automation workflow | automated seo pipeline | seo ops workflow | content ops automation",
    keywordVariants:
      "seo automation process | automated content workflow | growth content pipeline",
    topicClusterName: "SEO automation",
    intent: "commercial investigation",
    resolvedContentType: "feature",
    contentTypeSource: "content_type",
    volume: 1280,
    kd: 26,
    variantCount: 9,
    internalLinkRole: "pillar",
    pageBrief:
      "面向增长与内容负责人，说明如何把关键词聚合、排序、Brief 生成和 QA 串成一条可复用流水线，降低 SEO 执行与协作成本。",
    sourceUrls: ["https://www.pexo.ai/seo-automation-workflow"],
    needsReview: false,
    opportunityScore: 0,
    rowCount: 4,
  },
  {
    groupId: "programmatic-seo-playbook",
    mainKeyword: "programmatic seo playbook",
    allKeywords:
      "programmatic seo playbook | programmatic seo strategy | programmatic seo for saas",
    keywordVariants:
      "programmatic seo examples | programmatic landing page workflow | pseo operations",
    topicClusterName: "Programmatic SEO",
    intent: "commercial investigation",
    resolvedContentType: "guide",
    contentTypeSource: "content_type",
    volume: 960,
    kd: 31,
    variantCount: 7,
    internalLinkRole: "supporting",
    pageBrief:
      "强调从关键词模板、字段定义到页面生成规则的完整方法论，帮助团队理解 programmatic SEO 的实施路径。",
    sourceUrls: ["https://www.pexo.ai/programmatic-seo-playbook"],
    needsReview: false,
    opportunityScore: 0,
    rowCount: 3,
  },
  {
    groupId: "ai-brief-generator",
    mainKeyword: "ai content brief generator",
    allKeywords:
      "ai content brief generator | seo brief generator | ai brief workflow",
    keywordVariants:
      "content brief automation | seo brief template generator | ai content planning",
    topicClusterName: "AI SEO workflow",
    intent: "transactional",
    resolvedContentType: "feature",
    contentTypeSource: "content_type",
    volume: 860,
    kd: 22,
    variantCount: 6,
    internalLinkRole: "supporting",
    pageBrief:
      "突出自动生成 Brief 的价值，解释输入字段、输出结构和人工 review 节点，适合作为产品功能页。",
    sourceUrls: ["https://www.pexo.ai/ai-content-brief-generator"],
    needsReview: false,
    opportunityScore: 0,
    rowCount: 2,
  },
  {
    groupId: "content-audit-checklist",
    mainKeyword: "seo content audit checklist",
    allKeywords:
      "seo content audit checklist | content qa checklist | seo quality assurance checklist",
    keywordVariants:
      "content audit workflow | on-page qa checklist | pre-publish seo checklist",
    topicClusterName: "Content QA",
    intent: "informational",
    resolvedContentType: "template",
    contentTypeSource: "content_type_llm",
    volume: 720,
    kd: 18,
    variantCount: 5,
    internalLinkRole: "supporting",
    pageBrief:
      "用 checklist 模板承接 ToFu 流量，并把 QA 标准与导出节点放进统一工作台，突出流程标准化。",
    sourceUrls: ["https://www.pexo.ai/seo-content-audit-checklist"],
    needsReview: false,
    opportunityScore: 0,
    rowCount: 2,
  },
  {
    groupId: "topical-authority-map",
    mainKeyword: "topical authority map template",
    allKeywords:
      "topical authority map template | topic cluster map | authority building template",
    keywordVariants:
      "topic cluster planning | authority map spreadsheet | topical map framework",
    topicClusterName: "Topic authority",
    intent: "informational",
    resolvedContentType: "template",
    contentTypeSource: "content_type",
    volume: 540,
    kd: 24,
    variantCount: 4,
    internalLinkRole: "pillar",
    pageBrief:
      "适合做模板型页面，帮助用户从主题簇视角理解内容覆盖范围，并引导进入产品的机会聚合工作流。",
    sourceUrls: ["https://www.pexo.ai/topical-authority-map-template"],
    needsReview: false,
    opportunityScore: 0,
    rowCount: 2,
  },
  {
    groupId: "comparison-page-framework",
    mainKeyword: "comparison page framework",
    allKeywords:
      "comparison page framework | saas comparison page template | alternative page framework",
    keywordVariants:
      "vs page framework | comparison landing page structure | alternatives page template",
    topicClusterName: "Comparison pages",
    intent: "commercial investigation",
    resolvedContentType: "needs_review",
    contentTypeSource: "needs_review",
    volume: 430,
    kd: 44,
    variantCount: 3,
    internalLinkRole: "pillar",
    pageBrief:
      "这一组搜索词具备商业价值，但页面类型与站内定位尚不稳定，应该先进入 needs_review 队列做人工确认。",
    sourceUrls: ["https://www.pexo.ai/comparison-page-framework"],
    needsReview: true,
    opportunityScore: 0,
    rowCount: 1,
  },
] satisfies PageOpportunity[]);

function withWhyNow(opportunity: WorkbenchOpportunity): WorkbenchOpportunity {
  return {
    ...opportunity,
    whyNow: buildWhyNowText(opportunity),
  };
}

function withBrief(opportunity: WorkbenchOpportunity): WorkbenchOpportunity {
  const seeded = opportunity.whyNow ? opportunity : withWhyNow(opportunity);
  return {
    ...seeded,
    briefMarkdown: buildBriefV2Markdown(seeded),
  };
}

function withDraft(opportunity: WorkbenchOpportunity): WorkbenchOpportunity {
  const seeded = opportunity.briefMarkdown ? opportunity : withBrief(opportunity);
  return {
    ...seeded,
    articleDraftMarkdown: buildArticleDraftMarkdown(seeded),
  };
}

export function getFallbackOpportunities(): WorkbenchOpportunity[] {
  return baseFallbackOpportunities.map((opportunity, index) => {
    let seeded: WorkbenchOpportunity = {
      ...opportunity,
      pipelineStatus: "inbox",
      productionStage: "none",
      briefMarkdown: null,
      articleDraftMarkdown: null,
      whyNow: null,
      syncedAt: `2026-03-24T0${(index % 8) + 8}:30:00.000Z`,
    };

    switch (opportunity.groupId) {
      case "seo-automation-workflow":
        seeded = withBrief({
          ...seeded,
          pipelineStatus: "in_queue",
          productionStage: "brief",
        });
        break;
      case "programmatic-seo-playbook":
        seeded = withDraft({
          ...seeded,
          pipelineStatus: "in_production",
          productionStage: "draft",
        });
        break;
      case "ai-brief-generator":
        seeded = withDraft({
          ...seeded,
          pipelineStatus: "shipped",
          productionStage: "done",
        });
        break;
      case "content-audit-checklist":
        seeded = withDraft({
          ...seeded,
          pipelineStatus: "in_production",
          productionStage: "qa",
        });
        break;
      default:
        break;
    }

    return seeded;
  });
}
