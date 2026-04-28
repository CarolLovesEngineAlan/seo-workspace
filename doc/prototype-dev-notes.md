# MVP Prototype Dev Notes

## 目标

这个原型不是视觉稿，而是前端可开工的页面说明版。

目标是让团队对以下内容快速达成一致：

- 页面主结构
- 数据单位
- 核心组件拆分
- 假接口形状
- 最小状态流

## 页面结构

### 1. Opportunity Inbox

用途：

- 展示按 `same_page_group_id` 聚合后的页面机会
- 支持选中单个机会进入右侧生产面板

建议组件：

- `OpportunityList`
- `OpportunityCard`

每张卡片最少展示：

- `mainKeyword`
- `groupId`
- `topicClusterName`
- `intent`
- `contentType`
- `internalLinkRole`
- `volume`
- `kd`
- `readiness`
- `score`

## 2. Strategy Queue

用途：

- 展示按分数排序后的本周任务
- 强调 `whyNow`

建议组件：

- `StrategyQueue`
- `StrategyItem`

每项最少展示：

- 排名
- `mainKeyword`
- `intent`
- `contentType`
- `whyNow`

## 3. Production Panel

用途：

- 显示当前选中机会的生产上下文
- 生成和编辑 `brief_v2`
- 生成和编辑 `article_draft`
- 展示 `qaResult`

建议组件：

- `ProductionPanel`
- `BriefEditor`
- `DraftEditor`
- `QaBox`

## 数据模型

### PageOpportunity

```ts
type PageOpportunity = {
  groupId: string;
  mainKeyword: string;
  allKeywords: string;
  topicClusterName: string;
  intent: string;
  contentType: string;
  volume: number;
  kd: number;
  internalLinkRole: string;
  pageBrief: string;
};
```

### StrategyTask

```ts
type StrategyTask = {
  groupId: string;
  score: number;
  priorityBand: "high" | "medium" | "low";
  whyNow: string;
  recommendation: string;
};
```

### ProductionAsset

```ts
type ProductionAsset = {
  briefV2: string;
  articleDraft: string;
  qa: {
    passed: boolean;
    issues: string[];
  };
};
```

## Config 加载

评分权重和 QA 阈值不写死在前端代码里，由后端读取三层 config 后合并返回：

```
config/scoring-engine.json        (通用函数)
  + config/presets/[preset].json  (阶段 × 类型权重 + QA 阈值)
  + config/projects/[name].json   (项目覆盖 + QA 意图词)
= 合并后的 resolved config
```

前端通过 `/api/config` 拿到已合并好的对象，**不需要自己读三个文件**。

ResolvedConfig 结构：

```ts
type ResolvedConfig = {
  project: string;
  preset: string;
  weights: Record<string, number>;
  intentScores: Record<string, number>;
  contentTypeScores: Record<string, number>;
  internalLinkRoleScores: Record<string, number>;
  qaThresholds: {
    keywordCoverageMin: number;
    minWordCount: number;
    minInternalLinks: number;
  };
  qaIntentKeywords: {
    commercialTransactional: string[];
    informational: string[];
  };
};
```

`QaBox` 组件和 scoring 逻辑读 `ResolvedConfig`，不 hardcode 任何阈值数字。

## 假接口

```ts
GET /api/config
GET /api/opportunities
GET /api/strategy
POST /api/brief
POST /api/draft
POST /api/export
```

建议返回结构：

- `GET /api/config` -> `ResolvedConfig`
- `GET /api/opportunities` -> `PageOpportunity[]`
- `GET /api/strategy` -> `StrategyTask[]`
- `POST /api/brief` -> `{ briefV2: string }`
- `POST /api/draft` -> `{ articleDraft: string, qa: { passed: boolean, issues: string[] } }`
- `POST /api/export` -> `{ ok: boolean, format: "markdown" }`

## 最小状态流

```text
idle
-> brief_ready
-> draft_ready
-> qa_pass | qa_fail
-> exported
```

## 第一版边界

- 不做登录
- 不做多用户
- 不做 Notion 写回
- 不做 CMS 发布
- 不做真实自动化调度

## 开发建议

- 前端先用 `prototype.html` 里的假数据搭组件
- 数据获取先做本地 mock
- API 先返回静态 JSON
- 等 UI 和状态流稳定后再接真实 Notion 数据
