# Brief Template

> 初稿 — SEO 审校后请直接修改本文件。
> AI 生成 brief 时以本文件为唯一结构依据，不得自行发挥结构。

---

## 一、Intent → 页面写法规则

### commercial（商业意图）

用户正在对比方案，还没决定用哪个。

**首段要求：**
点明用户痛点 + Pexo 解决方案，不超过 3 句话。
必须包含：产品名 / 功能名 / 能力描述之一。

**页面结构：**
1. 问题帧（用户现在卡在哪）
2. 方案介绍（Pexo 怎么解决）
3. 功能证明（截图、workflow、对比）
4. 社会证明（可选）
5. CTA（注册 / 试用）

**禁止：**
- 开篇写行业背景或趋势
- 大量使用"AI is changing..."类通用句

---

### transactional（交易意图）

用户已经决定要做这件事，在找具体工具或 API。

**首段要求：**
动词开头，直接说 Pexo 能做什么。
必须包含：动作词（generate / create / build / integrate）之一。

**页面结构：**
1. 能力声明（Pexo 做什么，一句话）
2. 核心参数或规格（API endpoint / 支持格式 / 输出质量）
3. 接入或使用方式（step-by-step）
4. 示例输出（视频截帧 / 代码示例）
5. CTA（立即使用 / 申请 API access）

**禁止：**
- 开篇写行业趋势
- 把页面写成 blog 风格的解释文章

---

### informational（信息意图）

用户在学习或理解某个概念/方法，不一定有立即购买意图。

**首段要求：**
定义问题或解释核心概念，用"what / how / why"切入。
不得在首段推产品。

**页面结构：**
1. 概念定义或问题描述
2. 为什么重要（背景 / 使用场景）
3. 方法步骤（how-to 结构）
4. 常见误区或注意事项（可选）
5. 延伸阅读（内链到相关 feature / use-case 页）

**禁止：**
- 首段推销产品
- 以 CTA 结尾（informational 页适合用"learn more"式软 CTA）

---

## 二、brief_v2 输出模板

AI 生成 brief 时必须输出以下结构，字段不得省略：

```
Goal:
[这页的 SEO 目标：要排哪个词 / 解决什么用户问题]

Target reader:
[谁在搜这个词，他们的决策阶段是什么]

Intent:
[commercial / transactional / informational]

Content type:
[feature / use-case / model / blog]

Structure:
[H1 建议 → Intro（1-2句）→ Section 1 标题 → Section 2 标题 → Section 3 标题 → CTA 建议]

Must include:
[必须提到的功能名、能力、关键词组]

Internal links:
[至少链到哪类页面，例如：/feature/xxx, /blog/xxx]

Avoid:
[不要写的内容，例如：不要开篇讲行业趋势]

Estimated word count:
[目标字数范围]
```

---

## 三、brief_v2 示例（commercial / feature 页）

```
Goal:
排名 "ai photo editor for ecommerce"，吸引正在对比 AI 图片处理工具的电商卖家。

Target reader:
独立站卖家或电商运营，已有产品图但质量参差，正在找批量处理方案。

Intent:
commercial

Content type:
feature

Structure:
H1: AI Photo Editor for Ecommerce: Clean, Convert-Ready Product Images at Scale
Intro: 直接点明手工修图的低效 + Pexo 批量方案
Section 1: What Makes Ecommerce Photo Editing Different
Section 2: How Pexo Handles Product Photo Cleanup
Section 3: Before vs After: Real Catalog Examples
Section 4: How to Get Started
CTA: Try Pexo free → 注册链接

Must include:
"bulk editing", "product photo", "ecommerce catalog", "background removal", Pexo 功能名

Internal links:
/feature/background-removal, /use-case/ecommerce-product-video, /blog/product-photo-tips

Avoid:
不要开篇写"AI is revolutionizing ecommerce"类通用句
不要超过 30% 篇幅讲行业背景

Estimated word count:
900–1200 words
```
