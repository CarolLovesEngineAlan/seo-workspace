# Responsibility Map

## 目标

这份文档用来明确每个流程步骤里：

- 原始数据库已经提供了什么
- AI 负责生成什么
- 人必须判断什么

原则：

- 数据库提供事实
- AI 提供建议
- SEO 做最终决策

## 总体分工

| 层级 | 主要职责 |
|---|---|
| 原始数据库 | 提供关键词事实、分类、聚合线索、基础页面信息 |
| AI | 生成 topic 级建议、结构建议、brief 和 draft 初稿 |
| SEO / 人工 | 决定是否值得做、怎么做、哪些进入生产、哪些可发布 |

## 流程拆分

### 1. 读取原始关键词数据库

| 类别 | 内容 |
|---|---|
| 数据库已有 | `main_keyword`, `keyword`, `keyword_variants`, `all_keywords`, `page_brief`, `topic_cluster_name`, `volume`, `kd`, `variant_count`, `same_page_group_id`, `content_type`, `content_type_llm`, `intent`, `priority`, `internal_link_role`, `url`, `createdTime` |
| AI 负责 | 不发明事实；最多做缺失标记、异常标记、轻度归并建议 |
| 人负责 | 确认字段含义、确认字段优先级、确认哪些字段可作为可信输入 |

### 2. 识别 Topic Opportunities

| 类别 | 内容 |
|---|---|
| 数据库已有 | `topic_cluster_name`, `same_page_group_id`, `volume`, `kd`, `intent`, `content_type`, `internal_link_role`, `variant_count`, `priority` |
| AI 负责 | 识别值得推进的 `topic cluster`，生成 `why now`，生成 topic 级候选排序，组织该 topic 下的关键词组 |
| 人负责 | 判断这个 topic 是否值得现在做，判断 Top topics 是否符合业务阶段，筛掉“数据上像机会、业务上不该优先”的 topic |

### 3. 生成 Topic Strategy

| 类别 | 内容 |
|---|---|
| 数据库已有 | `topic_cluster_name`, `same_page_group_id`, `content_type`, `content_type_llm`, `intent`, `internal_link_role`, `all_keywords`, `keyword_variants` |
| AI 负责 | 生成 pillar / support 候选结构，建议每组关键词落到哪个页面，解释为什么这样拆页 |
| 人负责 | 最终确认 pillar / support 是否合理，确认页面拆分是否过度，确认结构是否符合站点阶段 |

### 4. 生成 Page Briefs

| 类别 | 内容 |
|---|---|
| 数据库已有 | `main_keyword`, `all_keywords`, `keyword_variants`, `intent`, `content_type`, `topic_cluster_name`, `internal_link_role`, `page_brief` |
| AI 负责 | 生成 `brief_v2`，组织页面目标、结构、覆盖词、写作角度 |
| 人负责 | 审核 brief 是否对路，确认页面角度是否正确，确认是否可以进入生产 |

### 5. 人工选择进入生产

| 类别 | 内容 |
|---|---|
| 数据库已有 | 只提供参考字段，不提供最终决策 |
| AI 负责 | 推荐哪些页面 ready，解释推荐原因，标记高风险项 |
| 人负责 | 决定哪些页面现在进入生产，哪些暂缓，哪些需要改完再进 |

### 6. 进入 Production

| 类别 | 内容 |
|---|---|
| 数据库已有 | 提供 brief 输入与页面基础信息 |
| AI 负责 | 生成 `article_draft`，执行基础 QA 规则检查，产出修订建议 |
| 人负责 | 判断 draft 是否可用，判断 QA fail 是否合理，决定是否导出或发布 |

## 哪些事最适合交给 AI

- 话题聚合和机会解释
- pillar / support 候选结构建议
- brief 初稿
- article draft 初稿
- 标记 `needs_review`

## 哪些事必须保留给人

- 最终判断 topic 值不值得做
- 最终确认 pillar / support 结构
- 决定哪些页面进入生产
- 决定内容是否可发布

## AI 角色边界

AI 是 `copilot`，不是最终拍板者。

AI 可以：

- 提供候选答案
- 减少机械分析工作
- 加速从 topic 到 brief 的过程

AI 不可以：

- 替 SEO 直接决定最终优先级
- 跳过人工确认进入生产
- 跳过 QA 视为可发布

## 一句话版本

这个产品的责任划分是：

**数据库给事实，AI 给建议，人做最后判断。**
