# Brief Spec by Content Type

> 这是 brief 规范源文件，给人阅读和维护。
> 它定义不同 `content_type` 下页面应该怎么写。
> 如果后续 prompt 与本文件冲突，以本文件为准。

## 目标

这份文档定义不同 `content_type` 下，页面 brief 应该怎么写。

用途：

- 给 SEO 自己对齐页面结构
- 作为 brief 规则源头
- 给 prompt routing 提供判断依据

## 通用规则

无论什么页面类型，都必须满足：

### 字段边界规则

本文件只使用当前原数据库中已存在或你已明确确认的字段概念：

- `main_keyword`
- `keyword_variants`
- `content_type`
- `intent`
- `topic_cluster_name`
- `internal_link_role`
- `page_brief`

其中：

- 主关键词只使用 `main_keyword`
- 其他关键词统一使用 `keyword_variants`
- 页面在 topic 结构中的角色统一使用 `internal_link_role`
  - `pillar-page`
  - `supporting-page`

不再使用以下未确认原始字段作为默认输入：

- `secondary_keywords`
- `other_keywords`
- `pillar_page`
- `supporting_pages`
- `page_goal`
- `brand_name`

### 关键词规则

- 主关键词必须出现在：
  - `URL slug`
  - `Title tag`
  - `Meta description`
  - `H1`
- 其他关键词（`keyword_variants`）必须优先分布在：
  - `H2`
  - `H3`
- 同时允许一部分 `keyword_variants` 自然分布在：
  - 正文段落
  - FAQ

### 输出规则

每个 brief 至少要包含：

- `URL slug`
- `Title tag`
- `Meta description`
- `H1`
- 页面定位
- 目标用户
- 搜索意图
- 页面主角度
- H2 / H3 结构
- 目标字数
- FAQ 问题（标注是否使用 FAQPage schema）
- Internal links（含推荐锚文本）
- CTA 建议
- Writer notes

### 写法规则

- 不做关键词堆砌
- 不写空泛的行业趋势开场
- 不偏离当前 `intent`
- 不偏离当前 `content_type`

### E-E-A-T 信号规则

Google 的质量评估框架要求页面展示 Experience、Expertise、Authoritativeness、Trust。
Brief 必须在 Writer notes 中明确以下至少两项：

- **Experience**：是否需要真实使用截图、操作录屏、输出示例
- **Expertise**：是否需要引用具体数据、行业术语准确度要求
- **Authority**：是否需要链接权威来源（官方文档、第三方评测）
- **Trust**：是否需要明确产品局限性、避免夸大宣传

> 特别提示：Model Page 和 Feature Page 的 E-E-A-T 要求最高，Blog Page 需要 Experience 示例。

### 关键词蚕食防控规则

同一 topic cluster 内的页面，brief 必须在 Page positioning 中写清楚：

- 本页面与最近似页面的**差异化角度**是什么
- 如果两个页面的 main_keyword 高度重合，需在 brief 生成前升级其中一个或合并

不允许在同一 cluster 内生成两份 main_keyword 相似度超过 80% 的 brief。

### SERP 参照规则

Brief 生成前，应先看当前 main_keyword 的 SERP 前 5 结果：

- 确认当前排名页面的 content_type（不要重复已被满足的角度）
- 识别 Featured Snippet 格式（有则在 brief 中标注如何争取）
- 找到内容空白（竞品没覆盖但用户在问的问题）

---

## 1. Feature Page

### 适用场景

当页面的核心是 Pexo agent **能做的某件具体的事**时使用。

这类页面对应的是 agent 的操作型能力，典型例子：
- URL to video
- URL to image
- Remove watermark
- Image to video
- Text to video
- Extend video

关键词形态通常是：`[操作] + [对象/工具词]`，例如 “url to video”, “remove watermark from video online”, “convert image to video AI”

### 页面目标

- 让用户认识到 Pexo 能完成这件事
- 让用户相信 Pexo 的输出质量和操作简单性
- 降低动手门槛，推动立即试用

### 适合的 intent

- `transactional`（主）：用户已经知道自己要做什么，在找工具
- `commercial`（次）：用户在对比几个工具选哪个

### Brief 必须回答的问题

- Pexo 能做这件事吗（明确回答）
- 输入是什么 / 输出是什么
- 操作步骤是什么（越具体越好）
- 和手动做法 / 其他工具相比的优势是什么
- 用户怎么立刻开始

### 推荐页面结构

- H1：操作词 + 工具定位（自然语言，不要堆砌）
- Intro：直接说明 Pexo 能做这件事 + 核心优势（20–30 字）
- H2：输入与输出（需要什么，能得到什么）
- H2：操作步骤（numbered list，越简洁越好）
- H2：输出示例（真实截图或视频，必须有）
- H2：和其他方式相比为什么选 Pexo
- H2：常见问题
- FAQ
- CTA（强，直接指向操作入口）

### H2 / H3 重点

- H2 偏”操作阶段”和”价值点”
- H3 偏”细节说明、格式要求、示例展示”

### FAQ 适合的问题类型

- 支持什么格式 / 分辨率 / 时长
- 输出质量怎么样（附示例）
- 需要注册吗 / 有免费额度吗
- 和 [竞品] 相比怎么样

### 字数参考

- 主要内容区：800–1,500 字（transactional 页用户目标明确，不要注水）
- FAQ：4–6 题，每题回答 50–100 字

### Avoid

- 不要写成功能介绍文章——用户已经知道要做什么，不需要教育
- 不要缺少真实输出示例——这是唯一能建立信任的方式
- 不要把 CTA 放得太弱或太靠后
- 不要大篇幅讲”AI 视频的未来”——用户只想知道这个工具能不能用

---

## 2. Use-Case Page

### 适用场景

当页面的核心是 Pexo **能生成的某种视频类型**时使用。

这类页面对应的是输出形态，而不是工具操作。典型例子：
- Animation video
- Music video
- Product video
- UGC video
- Explainer video
- Short story video

关键词形态通常是：`[视频类型] + generator / maker / AI / creator`，例如 “animation video generator”, “AI music video maker”, “product video AI”

### 页面目标

- 让用户认识到 Pexo 能生成这种视频
- 展示这种视频类型的实际效果（示例优先）
- 引导用户从”我想做这种视频”进入试用

### 适合的 intent

- `commercial`（主）：用户在找能做这种视频的工具
- `informational`（次）：用户在了解这种视频类型怎么做

### Brief 必须回答的问题

- 这种视频是什么风格 / 形态
- 用 Pexo 怎么生成（输入是什么、过程是什么）
- 实际输出效果怎么样（必须有示例）
- 适合哪些人用来做这种视频
- 用户怎么开始做第一个

### 推荐页面结构

- H1：视频类型词 + AI/Generator 定位
- Intro：直接点明 Pexo 能生成这种视频 + 示例引导（图或视频）
- H2：这种视频是什么 / 为什么有人要做
- H2：用 Pexo 生成的步骤
- H2：效果展示（真实输出，不同风格或主题的示例）
- H2：适合哪些场景和用户
- H2：和其他生成工具相比的特点
- FAQ
- CTA

### H2 / H3 重点

- H2 偏视频类型说明、生成流程、效果展示
- H3 偏风格变体、参数选项、特定场景示例

### FAQ 适合的问题类型

- 这种视频生成需要什么素材 / 输入
- 支持哪些风格、时长、比例
- 效果能达到什么水平（附示例）
- 和 [竞品] 生成同类视频相比有什么区别

### 字数参考

- 主要内容区：1,000–1,800 字
- FAQ：4–6 题

### Avoid

- 不要写成功能操作手册——重点是这种视频长什么样、效果怎么样
- 不要缺少实际视频 / 图片示例——用户在选工具时看示例的时间比看文字多
- 不要把不同视频类型的页面写得太相似——每种视频类型应有独特的效果描述和应用人群
- 不要忽略具体人群识别信号，用户需要在 5 秒内确认”这是给我用的”

---

## 3. Model Page

### 适用场景

当页面是对某个 AI 大模型（Kling、Sora、Seedance、Runway 等）做**全面评测**时使用。

这类页面的核心策略是**蹭模型品牌名流量**：用户在搜索这个模型，我们提供最全面的评测内容，在内容中自然引入 Pexo 作为使用这些模型的最佳方式。

关键词形态通常是：
- `[模型名] review`
- `[模型名] complete guide`
- `[模型名] features / pricing / alternatives`
- `is [模型名] worth it`
- `[模型名] vs [竞品]`

### 页面目标

- 成为该模型最全面的第三方评测页之一
- 帮助用户对这个模型做出评估和决策
- 在"如何使用"环节自然引入 Pexo
- 长期维护，随模型版本更新持续保持相关性

### 适合的 intent

- `informational`（主）：了解这个模型是什么、能做什么
- `commercial`（次）：评估这个模型值不值得用、和其他模型怎么选

### Brief 必须回答的问题

- 这个模型是什么（背景、发布方、定位）
- 核心能力是什么（文生视频、图生视频、时长、分辨率等）
- 实际输出质量怎么样（必须有真实示例，不是官方 demo）
- 定价 / 使用门槛 / 访问方式
- 和主要竞品相比的优劣
- 适合什么用户和场景
- 怎么通过 Pexo 使用这个模型（自然引入，不硬销售）

### 推荐页面结构

- H1：模型名 + Review / Complete Guide（evergreen 标题，不含年份在 H1，可在 meta 含）
- Intro：50–80 字快速定位这个模型的核心价值，争取 Featured Snippet
- H2：[模型名] 是什么（发布背景、定位）
- H2：核心能力详解（文生视频 / 图生视频 / 特色功能）
- H2：真实输出示例（多个场景的真实生成结果，必须有）
- H2：定价与访问方式
- H2：和主要竞品对比（表格优先）
- H2：适合谁用
- H2：如何在 Pexo 中使用 [模型名]（自然引入 Pexo，1 个 H2 足够）
- H2：最新版本更新（Evergreen 区，注明 Last updated）
- FAQ（FAQPage schema）

### H2 / H3 重点

- H2 偏能力维度、评估维度、对比维度
- H3 偏具体参数、示例、版本差异、操作步骤

### FAQ 适合的问题类型

- [模型名] 免费吗 / 怎么收费
- [模型名] 和 [竞品] 哪个更好
- [模型名] 支持什么类型的输入
- [模型名] 最新版本是什么
- [模型名] 适合商业用途吗

### 字数参考

- 主要内容区：2,000–3,000 字（全面评测需要足够深度才能竞争过技术媒体）
- FAQ：5–8 题
- 对比表格：必须有，是 Featured Snippet 和用户决策的核心

### Evergreen 维护规则

- 页面顶部注明 "Last updated: [日期]"
- 保留"最新版本更新"H2 节用于追加内容
- 模型有新版本时优先更新本页，不新建页面

### Avoid

- 不要只复述官方发布信息——用户需要的是独立评测视角
- 不要缺少真实输出示例——这是 Model 页与媒体报道的核心差异，也是 E-E-A-T 的关键
- 不要在 Pexo 引入部分写得太像广告——保持评测语气，1 个 H2 自然带入即可
- 不要回避局限性——诚实评估比过度美化更能建立信任和排名

---

## 4. Blog Page

### 适用场景

当页面主要是教育、解释、教程、方法论、问题解答时使用。

### 页面目标

- 回答用户问题
- 获取 informational 流量
- 建立 topic coverage
- 给 pillar 或 feature 页导流

### 适合的 intent

- `informational`

### Brief 必须回答的问题

- 用户在问什么
- 这个问题的答案是什么
- 用户应该怎么做
- 常见错误是什么
- 下一步应该看什么

### 推荐页面结构

- H1：问题词 / how-to 主词
- Intro：**直接回答问题**（30–50 字），争取 Featured Snippet
- H2：背景 / 重要性
- H2：步骤 / 方法（numbered list 优先，利于 HowTo 结构化数据）
- H2：常见问题或误区
- H2：延伸建议
- FAQ（使用 FAQPage schema）
- Internal links（链接至相关 feature 或 use-case 页，锚文本使用目标页 main_keyword）

### H2 / H3 重点

- H2 偏问题拆解和步骤阶段
- H3 偏细节说明、示例、误区

### FAQ 适合的问题类型

- 这个概念是什么意思
- 该怎么开始
- 常见错误有哪些
- 还有哪些相关问题值得看

### 字数参考

- 主要内容区：1,500–2,500 字（informational 内容需要足够覆盖，但不能注水）
- FAQ：5–8 题（覆盖长尾问题，这是 blog 页获取 featured snippet 的核心机会）

### Avoid

- 不要在首段强推产品
- 不要把 informational 页写成硬销售页
- 不要只讲概念，不给实际步骤
- 不要把内部链接随意放在页脚——内部链接应该在正文相关段落自然嵌入，并使用描述性锚文本

---

## 5. Labs Page

### 适用场景

当页面的核心是介绍某个 AI 大模型的发布、更新、能力评测或使用方法时使用。

目标关键词形态通常是：
- `[模型名] features`
- `[模型名] review`
- `[模型名] vs [其他模型]`
- `how to use [模型名]`
- `[模型名] update [年份]`

### 页面目标

- 让用户快速了解这个模型是什么、有什么变化
- 提供真实的能力评估（不是厂商宣传的复读）
- 帮助用户判断这个模型适不适合自己的场景
- 通过内部链接将流量导入 Pexo 的 feature / use-case 页

### 适合的 intent

- `informational`（主）：了解模型是什么、有什么更新
- `commercial`（次）：评估这个模型值不值得用、和其他模型怎么选

### Brief 必须回答的问题

- 这个模型是什么 / 这次更新了什么
- 核心能力和输出质量怎么样（要有真实示例）
- 和主要竞品相比优劣在哪里
- 适合什么人、什么场景用
- 用户怎么立刻访问或尝试

### 推荐页面结构

- H1：模型名 + 核心角度（更新 / 评测 / 使用指南）
- Intro：30–50 字快速定位这个模型 + 本文核心结论，争取 Featured Snippet
- H2：[模型名] 是什么 / 这次更新了什么
- H2：核心能力与输出示例（真实生成结果，非官方宣传图）
- H2：和主要竞品的对比
- H2：适合哪些场景和用户
- H2：如何使用 / 访问
- H2：最新动态（Evergreen 更新区，注明"Last updated: [日期]"）
- FAQ（FAQPage schema）
- Internal links → 相关 Pexo feature / use-case 页

### H2 / H3 重点

- H2 偏能力维度、评估维度、场景维度
- H3 偏具体示例、参数说明、操作步骤、对比细节

### FAQ 适合的问题类型

- 这个模型和 [竞品] 有什么区别
- 适合什么用户或场景
- 免费版 / API / 定价情况如何
- 输出质量是否稳定 / 有哪些已知限制
- 和上一个版本相比改进了什么

### 字数参考

- 主要内容区：1,200–2,000 字（需要足够深度赢过技术媒体的浅层报道）
- FAQ：4–6 题

### Evergreen 维护规则

Labs 页面是**时间衰减最快的页面类型**。以下规则必须在 Writer notes 中注明：

- 页面顶部或末尾加"Last updated: [日期]"
- 保留一个"最新动态"H2 节，专门用于后续追加更新
- 每次模型有重大更新时，优先更新这个节，而不是新建页面（保住已有排名）
- 如果模型已停止更新 > 12 个月，评估是否转为对比/历史参考页

### SEO 竞争注意事项

Labs 页面的主要竞争对手是科技媒体（TechCrunch、The Verge、Wired）和模型官方文档。
差异化策略：
- 不做新闻复读，提供**场景化评估**（"这个模型适不适合做电商产品视频"）
- 用真实的生成示例建立 Experience 信号，媒体很少做这一步
- 内部链接到 Pexo 相关功能，形成独特的"如何在 Pexo 中用这个模型"角度

### Avoid

- 不要只做官方发布内容的复述，没有自己的评估就没有差异化
- 不要缺少真实输出示例——这是 E-E-A-T 的核心，也是和媒体报道的核心区别
- 不要把 Labs 页写成 Pexo 的产品推广页，要保持客观评测语气
- 不要写完就不更新——一篇没有维护的模型评测会在 3–6 个月内失去排名

---

## content_type 选择建议

### 优先判断逻辑

1. 如果关键词是 Pexo 能执行的操作（URL to video / remove watermark），用 `feature`
2. 如果关键词是视频输出类型（animation video / music video），用 `use-case`
3. 如果关键词是 AI 大模型的品牌名（Kling / Sora / Seedance）+ review / guide，用 `model`
4. 如果关键词是通用方法论问题（how to make / what is），用 `blog`
5. 如果关键词是某个 AI 大模型的最新资讯 / 版本更新，用 `labs`

### 边界情况处理

- **feature vs use-case**：关键词是操作动词（convert / remove / generate from URL）→ `feature`；关键词是视频类型名词（animation video / product video）→ `use-case`
- **feature vs blog**：用户已经知道要做什么在找工具（transactional）→ `feature`；用户在问怎么做（informational how-to）→ `blog`
- **model vs labs**：关键词是"[模型名] review / guide / complete"（evergreen 评测）→ `model`；关键词是"[模型名] update / new feature / release"（时效性资讯）→ `labs`
- **model vs blog**：关键词含具体模型名 → `model`；关键词是通用概念（"best AI video generator"）→ `blog`
- **如果 intent 和 content_type 推荐结果冲突**：以 `intent` 为准，content_type 向 intent 靠拢调整

## Brief 生成时建议附带的输入字段

- `content_type`
- `intent`
- `main_keyword`
- `keyword_variants`
- `topic_cluster_name`
- `internal_link_role`
- `existing_context`（可选，原有 brief 草稿或背景笔记）

## 一句话使用方式

先根据 `content_type` 选中对应规范，再结合 `intent` 和关键词分布规则生成页面级 brief。

---

## 附录：可直接使用的 Brief Generation Prompt

下面这段 prompt 是基于本文件规则整理出来的可复制版本。

```text
You are an SEO content strategist. Your task is to generate a structured page brief for a single page.

You must follow the writing specification strictly. Do not skip fields. Do not invent a different structure.

## Goal
Generate a page brief that can be used for production writing.

## Inputs
- Topic cluster: {{topic_cluster_name}}
- Content type: {{content_type}}
- Intent: {{intent}}
- Internal link role: {{internal_link_role}}
- Main keyword: {{main_keyword}}
- Keyword variants: {{keyword_variants}}
- Existing context / notes: {{existing_context}}
- Reference writing rules: use the content_type specification and global keyword rules in this document

## Global SEO rules
1. The main keyword must appear in:
   - URL slug
   - Title tag
   - Meta description
   - H1
2. High-priority keyword_variants should be distributed into H2s and H3s.
3. Remaining keyword_variants should be naturally placed in body sections and FAQ.
4. Do not stuff keywords unnaturally.
5. Keep the page aligned with the given intent and content type.
6. The output must be production-friendly, not vague strategy talk.
7. Include E-E-A-T signals in writer notes: specify what real examples, data, or proof points are needed.
8. Internal links must include recommended anchor text, not just page names.

## Content-type rules
Follow the content_type specification from this document:
- feature
- use-case
- model
- blog
- labs

## Intent rules

### If intent = commercial
- The intro should quickly frame the user problem and the available solution direction.
- The page should help comparison and evaluation.

### If intent = transactional
- The intro should be action-oriented.
- The page should make it easy to use, start, try, or integrate.

### If intent = informational
- The intro should educate first.
- Do not hard-sell in the opening paragraph.

## Output format
Return the answer in the exact structure below:

URL slug:
[kebab-case slug containing the main keyword]

Title tag:
[SEO title containing the main keyword, 50–60 characters]

Meta description:
[Meta description containing the main keyword, 140–160 characters]

H1:
[Page H1 containing the main keyword — must read naturally, not like a keyword string]

Page positioning:
- What this page is about
- Why this page exists in the topic cluster
- Whether it is pillar or supporting
- How it is differentiated from similar pages in the cluster

Target reader:
[Who this page is for — be specific, not "anyone interested in video"]

Search intent:
[Intent explanation]

Content type:
[Content type explanation]

Primary angle:
[Main strategic angle for the page]

Target word count:
[Recommended word count for main body content, excluding FAQ]

Section outline:
## H2-1
### H3-1
### H3-2

## H2-2
### H3-1
### H3-2

## H2-3
### H3-1
### H3-2

Keyword mapping:
- Main keyword → URL slug / Title tag / Meta description / H1
- keyword_variants (H2/H3 priority): [list variants to use in headings]
- keyword_variants (body/FAQ natural distribution): [list variants for body text]

Featured snippet opportunity:
[Yes/No — if yes, specify which section and format (definition box / numbered list / table)]

FAQ:
1. [Question]
2. [Question]
3. [Question]
4. [Question]
Schema: FAQPage — [Yes / No]

Internal links:
- [Page name] → anchor text: "[recommended anchor text]"
- [Page name] → anchor text: "[recommended anchor text]"
- [Page name] → anchor text: "[recommended anchor text]"

CTA suggestion:
[What CTA should appear on this page, and where — above/below FAQ, inline, etc.]

Notes for writer:
- What to emphasize
- What to avoid
- What proof/examples are needed (screenshots, real outputs, data points)
- E-E-A-T requirements: [specific signals this page needs]

## Hard constraints
- Do not omit URL slug / Title tag / Meta description / H1 / FAQ.
- Do not place all keyword_variants only in body text — H2/H3 must carry some variants.
- Do not leave the keyword mapping empty.
- Do not write a generic H1 — it must reflect the specific angle of this page.
- Keep the page type aligned with content_type.
```
