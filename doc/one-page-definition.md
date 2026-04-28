# One Page Definition

## 这是什么

这是一个 `topic-driven SEO planning workspace`。

它的目标不是从零找关键词，也不是直接替 SEO 写文章，而是从现有原始关键词数据库中识别最值得推进的 `topic cluster`，再把这些 topic 转成结构化的内容计划和可进入生产的页面任务。

## 它不是什么

它不是：

- 关键词采集工具
- 单纯的 AI 写作工具
- 全自动 SEO agent
- 自动替 SEO 做最终决策的平台

## 它解决的核心问题

现在原始关键词数据库里有很多词，但 SEO 真正要判断的是：

- 哪些 `topic cluster` 值得现在做
- 这些 topic 里面谁应该是 `pillar page`
- 谁应该是 `supporting page`
- 每组关键词适合落到哪个页面
- 哪些页面现在要进入生产

这个平台要解决的，就是从“原始关键词数据”到“结构化内容计划”之间的那段判断成本。

## 核心工作流

### 1. 读取原始关键词数据库

系统从 Notion 关键词库读取原始记录。

### 2. 识别 Topic Opportunities

系统先按 `topic cluster` 组织和排序，而不是直接按单关键词排序。

输出：

- 值得做的 `topic cluster`
- `topic score`
- `why now`
- 该 topic 下的关键词组

### 3. 生成 Topic Strategy

系统针对每个 topic 给出结构化内容策略。

输出：

- 哪个页面是 `pillar`
- 哪些页面是 `support`
- 每组关键词适合落到哪个页面
- 为什么这样组织

### 4. 生成 Page Briefs

系统为 topic 下的每个候选页面生成页面级 brief。

输出：

- `page type`
- `main keyword`
- `supporting keywords`
- `intent`
- `page goal`
- `outline`
- `role in cluster`

### 5. SEO 人工选择进入生产

系统不自动决定全部内容进入生产。

SEO 负责判断：

- 哪些页面现在进入生产
- 哪些暂缓
- 哪些需要人工修正

### 6. 进入 Production

被选中的页面才进入：

- `brief_v2`
- `article_draft`
- `QA`
- `Markdown export`

## 这次 MVP 只做什么

这次 MVP 只验证下面这个闭环：

`Raw Keyword DB -> Topic Opportunity -> Topic Strategy -> Page Brief -> Human Selection -> Production`

重点是验证：

- topic 级别的机会识别是否合理
- pillar / support 结构是否有帮助
- 页面级 brief 是否能支持生产
- SEO 是否愿意使用这个工作流做判断

## 这次 MVP 不做什么

- 不做新的关键词采集系统
- 不做多用户协作
- 不做自动 CMS 发布
- 不做复杂竞品监控
- 不做 AI 直接替 SEO 拍板

## AI 在这个产品里的角色

AI 是 `copilot`，不是最终决策者。

AI 可以：

- 识别 topic opportunities
- 给出初始排序
- 生成 `why now`
- 生成 pillar / support 建议
- 生成 page briefs
- 生成内容草稿

AI 不可以：

- 直接决定最终做什么
- 绕过人工确认进入生产
- 绕过 QA 直接视为可发布

## SEO 在这个产品里的角色

SEO 不是被替代者，而是最终判断者。

SEO 负责：

- 判断 topic 值不值得做
- 判断 pillar / support 结构是否合理
- 决定哪些页面进入生产
- 最终判断输出是否能发布

## 成功标准

如果这版 MVP 成功，你会看到：

- 系统先推给你“值得做的话题”，而不是一堆散关键词
- 你能快速看懂一个 topic 的内容结构
- 你能明确看到 pillar 和 support 的关系
- 你可以很自然地勾选哪些页面进入生产
- 这个过程让你更快做判断，而不是替你做判断
