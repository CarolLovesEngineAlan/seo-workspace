# System Decisions

## MVP Frozen Decisions

### 1. Execution Environment

- Main runtime: Web app
- Source data: Notion
- Business logic: app-internal API / local service functions
- Not used as main runtime:
  - n8n
  - Claude skill
  - local scripts

### 2. State Storage

- State layer: SQLite
- Reason:
  - faster than adding a cloud database
  - cleaner than writing every state back to Notion
  - good enough for a 2-day internal MVP

### 3. UI Direction

- Main workflow UI: Pipeline view
- Primary reference: `prototype.html`
- Secondary reference only: `keyword-opportunity-view.html`

### 4. Scoring

Config 拆分为三层，不同角色改不同文件：

| 文件 | 内容 | 谁来改 |
|---|---|---|
| `config/scoring-engine.json` | KD 曲线、volume 归一化等通用函数 | 工程师 |
| `config/presets/[stage]-[type].json` | 阶段 × 类型的权重预设 | SEO 策略 |
| `config/projects/pexo.json` | 项目 profile、content_type 分值、局部覆盖 | SEO 策略 |

规则：
- 评分逻辑只读 config，不得在代码里 hardcode 任何权重数值
- 切换项目阶段时只改 `config/projects/[name].json` 的 `preset` 字段
- `scoring-config.json` 已废弃，仅保留重定向指针

### 5. QA

- QA must use checklist rules from `qa-checklist.md`
- No vague semantic review in MVP

### 6. needs_review

- `needs_review` items go to a dedicated queue
- They do not enter auto-production
- Allowed actions:
  - assign `content_type`
  - fill `same_page_group_id`
  - mark `skip`

### 7. AI Role Boundary

- AI is a copilot, not the final decision-maker
- AI may:
  - group opportunities
  - generate initial scores
  - explain `why_now`
  - draft `brief_v2`
  - draft article content
  - flag `needs_review`
- AI may not:
  - finalize weekly priorities without human review
  - bypass `needs_review`
  - publish directly
  - override SEO-owned rules for `content_type`, `intent`, or scoring priorities

Human must confirm:

- final Top 5 priorities
- final `content_type` when ambiguous
- whether an opportunity enters production
- whether the output is publish-ready
