# QA Checklist

## 目标

这份清单定义 Production Layer 第一版唯一有效的 QA 规则。

原则：

- 只做可量化规则
- 不做模糊主观判断
- 任何失败必须返回明确原因

## 三层结构说明

QA 规则分三层，执行时按顺序合并：

1. **通用规则**（本文件）— 所有项目共用的结构性检查
2. **Preset 阈值**（`config/presets/[name].json` 的 `qa_thresholds`）— 按站点阶段和类型调整数字阈值
3. **项目关键词表**（`config/projects/[name].json` 的 `qa_intent_keywords`）— 项目特有的意图匹配词列表

---

## 通用规则（所有项目）

### 1. H1 包含主关键词

- 规则：`main_keyword` 必须出现在 H1 中
- 阈值：固定，不可配置
- 失败示例：H1 没有主词，或只出现部分词

### 2. 关键词覆盖率达标

- 规则：`all_keywords` 中至少 `qa_thresholds.keyword_coverage_min` 比例出现在正文
- 说明：第一版按字符串匹配即可
- 默认值：见当前项目 preset
- 失败示例：覆盖率低于阈值

### 3. 首段意图匹配

- 规则：首段必须包含至少一个与 `intent` 匹配的关键词，词表来自 `qa_intent_keywords`
- `commercial` / `transactional`：首段包含 `qa_intent_keywords.commercial_transactional` 中任意一词
- `informational`：首段包含 `qa_intent_keywords.informational` 中任意一词
- 默认词表：见当前项目 config
- 失败示例：首段只有通用描述，无产品/功能/教学导向

### 4. 内容长度达标

- 规则：正文字数 >= `qa_thresholds.min_word_count`
- 默认值：见当前项目 preset
- 失败示例：草稿过短，无法支撑 SEO 页面

### 5. 存在内部链接占位

- 规则：正文中至少包含 `qa_thresholds.min_internal_links` 个内部链接占位
- 第一版可接受形式：
  - `[Internal Link: xxx]`
  - `/blog/...`
  - `/feature/...`
- 默认值：见当前项目 preset

---

## Preset 阈值参考（按阶段 × 类型）

| Preset | keyword_coverage_min | min_word_count | min_internal_links | 说明 |
|---|---|---|---|---|
| `new-saas` | 0.60 | 800 | 1 | 新站快速起量，阈值宽松 |
| `growing-saas` | 0.65 | 1000 | 2 | 提升内容深度，建立权威 |
| `new-ecommerce` | 0.55 | 600 | 1 | 产品页天然较短 |
| `growing-content` | 0.60 | 1200 | 3 | 内容站靠长文和内链驱动排名 |

> 阈值实际值以 `config/presets/[name].json` 为准，本表仅作参考。

---

## QA 输出格式

```ts
type QaResult = {
  passed: boolean;
  issues: string[];
};
```
