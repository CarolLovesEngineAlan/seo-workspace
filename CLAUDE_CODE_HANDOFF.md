# Prompt Management System — Claude Code 开发需求文档

## 背景

我有一个 SEO 自动化系统（localhost:3000），需要在现有系统中新增一个 **Prompt 管理模块**，用来管理 AI 生成落地页和博客文案的完整工作流。

请先阅读我的项目结构和技术栈，理解现有代码，然后按照下面的需求新增功能。

---

## 需要新增的 3 个数据模块

### 模块 1: Brand Context（产品信息 & 写作规则）

这是一个**单条记录**的配置表，存储 Pexo 的产品信息和所有 AI 写作规则。所有 Prompt 在调用 API 时都需要引用这里的内容。

**字段设计：**

brand_context:
  id: UUID (主键)
  
  # 产品信息
  product_name: TEXT ("Pexo")
  product_positioning: TEXT (长文本 — AI video agent 定位描述)
  capabilities_summary: TEXT (长文本 — 核心能力概述，供 AI 参考但不直接复制)
  supported_platforms: TEXT[] (数组 — ["Telegram", "WhatsApp", "Discord", "Web"])
  ai_models_used: TEXT[] (数组 — ["Seedance", "Kling", "Sora"])
  pricing_info: TEXT (长文本 — 当前定价和计划信息)
  
  # 写作规则
  brand_voice: TEXT (长文本 — 品牌语气描述)
  expression_rules: TEXT (长文本 — 表达规则，如 NEVER/ALWAYS 对照)
  banned_words: TEXT[] (数组 — 禁用词列表)
  pexo_mention_density: TEXT (提及密度规则)
  
  # 竞品定位
  competitive_positioning: JSONB (JSON 对象，键为竞品名，值为定位描述)
  
  # 版本管理
  version: TEXT ("v1.0")
  updated_at: TIMESTAMP

**初始数据（建完表后直接插入）：**

{
  "product_name": "Pexo",
  "product_positioning": "Pexo is the first AI video agent that creates with you, not a tool you operate on. Instead of writing prompts or learning complex editing software, users simply describe their video idea in natural language. Pexo interprets intent, suggests creative directions, selects the best AI models behind the scenes, and delivers a complete, polished video.",
  "capabilities_summary": "Smart script generation from raw text; AI voice & lip-sync (audio as part of production, not afterthought); Visual style control (applied as creative direction, not filter); Camera direction (natural language camera commands); Multi-scene continuity (character/setting/plot consistency); Reference-based creation (image/clip + text to video); Auto model selection from multiple leading models.",
  "supported_platforms": ["Telegram", "WhatsApp", "Discord", "Web App"],
  "ai_models_used": ["Seedance", "Kling", "Sora"],
  "pricing_info": "Free starter plan with starter credits, no credit card required. 3 bonus projects on first registration. 1 free project daily.",
  "brand_voice": "Confident but not hype-y. Conversational — like a knowledgeable friend making a recommendation. Write like you genuinely understand what makes this creative niche exciting and what challenges creators face.",
  "expression_rules": "NEVER use possessive forms like 'Pexo's [keyword] generator'. ALWAYS use phrasing like 'Pexo acts / works / serves / functions / operates as a [keyword] generator' and natural variations. Pexo is a partner that thinks with you, not a tool you configure.",
  "banned_words": ["revolutionary", "cutting-edge", "unleash", "unlock", "game-changing", "seamlessly", "elevate your content", "harness the power of", "in today's fast-paced world"],
  "pexo_mention_density": "Landing pages: per feature row as appropriate. Blog articles: 30-40% of sections, not every section. Introduction: 0-1 mentions. Conclusion: 1 soft CTA.",
  "competitive_positioning": {
    "vs_heygen": "Pexo is conversational, HeyGen is form-based. HeyGen focuses on avatar/talking-head videos, Pexo handles full video production.",
    "vs_invideo": "Pexo auto-selects models, InVideo requires manual selection. Pexo works in messaging apps, InVideo is web-only.",
    "vs_runway": "Pexo handles end-to-end production including script/voiceover, Runway is single-clip generation focused on visual quality.",
    "vs_viggle": "Viggle requires template or reference video for dance, Pexo generates from text description. Viggle has no audio integration or multi-scene support.",
    "vs_imagineart": "ImagineArt requires detailed prompts and manual model selection, Pexo uses conversational interface with auto model selection."
  },
  "version": "v1.0"
}

---

### 模块 2: Prompt Library（Prompt 管理库）

存储所有 Prompt 模板，按页面类型和步骤分类。

**字段设计：**

prompts:
  id: UUID (主键)
  name: TEXT (如 "Feature Page — Outline")
  
  # 分类
  page_type: ENUM ("feature_page", "use_case_page", "blog_howto", "blog_top_review", "blog_tips", "blog_product_review")
  prompt_step: ENUM ("A_outline", "B_copy")
  
  # 内容
  prompt_text: TEXT (完整的 Prompt 文本，长文本)
  required_variables: JSONB (变量列表，含名称、描述、示例)
  example_variable_set: TEXT (一个可直接复制的示例变量块)
  
  # 执行配置
  recommended_model: ENUM ("claude_sonnet", "claude_opus", "gpt4o_mini")
  use_cache: BOOLEAN (是否启用 prompt caching)
  
  # 元数据
  version: TEXT
  notes: TEXT (变更日志、已知问题)
  brand_context_id: UUID (外键 → brand_context)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP

**初始 Prompt 记录（10 条）：**

建完表后插入以下 10 条记录。每条的 prompt_text 较长，完整内容附在下方。

Record 1: Feature Page — Outline
  name: "Feature Page — Outline"
  page_type: feature_page
  prompt_step: A_outline
  recommended_model: claude_sonnet
  use_cache: true
  version: v1.0
  required_variables: [
    {name: "primary_keyword", description: "Main SEO keyword", example: "text to video"},
    {name: "keyword_variants", description: "Comma-separated variants", example: "text to video generator, ai text to video"}
  ]

Record 2: Feature Page — Copy
  name: "Feature Page — Copy"
  page_type: feature_page
  prompt_step: B_copy
  recommended_model: claude_opus
  use_cache: true
  version: v1.0
  required_variables: [
    {name: "outline", description: "Full outline from Prompt A", example: "(paste outline)"}
  ]

Record 3: Use Case Page — Outline
  name: "Use Case Page — Outline"
  page_type: use_case_page
  prompt_step: A_outline
  recommended_model: claude_sonnet
  use_cache: true
  version: v1.0
  required_variables: [
    {name: "primary_keyword", description: "Main keyword", example: "ai dance video generator"},
    {name: "keyword_variants", description: "Variants", example: "ai dance video, dance video maker"},
    {name: "competitor_notes", description: "Competitor analysis", example: "Viggle AI is the main competitor..."}
  ]

Record 4: Use Case Page — Copy
  name: "Use Case Page — Copy"
  page_type: use_case_page
  prompt_step: B_copy
  recommended_model: claude_opus
  use_cache: true
  version: v1.0
  required_variables: [
    {name: "outline", description: "Full outline from Prompt A", example: "(paste outline)"}
  ]

Record 5: Blog How-to — Outline
  name: "Blog How-to — Outline"
  page_type: blog_howto
  prompt_step: A_outline
  recommended_model: claude_sonnet
  required_variables: [
    {name: "target_keyword"}, {name: "secondary_keywords"}, {name: "target_audience"}, {name: "pexo_feature"}
  ]

Record 6: Blog Top Review — Outline
  name: "Blog Top Review — Outline"
  page_type: blog_top_review
  prompt_step: A_outline
  recommended_model: claude_sonnet
  required_variables: [
    {name: "target_keyword"}, {name: "secondary_keywords"}, {name: "tools_list"}, {name: "comparison_angle"}
  ]

Record 7: Blog Tips — Outline
  name: "Blog Tips — Outline"
  page_type: blog_tips
  prompt_step: A_outline
  recommended_model: claude_sonnet
  required_variables: [
    {name: "target_keyword"}, {name: "secondary_keywords"}, {name: "tip_count"}, {name: "target_audience"}
  ]

Record 8: Blog Product Review — Outline
  name: "Blog Product Review — Outline"
  page_type: blog_product_review
  prompt_step: A_outline
  recommended_model: claude_sonnet
  required_variables: [
    {name: "target_keyword"}, {name: "secondary_keywords"}, {name: "product_name"}, {name: "relationship"}
  ]

Record 9: Blog — Article (Universal)
  name: "Blog — Article (Universal)"
  page_type: (all blog types share this)
  prompt_step: B_copy
  recommended_model: gpt4o_mini
  use_cache: true
  required_variables: [
    {name: "outline", description: "Full outline from any Blog Prompt A"}
  ]

Record 10: (reserved for future page types)

**Prompt 全文太长，不在此文档中逐条列出。** 初始建表时 prompt_text 字段可留空，我会通过管理界面手动填入。或者 Claude Code 可以在项目中创建一个 seed 文件目录 /seeds/prompts/，每个 Prompt 一个 .md 文件，建表时从文件读取。

---

### 模块 3: Internal Link Library（内链库）

存储 Pexo 网站上所有可被内链的页面。

**字段设计：**

internal_links:
  id: UUID (主键)
  page_title: TEXT
  url: TEXT (完整 URL)
  page_category: ENUM ("feature", "use_case", "model", "guide", "blog", "other")
  primary_keyword: TEXT
  anchor_text_suggestions: TEXT[] (2-3 个自然锚文本选项)
  link_priority: ENUM ("high", "medium", "low")
  last_verified: TIMESTAMP
  created_at: TIMESTAMP

**初始数据（13 条）：**

| page_title | url | category | keyword | anchor_texts | priority |
|---|---|---|---|---|---|
| Text to Video | https://pexo.ai/features/text-to-video | feature | text to video | ["text to video", "turn text into video", "AI text to video generator"] | high |
| URL to Video | https://pexo.ai/features/url-to-video | feature | url to video | ["URL to video", "turn any link into a video"] | high |
| Product Ad Video | https://pexo.ai/create/product-video | use_case | ai product video | ["product video ads", "AI product video maker"] | high |
| Social Media Video | https://pexo.ai/create/social-media-video | use_case | ai social media video | ["social media video", "create social videos"] | high |
| Short Story Video | https://pexo.ai/create/short-video | use_case | ai short video | ["short story video", "AI short film maker"] | medium |
| Music Video | https://pexo.ai/create/music-video | use_case | ai music video | ["AI music video", "music video generator"] | medium |
| Explainer Video | https://pexo.ai/create/explainer-video | use_case | ai explainer video | ["explainer video", "AI explainer video maker"] | medium |
| Anime Video | https://pexo.ai/create/anime-video | use_case | ai anime video | ["anime video generator", "create anime with AI"] | medium |
| Seedance 2.0 | https://pexo.ai/model/seedance-2-0 | model | seedance 2.0 | ["Seedance 2.0", "Seedance AI video model"] | medium |
| Getting Started | https://pexo.ai/guide/getting-start | guide | how to use pexo | ["getting started with Pexo", "how to use Pexo"] | medium |
| Credit Rules | https://pexo.ai/guide/credits-rules | guide | pexo credits | ["credit rules", "how Pexo credits work"] | low |
| OpenClaw | https://pexo.ai/connect/openclaw | guide | pexo openclaw | ["connect to OpenClaw", "use Pexo in your chat"] | medium |
| Pricing | https://pexo.ai/pricing | other | pexo pricing | ["Pexo pricing", "free plan", "see pricing"] | low |

---

## 前端 UI 需求

### 页面 1: Brand Context 管理页

- 路径: /prompt-system/brand-context
- 功能: 查看和编辑 Brand Context 的所有字段
- 设计: 表单式布局，分组显示（产品信息 / 写作规则 / 竞品定位）
- 每个长文本字段用 textarea
- 数组字段用 tag input（可增删标签）
- competitive_positioning 用可增删的 key-value 编辑器
- 顶部显示版本号和最后更新时间
- 保存按钮自动更新 version 和 updated_at

### 页面 2: Prompt Library 管理页

- 路径: /prompt-system/prompts
- 列表视图: 表格，列为 Name / Page Type / Step / Model / Version / Updated
- 支持按 page_type 和 prompt_step 筛选
- 点击行进入详情/编辑页
- 详情页: 展示完整 Prompt 文本（等宽字体，代码编辑器风格），变量列表，示例变量集
- 支持新增、编辑、删除

### 页面 3: Internal Link Library 管理页

- 路径: /prompt-system/internal-links
- 表格视图: Page Title / URL / Category / Priority / Last Verified
- 支持按 category 和 priority 筛选
- 支持新增、编辑、删除
- （可选）批量操作: 全选后验证 URL 是否存活

### 导航

- 在现有导航栏中新增 "Prompt System" 菜单项，下拉包含:
  - Brand Context
  - Prompt Library
  - Internal Links

---

## API 需求

为后续 n8n 自动化调用准备 REST API：

GET    /api/prompt-system/brand-context          — 获取 Brand Context
PUT    /api/prompt-system/brand-context           — 更新 Brand Context

GET    /api/prompt-system/prompts                 — 获取所有 Prompt（支持 ?page_type=&prompt_step= 筛选）
GET    /api/prompt-system/prompts/:id             — 获取单个 Prompt
POST   /api/prompt-system/prompts                 — 新增 Prompt
PUT    /api/prompt-system/prompts/:id             — 更新 Prompt
DELETE /api/prompt-system/prompts/:id             — 删除 Prompt

GET    /api/prompt-system/internal-links          — 获取所有内链（支持 ?category=&priority= 筛选）
POST   /api/prompt-system/internal-links          — 新增内链
PUT    /api/prompt-system/internal-links/:id      — 更新内链
DELETE /api/prompt-system/internal-links/:id      — 删除内链

GET    /api/prompt-system/assembled-prompt/:id    — 【关键接口】组装完整 Prompt

**assembled-prompt 接口说明：**
读取指定 Prompt 记录，将 prompt_text 中的变量占位符替换为实际内容：
- {brand_context} → 替换为 Brand Context 表的完整内容（格式化为 AI 可读的文本）
- {internal_link_library} → 替换为 Internal Link Library 的格式化列表
返回一个可以直接作为 system prompt 发送给 AI API 的完整文本。

---

## 注意事项

1. **请先阅读我现有的项目代码**，了解技术栈（框架、数据库、ORM、路由结构、UI 组件库），然后按照现有的代码风格和约定来开发。不要引入新的框架或库。

2. **数据库**: 使用项目现有的数据库。如果是 Supabase/PostgreSQL，直接建表。如果是其他数据库，按现有的来。

3. **长文本**: prompt_text 字段会存储几千字的文本，确保字段类型支持（TEXT 或 LONGTEXT）。

4. **初始数据**: 建完表后自动插入上面提供的 Brand Context 和 Internal Links 初始数据。Prompt 记录先创建结构（name、page_type、prompt_step、model 等元数据），prompt_text 留空或创建 /seeds/prompts/ 目录存放。

5. **样式**: 保持和现有系统的 UI 风格完全一致。

6. **不需要做的事**: 不需要接 AI API（Claude/OpenAI），不需要做内容排期，不需要改现有功能。只做 Prompt 管理这一个模块。