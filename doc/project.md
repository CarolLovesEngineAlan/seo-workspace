# SEO Opportunity Workspace Project Guide

## 1. 项目阶段

当前处于 MVP 开发前准备完成、即将进入实现阶段。

目标是在 2 天内跑通一个端到端切片，不扩散需求，不做平台化。

## 2. 本轮范围

本轮只做以下闭环：

`Notion -> 页面机会 -> 策略排序 -> Brief -> 文章初稿 -> QA -> Markdown 导出`

不做：

- 权限系统
- 多用户
- 自动发布 CMS
- 定时任务
- 竞品情报自动抓取
- 复杂看板

## 2.1 冻结的系统决策

- 执行环境：Web app
- 源数据：Notion
- 状态层：SQLite
- 主 UI：Pipeline 视角
- 评分：外部 config 文件
- QA：固定 checklist
- `needs_review`：独立人工处理队列

## 3. 角色分工

### SEO

负责：

- 定义优先级规则
- 确认页面类型规则
- 确认字段职责与字段优先级
- 确认 brief 模板
- 确认 QA 标准
- 复核策略层输出

### 前端

负责：

- 数据读取与展示
- 机会列表页面
- 策略任务面板
- 生产面板
- 导出交互
- 依据字段职责区分展示字段、排序字段和生产字段
- 按 Pipeline 主工作台实现，不同时开发第二套主流程 UI

## 3.2 双人 ToDo 与 Review 节点

### SEO / 策略 Owner

Day 1 之前必须完成：

- 确认 `content_type` 最终使用规则
- 确认 `intent` 对应的页面写法规则
- 确认 `needs_review` 的人工处理规则
- 确认 `scoring-config.json` 初版权重
- 准备 20 条可演示关键词样本

说明：

- `content_type` 最终规则请以 [field-spec.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/field-spec.md) 为准，并同步影响机会层和生产层
- `intent` 页面写法规则将直接影响 `brief_v2` 和 QA 判断，参考 [qa-checklist.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/qa-checklist.md)
- `needs_review` 人工处理规则以 [system-decisions.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/system-decisions.md) 和 [arc.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/arc.md) 为准
- 排序权重必须写入 [config/presets/new-saas.json](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/config/presets/new-saas.json)，Pexo 项目特有覆盖写入 [config/projects/pexo.json](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/config/projects/pexo.json)

Day 1 下午必须交付：

- Top 5 机会的人工复核结果
- 每条机会的 `why_now` 示例
- 1 个 `needs_review` 样例和处理方式
- `brief_v2` 模板初稿

Day 2 必须交付：

- 1 条机会的最终 brief
- 1 条机会的 article draft 审核意见
- QA checklist 通过/失败样例各 1 份

### 前端 / 实现 Owner

Day 1 之前必须完成：

- 建立 Web app 基础骨架
- 接入 Notion 读取或本地 mock 数据
- 建立 SQLite 状态层
- 完成 Opportunity List + Strategy Queue 基础页面
- 接入 `scoring-config.json`

Day 1 下午必须交付：

- 可运行的主工作台
- `same_page_group_id` 聚合后的机会列表
- `needs_review` 队列展示
- Top 5 排序展示

Day 2 必须交付：

- Production Panel
- `brief_v2` 生成按钮和状态流
- `article_draft` 展示与保存
- QA 结果展示
- Markdown 导出

### Review Gate

#### Gate 1: Day 1 收口 Review

必须同时满足以下条件，才能进入 Day 2：

- 机会列表能正常展示真实或 mock 样本
- 排序结果能解释来源
- `needs_review` 队列可见
- `scoring-config.json` 改动后排序会变化
- SEO 和前端对 Top 5 结果没有结构性分歧

#### Gate 2: Day 2 Demo Review

必须同时满足以下条件，才算 MVP 可演示：

- 从 1 条机会进入 Production Panel
- 能生成 `brief_v2`
- 能生成 `article_draft`
- 能显示 QA pass / fail
- 能导出 Markdown
- 能恢复已保存状态

## 3.1 字段执行清单

### 页面聚合主键

- `same_page_group_id`
  - 用途：唯一页面聚合主键
  - 规则：第一版必须按它聚合，不能按单关键词直接生产

### 页面类型规则

- `content_type`
  - 用途：人工确认后的最终页面类型
  - 规则：优先级高于 `content_type_llm`

- `content_type_llm`
  - 用途：兜底分类
  - 规则：只有在 `content_type` 为空或待分类时使用

### 策略层主输入

- `volume`
- `kd`
- `intent`
- `content_type`
- `internal_link_role`
- `variant_count`
- `page_brief`

### 策略层参考输入

- `priority`
- `topic_cluster_name`

### 不作为第一版主决策输入

- `keyword`
- `createdTime`
- `url`

### 生产层主输入

- `main_keyword`
- `all_keywords`
- `keyword_variants`
- `intent`
- `content_type`
- `internal_link_role`
- `topic_cluster_name`
- `page_brief`

## 4. AI 协作规则

### 4.1 范围控制

- AI 不得自行新增产品模块
- AI 不得将单页工作台扩展成后台系统
- AI 不得在未确认前改动核心数据结构

### 4.2 开发粒度

- 每次只实现一个可验证切片
- 不让 AI 一次生成整套系统
- 先跑通 happy path，再补异常流程

### 4.3 失败处理

- 同类问题连续失败 2 到 3 次后，停止继续生成
- 失败升级为人工排查根因

### 4.4 内容安全

- AI 生成内容不能直接视为发布完成
- 所有生产内容都必须经过 QA
- 策略层解释必须可读，避免黑盒推荐

### 4.5 AI 角色边界

- AI 的职责是辅助判断，不是替代 SEO 判断
- AI 可以：
  - 给机会做初步排序
  - 生成 `why_now`
  - 生成 `brief_v2`
  - 生成 `article_draft`
  - 标记 `needs_review`
- AI 不可以：
  - 直接拍板本周最终任务
  - 跳过人工确认进入生产
  - 跳过 QA 直接视为可发布
  - 擅自修改 `content_type`、`intent`、评分权重等核心规则

人工必须保留的决策权：

- 最终 Top 5 任务确认
- 歧义页面类型确认
- 是否进入 production
- 是否可以发布

## 5. 开发清单

## Day 1

- 接入 Notion 数据读取
- 接入 SQLite 状态层
- 将记录映射为内部对象
- 按 `same_page_group_id` 聚合页面机会
- 建立 `needs_review` 队列
- 接入外部评分配置文件（`config/scoring-engine.json` + `config/presets/new-saas.json` + `config/projects/pexo.json`）
- 计算 `opportunity_score`
- 展示 Top 5 本周任务
- 展示字段最少包含：
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

### Day 1 验收

- 能读到至少 20 条关键词样本
- 能聚合出页面机会
- 能看见 `needs_review` 队列
- 能通过 config 调整权重
- 能显示任务排序结果

## Day 2

- 实现 `brief_v2` 生成
- 实现 `article_draft` 生成
- 实现 checklist 驱动的 QA
- 实现 Markdown 导出
- 将状态持久化到 SQLite

### Day 2 验收

- 能从一个页面机会生成 brief
- 能生成文章初稿
- 能展示 QA 结果
- 能导出 Markdown
- 能恢复至少 1 条已保存运行状态

## 6. 质量闸门

- 所有新逻辑都要先能被样本数据验证
- 不引入非必要的复杂抽象
- 每个关键模块都必须有可观察输出
- 任何排序结果都要能解释来源
- 不允许把评分权重写死在业务代码中（必须从 `config/` 读取）
- 不允许把 `needs_review` 项悄悄丢弃

## 7. 当前建议目录

```text
app/ or src/
  opportunities/
  strategy/
  production/
lib/
  notion/
  scoring/
  prompts/
scripts/
```

如果当前仓库不是前端应用仓库，可先只保留文档和脚本，不强行搭完整目录。

## 8. Prompt 边界

### 8.1 策略层 Prompt

目标：

- 用已有结构化字段解释为什么值得本周做

禁止：

- 自行更改优先级规则
- 编造不存在的业务目标

### 8.2 Production Prompt

目标：

- 基于结构化输入生成 brief 和文章初稿

禁止：

- 忽视 `contentType`
- 忽视 `intent`
- 忽视 `all_keywords`

## 8.3 QA Prompt / Rule Boundary

第一版 QA 不做开放式“内容感觉判断”，只做 checklist 规则判断：

- H1 包含主关键词
- 覆盖率达标
- 首段意图匹配
- 正文字数达标
- 存在内部链接占位

## 9. 决策原则

- 按页面组推进，不按单关键词推进
- 优先做高意图、低难度、可快速生产的机会
- 人工字段优先于 LLM 预测字段
- 页面类型未定的机会不进入自动生产
- `priority` 仅作参考，不直接决定最终排序

## 10. 下一步产物

本文件之后，最适合继续补的是：

- brief 生成模板
- article QA checklist
- SQLite 状态表定义
- scoring config
