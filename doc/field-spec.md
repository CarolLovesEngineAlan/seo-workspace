# Field Spec

## 目标

这份文档只做一件事：明确 Notion 字段在 MVP 里的职责和使用方式。

适用对象：

- SEO
- 前端
- 后续接 API 或策略逻辑的人

## 总规则

- `same_page_group_id` 是第一版唯一页面聚合主键
- `content_type` 优先于 `content_type_llm`
- `priority` 仅作参考，不直接决定最终排序
- 第一版按页面机会推进，不按单关键词推进

## 项目特有字段值

以下字段的允许值因项目而异，实际值定义在 `config/projects/[name].json`，不在本文件硬编码：

| 字段 | 说明 | 配置位置 |
|---|---|---|
| `content_type` | 允许的页面类型集合（如 feature / blog / use-case） | `config/projects/[name].json` → `content_type_scores` |
| `intent` | 各意图对应的评分权重 | `config/presets/[name].json` → `intent_scores` |
| `internal_link_role` | 各角色对应的评分权重 | `config/presets/[name].json` → `internal_link_role_scores` |

新增项目时，只需在 `config/projects/` 下新建对应 json 并定义这些字段值，无需修改本 spec。

## 字段表

| 字段名 | 类型 | 是否必需 | 所属层级 | 前端展示 | 参与打分 | 进入 Brief | 进入 QA | 说明 |
|---|---|---:|---|---|---|---|---|---|
| `main_keyword` | Title/Text | 是 | 机会层 / 生产层 | 是 | 否 | 是 | 是 | 页面机会主标题词 |
| `keyword` | Text | 否 | 原始数据 / 生产层 | 否 | 否 | 是 | 否 | 原始关键词字段，保留回查 |
| `keyword_variants` | Text | 是 | 机会层 / 生产层 | 可选 | 否 | 是 | 是 | 用于扩展覆盖词和 QA 检查 |
| `all_keywords` | Text | 是 | 机会层 / 生产层 | 详情展示 | 否 | 是 | 是 | 页面应覆盖的完整关键词集合 |
| `page_brief` | Text | 否 | 机会层 / 策略层 / 生产层 | 详情展示 | 是 | 是 | 否 | 已有 brief 或业务上下文 |
| `topic_cluster_name` | Text | 是 | 机会层 / 策略层 / 生产层 | 是 | 参考 | 是 | 否 | 主题簇名称 |
| `volume` | Number | 是 | 机会层 / 策略层 | 是 | 是 | 否 | 否 | 流量潜力 |
| `kd` | Number | 是 | 机会层 / 策略层 | 是 | 是 | 否 | 否 | 关键词难度 |
| `variant_count` | Number | 否 | 机会层 / 策略层 | 是 | 是 | 否 | 否 | 覆盖变体数量 |
| `same_page_group_id` | Number/Text | 是 | 机会层 | 是 | 否 | 否 | 否 | 页面聚合主键 |
| `content_type` | Select | 是 | 机会层 / 策略层 / 生产层 | 是 | 是 | 是 | 是 | 人工确认后的最终页面类型 |
| `content_type_llm` | Select | 否 | 机会层 | 否 | 间接 | 否 | 否 | 仅在 `content_type` 缺失时兜底 |
| `intent` | Select | 是 | 机会层 / 策略层 / 生产层 | 是 | 是 | 是 | 是 | 搜索意图 |
| `priority` | Select | 否 | 策略层 | 可选 | 参考 | 否 | 否 | 仅作人工参考 |
| `internal_link_role` | Select | 是 | 机会层 / 策略层 / 生产层 | 是 | 是 | 是 | 否 | pillar/supporting 角色 |
| `url` | URL/Text | 否 | 去重 / 追踪 | 否 | 否 | 可选 | 否 | 唯一标识、已有页面关联 |
| `createdTime` | DateTime | 否 | 追踪 | 否 | 否 | 否 | 否 | 增量同步和排查使用 |

## 分层使用

### 1. Opportunity Layer

必用字段：

- `same_page_group_id`
- `main_keyword`
- `all_keywords`
- `keyword_variants`
- `topic_cluster_name`
- `intent`
- `content_type`
- `content_type_llm`
- `volume`
- `kd`
- `variant_count`
- `internal_link_role`
- `page_brief`
- `url`

作用：

- 先按页面聚合
- 再生成页面机会对象

### 2. Strategy Layer

核心输入：

- `volume`
- `kd`
- `intent`
- `content_type`
- `internal_link_role`
- `variant_count`
- `page_brief`

参考输入：

- `priority`
- `topic_cluster_name`

不作为第一版主决策输入：

- `keyword`
- `url`
- `createdTime`

### 3. Production Layer

核心输入：

- `main_keyword`
- `all_keywords`
- `keyword_variants`
- `intent`
- `content_type`
- `internal_link_role`
- `topic_cluster_name`
- `page_brief`

可选输入：

- `url`

## 前端最少展示字段

机会列表卡片最少展示：

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

机会详情页建议展示：

- `main_keyword`
- `same_page_group_id`
- `topic_cluster_name`
- `intent`
- `content_type`
- `internal_link_role`
- `volume`
- `kd`
- `variant_count`
- `all_keywords`
- `page_brief`
- `why_now`

## 决策优先级

### 页面聚合

优先用：

- `same_page_group_id`

### 页面类型

优先级顺序：

1. `content_type`
2. `content_type_llm`
3. 标记为 `needs_review`

### 排序判断

优先级顺序：

1. `volume`
2. `kd`
3. `intent`
4. `content_type`
5. `internal_link_role`
6. `variant_count`
7. `page_brief`

`priority` 只做人工参考，不覆盖系统评分。

## 当前建议

如果你们马上开做，前端和策略层可以直接按这份文档执行：

- 前端按“前端最少展示字段”做列表和详情
- 策略层按“核心输入 / 参考输入”做打分
- 生产层只读“生产层核心输入”
