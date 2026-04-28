# Two-Person ToDo

## 目标

这份清单只服务两件事：

- 明确两个人今天各做什么
- 明确什么时候停下来 review

## 分工

### 角色 A：SEO / 策略

#### Day 1 上午

- 确认 `content_type` 使用规则
  - 是什么意思：确定页面类型字段到底怎么取值，避免策略层和生产层各用一套
  - 参考文档：
    - [field-spec.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/field-spec.md)
    - [system-decisions.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/system-decisions.md)
  - 要产出什么：
    - 明确 `content_type > content_type_llm > needs_review`
    - 明确 `待分类` 是否等同空值处理
    - 明确允许的最终页面类型集合
  - 写到哪里：
    - 更新 [field-spec.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/field-spec.md)
    - 如有规则变化，同步更新 [project.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/project.md)

- 确认 `intent -> 页面写法` 对应关系
  - 是什么意思：定义不同 intent 对应什么页面结构和写作方式，供 brief 和 QA 使用
  - 参考文档：
    - [field-spec.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/field-spec.md)
    - [qa-checklist.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/qa-checklist.md)
  - 要产出什么：
    - `commercial` 页面怎么写
    - `transactional` 页面怎么写
    - `informational` 页面怎么写
    - 首段、CTA、段落结构分别偏什么
  - 写到哪里：
    - 新增或补充到后续 `brief-template.md`
    - 先临时写进 [project.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/project.md) 也可以

- 确认 `needs_review` 的处理标准
  - 是什么意思：定义哪些机会不能自动进生产，必须人工处理
  - 参考文档：
    - [system-decisions.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/system-decisions.md)
    - [arc.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/arc.md)
  - 要产出什么：
    - 哪些情况进入 `needs_review`
    - 队列里显示哪些字段
    - 人工可以做哪些动作
  - 写到哪里：
    - 更新 [arc.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/arc.md)
    - 如需更细操作，再补到 [todolist.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/todolist.md)

- 确认 Pexo 项目评分配置
  - 是什么意思：确定第一版排序逻辑的权重，不让工程侧自己猜
  - 参考文档：
    - [config/projects/pexo.json](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/config/projects/pexo.json) — Pexo 项目 profile
    - [config/presets/new-saas.json](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/config/presets/new-saas.json) — 当前使用的权重预设
    - [field-spec.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/field-spec.md)
    - [system-decisions.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/system-decisions.md)
  - 要产出什么：
    - 确认 `new-saas` preset 权重是否符合 Pexo 现阶段判断
    - 确认 `content_type_scores` 中各页面类型的分值
    - Top 5 是否符合人工判断
  - 写到哪里：
    - 权重调整优先改 [config/presets/new-saas.json](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/config/presets/new-saas.json)
    - Pexo 特有覆盖写入 [config/projects/pexo.json](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/config/projects/pexo.json) 的 `weight_overrides`

- 准备 20 条样本数据
  - 是什么意思：准备一组能覆盖主要场景的演示数据，而不是随机抽 20 条
  - 参考文档：
    - [field-spec.md](/Users/carol/Documents/qiuzhi-skill-creator-2/seo-automatic/field-spec.md)
  - 要产出什么：
    - 至少包含 `high / medium`
    - 至少包含 `feature / model / blog`
    - 至少包含 1 条 `needs_review`
  - 写到哪里：
    - 可以先放本地 mock 数据
    - 或整理进 Notion 演示视图

#### Day 1 下午

- 复核 Top 5 机会排序
- 给出每条 `why_now` 的文字样例
- 提供 1 条 `needs_review` 示例
- 写 `brief_v2` 模板初稿

#### Day 2

- 审核 1 条 brief
- 审核 1 条 article draft
- 用 QA checklist 给出 pass 样例
- 用 QA checklist 给出 fail 样例

### 角色 B：前端 / 实现

#### Day 1 上午

- 起 Web app 骨架
- 接入 Notion 数据或 mock 数据
- 建 SQLite 状态层
- 完成机会列表与策略列表布局

#### Day 1 下午

- 完成 `same_page_group_id` 聚合展示
- 接入 `config/projects/pexo.json` + `config/presets/new-saas.json`（通过 `/api/config` 暴露给前端）
- 完成 Top 5 排序展示
- 完成 `needs_review` 队列展示

#### Day 2

- 完成 Production Panel
- 完成 `brief_v2` 保存
- 完成 `article_draft` 保存
- 完成 QA 结果展示
- 完成 Markdown 导出

## Review 节点

### Review 1

时间：

- Day 1 下午，机会层和策略层做完后

必须检查：

- 能否展示 20 条样本
- Top 5 是否合理
- `needs_review` 是否可见
- 改 `config/presets/new-saas.json` 后结果是否变化
- `content_type` fallback 规则是否按预期生效
- `intent -> 页面写法` 是否已经有可用文字规则

输出：

- 决定是否进入 Production Layer
- 如果不过关，必须明确是谁补什么，不允许模糊返工

### Review 2

时间：

- Day 2 完成 production 之后

必须检查：

- 是否能从 1 条机会走到 brief
- 是否能从 brief 走到 draft
- QA 是否能产出 pass/fail
- Markdown 是否能导出
- 状态是否能恢复

输出：

- 决定是否可以演示 MVP

## 最终交付判断

满足下面 6 条，才算这两天交付成立：

- 有主工作台
- 有机会列表
- 有排序结果
- 有 `needs_review`
- 有 brief 和 draft
- 有 QA 和 Markdown 导出
