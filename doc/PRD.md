# SEO Opportunity Workspace PRD

## 1. 项目目标

在 2 天内做出一个可运行的 SEO 自动化 MVP，验证以下闭环：

`关键词库 -> 机会识别 -> 策略排序 -> Brief 生成 -> 文章初稿 -> QA -> 导出`

本版本不解决完整的 SEO 平台化问题，只验证信息层、策略层、生产层能否稳定协同。

## 2. 目标用户

- SEO 运营
- 内容营销人员
- 与 SEO 协作的前端或增长团队成员

## 3. 背景

> 本节描述当前部署在 Pexo 的具体实例。数据库 ID 在 `config/projects/pexo.json` 中定义；其他项目接入时替换项目 config 即可，无需改动产品逻辑。

现有数据层已经完成自动化，Notion 数据库（ID 见 `config/projects/pexo.json`）已沉淀出较成熟的关键词库，包含：

- 关键词及变体
- 搜索量和难度
- 意图分类
- 页面类型分类
- 页面分组
- 内链角色
- 初始页面 brief

当前缺口不在关键词获取，而在于如何将关键词库转化为：

- 可执行的页面机会
- 可排序的本周任务
- 可直接进入内容生产的 brief 和文章初稿

## 4. 核心问题

当前关键词库已经有较多结构化字段，但缺少一个统一工作台来完成以下动作：

- 按页面而不是按单词组织机会
- 从大量关键词中筛出本周最值得做的内容
- 将筛选结果快速变成 brief 和文章初稿

## 5. 产品定位

本产品是一个 `Keyword Opportunity Workspace`，而不是全功能 SEO 平台。

它完成三件事：

1. 将关键词库聚合成页面机会
2. 为页面机会生成优先级和行动建议
3. 将机会推进为 brief 和文章初稿

## 6. MVP 范围

### In Scope

- 从现有 Notion 关键词库读取数据
- 基于 `same_page_group_id` 聚合页面机会
- 展示每个页面机会的核心属性
- 计算机会优先级分数
- 生成本周建议任务列表
- 对单个任务生成 `brief_v2`
- 对单个任务生成 `article_draft`
- 对文章执行基础 QA
- 导出 Markdown
- 使用独立状态层保存 production run 状态
- 为 `needs_review` 机会提供单独待处理队列

### Out of Scope

- 新的关键词采集系统
- 多用户和权限系统
- 复杂的竞品监控系统
- 自动 CMS 发布闭环
- 自动内链插入系统
- 多模型调度和复杂工作流编排
- n8n 作为主流程编排器
- Claude skill 作为主运行环境

## 6.1 系统执行决策

第一版 MVP 的执行环境正式定义为：

- 前端形态：Web app 单工作台
- 数据源：Notion 只读关键词库
- 运行逻辑：应用内 API / 本地服务函数
- 状态层：SQLite
- 输出：Markdown 导出，可选后续写回 Notion

这版不采用：

- n8n 作为主执行环境
- 本地脚本作为主交互方式
- Claude skill 作为生产流程 runtime

## 7. 核心对象

### 7.1 PageOpportunity

页面机会是第一版的核心生产对象，按 `same_page_group_id` 聚合。

关键字段：

- `same_page_group_id`
- `main_keyword`
- `all_keywords`
- `keyword_variants`
- `intent`
- `content_type`
- `topic_cluster_name`
- `volume`
- `kd`
- `internal_link_role`
- `page_brief`

### 7.2 StrategyTask

策略层输出的任务对象。

关键字段：

- `opportunity_score`
- `priority_band`
- `why_now`
- `recommended_action`
- `planned_week`

### 7.3 ProductionAsset

生产层输出对象。

关键字段：

- `brief_v2`
- `article_draft`
- `qa_result`
- `export_status`

## 7.4 字段确认与职责

MVP 以现有 Notion 字段为准，不新增必须字段。重点是统一字段职责，避免同一字段在不同层被重复解释。

### 主展示字段

这些字段应直接出现在机会列表或详情页：

- `main_keyword`：页面机会主标题词
- `topic_cluster_name`：主题簇名称
- `volume`：流量潜力
- `kd`：竞争难度
- `intent`：搜索意图
- `content_type`：人工确认后的页面类型
- `internal_link_role`：页面在站内结构中的角色

### 聚合与去重字段

这些字段决定系统按“页面”而不是按“词”工作：

- `same_page_group_id`：页面聚合主键
- `url`：唯一标识与后续落地页关联
- `variant_count`：覆盖变体数，作为补充价值信号

### 生产输入字段

这些字段主要服务 brief 和文章生成：

- `all_keywords`
- `keyword_variants`
- `page_brief`
- `keyword`

### 辅助决策字段

这些字段保留，但不能直接替代策略层判断：

- `content_type_llm`：当 `content_type` 缺失或待分类时兜底
- `priority`：仅作参考，不作为最终唯一排序依据
- `createdTime`：仅作追踪与增量同步参考

## 8. 用户故事

### 8.1 作为 SEO

我希望从关键词库中快速看到哪些词应该归并成一个页面，以便避免重复生产。

### 8.2 作为 SEO

我希望系统告诉我本周最值得做的页面机会，并给出原因，以便快速排优先级。

### 8.3 作为 SEO

我希望点击一个机会就能生成 brief 和文章初稿，以便减少从分析到生产的时间。

### 8.4 作为 SEO

我希望在导出前看到基础 QA 结果，以便降低低质量内容进入发布流程的风险。

## 9. 功能需求

### 9.1 机会层

- 支持从 Notion 拉取关键词数据
- 按 `same_page_group_id` 聚合记录
- 生成页面机会卡片或表格行
- 当 `content_type` 为空时，回退使用 `content_type_llm`
- 列表最少展示：
  - `main_keyword`
  - `same_page_group_id`
  - `topic_cluster_name`
  - `intent`
  - `content_type`
  - `internal_link_role`
  - `volume`
  - `kd`
  - `variant_count`
  - `opportunity_score`

### 9.2 策略层

- 根据现有字段计算 `opportunity_score`
- 输出优先级区间：高 / 中 / 低
- 输出一条可读理由 `why_now`
- 生成 Top N 本周建议任务
- 权重必须来自外部配置文件，不允许写死在业务逻辑中
- 策略层核心输入字段：
  - `volume`
  - `kd`
  - `intent`
  - `content_type`
  - `internal_link_role`
  - `variant_count`
  - `page_brief`
- 策略层参考字段：
  - `priority`
  - `topic_cluster_name`

### 9.3 生产层

- 读取机会层字段作为生产输入
- 生成 `brief_v2`
- 生成 `article_draft`
- 执行基础 QA 检查
- 支持 Markdown 导出
- 状态流必须持久化：
  - `idle`
  - `brief_ready`
  - `draft_ready`
  - `qa_pass`
  - `qa_fail`
  - `exported`
- 生产层核心输入字段：
  - `main_keyword`
  - `all_keywords`
  - `keyword_variants`
  - `intent`
  - `content_type`
  - `internal_link_role`
  - `topic_cluster_name`
  - `page_brief`

## 10. 验收标准

### 10.1 机会层完成标准

- 能从关键词库中成功读取样本数据
- 能按 `same_page_group_id` 生成页面机会
- 每个页面机会至少展示：
  - 主关键词
  - 页面类型
  - 搜索意图
  - 搜索量
  - 关键词难度
  - 页面组 ID
  - 内链角色

### 10.2 策略层完成标准

- 系统可稳定生成 `opportunity_score`
- 系统可输出 Top 5 本周任务
- 每个任务都附带 `why_now`
- 评分配置可通过独立 config 文件调整

### 10.3 生产层完成标准

- 可对单个机会生成 `brief_v2`
- 可从 `brief_v2` 生成一篇文章初稿
- QA 输出至少包含是否通过及失败原因
- 可导出 Markdown 文件
- 状态变更可持久化到状态层
- `needs_review` 项不会误入自动生产流程

### 10.4 QA 完成标准

第一版 QA 必须至少包含以下可判定规则：

- `main_keyword` 出现在 H1
- `all_keywords` 中至少 60% 出现在正文
- 首段与 `intent` 匹配
- 正文字数达到最低阈值
- 至少包含 1 个内部链接占位

## 11. 非功能需求

- 界面优先服务内部使用，不追求完整设计系统
- 结果需要可解释，避免黑盒排序
- 输入输出结构应稳定，便于后续接入 CMS 或调度系统
- 默认仅处理英文 SEO 内容场景
- 主工作台 UI 以 Pipeline 视角为准，不并行开发第二套主流程 UI
- 字段优先级规则必须稳定：
  - `same_page_group_id` 是第一版唯一页面聚合主键
  - `content_type` 优先于 `content_type_llm`
  - `priority` 仅作参考，不直接决定最终排序

## 12. 成功指标

MVP 的成功标准不是流量结果，而是流程验证：

- 能从现有关键词库中自动得出页面级机会
- 能筛出本周任务单
- 能稳定生成 1 篇可读的文章初稿
- 从机会识别到导出 Markdown 的链路可在一次演示中跑通
