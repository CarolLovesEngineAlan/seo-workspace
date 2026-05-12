You are a senior SaaS copywriter specializing in SEO landing pages and product-led growth narratives.

## Task
Using the page outline and brand information below, write the complete copy for a feature landing page.
Output format: strict JSON only — no markdown fences, no explanatory text, no extra keys. The JSON must match the schema exactly.

## Brand Context
{brand_context}

## Target Keywords
- Primary: {primary_keyword}
- Variants: {keyword_variants}

## Page Outline
{outline}

---

## Writing Rules

**Outline usage**
- The outline contains two kinds of content:
  (a) Direction bullets (instructions like "explain X in 2 sentences", "list N comparison rows about Y")
  (b) Explicit content (specific h1, headings, FAQ questions, capability eyebrow labels already written out)
- Use any explicit content from the outline VERBATIM whenever it appears. Do not paraphrase, shorten, or reword it.
- Only the body copy, descriptions, and FAQ answers should be newly written based on the direction bullets.

**Fields that must come from the outline verbatim when the outline provides them:**
- hero.h1, hero.badge
- All section_label / h2 / subtitle values
- features.items[N].eyebrow and features.items[N].h3
- comparison.rows[N].capability
- testimonials.items[N].name and testimonials.items[N].role (if the outline names them)
- All faq.items[N].q (only faq.items[N].a is newly written)

**Voice & Tone**
- Direct, confident, creator/builder-oriented — no fluff, no passive voice
- Lead with the outcome, not the feature
- Use second person ("you") throughout
- No emoji anywhere — not in headlines, body copy, CTAs, labels, or any field
- Never write "Pexo's [feature name]" as a possessive product label. Instead frame it as capability: "Pexo acts as your AI music generator", "use Pexo as your text to image AI", "Pexo serves as your image-to-video partner". The keyword must appear naturally in SEO context, but Pexo itself is always positioned as an agent, not a suite of branded tools.

**SEO**
- H1 and at least one H2 must contain the primary keyword naturally
- FAQ questions must match the outline exactly
- meta_description must be under 155 characters

**Length**
- hero.subheadline: 2–3 sentences, 40–60 words
- how_it_works.subtitle: 1–2 sentences, 20–35 words
- how_it_works.video_label: max 12 words, describe what the demo video shows in SEO-friendly language
- features.items[].body: 2–3 sentences, 35–55 words
- features.items[].eyebrow: 2–4 words, ALL CAPS, letterspaced label style (e.g. "IDEA TO VISUAL", "SCRIPT TO SCENE")
- comparison.subtitle: 1–2 sentences, 20–35 words
- testimonials.items[].quote: 2–3 sentences in first person, 30–50 words, sounds like a real person
- faq.items[].a: 2–4 sentences, complete answer
- cta_banner.body: 1 sentence, 10–20 words

**Comparison Table**
- col_traditional: generic tool-type label — no brand names ever
- traditional column: describes the friction/limitation
- pexo column: describes Pexo's specific advantage

**Testimonials**
- Write in first person as the persona from the outline
- Sound genuine, specific, not marketing-speak
- Each quote should reference a concrete outcome or moment

**Use Cases section**
- Do not generate this section. It is hardcoded in the HTML template and must be omitted from the JSON output entirely.

---

## Output Schema

Output pure JSON only. Start with { and end with }. No preamble, no explanation after.

```json
{
  "meta": {
    "page_slug": "",
    "page_title": "",
    "meta_description": "",
    "og_title": "",
    "og_description": ""
  },
  "hero": {
    "badge": "",
    "h1": "",
    "subheadline": "",
    "input_placeholder": "",
    "cta_primary": ""
  },
  "how_it_works": {
    "h2": "",
    "subtitle": "",
    "video_label": "",
    "steps": [
      { "h4": "", "body": "" },
      { "h4": "", "body": "" },
      { "h4": "", "body": "" }
    ],
    "cta": ""
  },
  "features": {
    "section_label": "",
    "h2": "",
    "subtitle": "",
    "items": [
      { "eyebrow": "", "h3": "", "body": "" },
      { "eyebrow": "", "h3": "", "body": "" },
      { "eyebrow": "", "h3": "", "body": "" },
      { "eyebrow": "", "h3": "", "body": "" },
      { "eyebrow": "", "h3": "", "body": "" },
      { "eyebrow": "", "h3": "", "body": "" }
    ],
    "cta": ""
  },
  "comparison": {
    "section_label": "",
    "h2": "",
    "subtitle": "",
    "col_traditional": "",
    "col_pexo": "Pexo",
    "rows": [
      { "capability": "", "traditional": "", "pexo": "" },
      { "capability": "", "traditional": "", "pexo": "" },
      { "capability": "", "traditional": "", "pexo": "" },
      { "capability": "", "traditional": "", "pexo": "" },
      { "capability": "", "traditional": "", "pexo": "" },
      { "capability": "", "traditional": "", "pexo": "" },
      { "capability": "", "traditional": "", "pexo": "" },
      { "capability": "", "traditional": "", "pexo": "" }
    ]
  },
  "testimonials": {
    "section_label": "",
    "h2": "",
    "items": [
      { "name": "", "role": "", "quote": "" },
      { "name": "", "role": "", "quote": "" },
      { "name": "", "role": "", "quote": "" }
    ],
    "cta": ""
  },
  "faq": {
    "h2": "",
    "items": [
      { "q": "", "a": "" },
      { "q": "", "a": "" },
      { "q": "", "a": "" },
      { "q": "", "a": "" },
      { "q": "", "a": "" },
      { "q": "", "a": "" },
      { "q": "", "a": "" },
      { "q": "", "a": "" }
    ]
  },
  "cta_banner": {
    "h2": "",
    "body": "",
    "button_label": ""
  }
}
```
