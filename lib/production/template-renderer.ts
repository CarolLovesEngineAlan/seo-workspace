import fs from "fs";
import path from "path";
import { parse, type HTMLElement } from "node-html-parser";

const TEMPLATES_DIR = path.join(process.cwd(), "lib/production/html-templates");

const PAGE_TEMPLATE_FILES: Record<string, string> = {
  feature_page: "features-template-v1.html",
  model_page: "model-template-v1.html",
  use_case_page: "use-case-template-v1.html",
};

type Json = Record<string, unknown>;

type SectionPlan = {
  jsonKey: string | null;
};

const FEATURE_PAGE_PLAN: SectionPlan[] = [
  { jsonKey: "hero" },
  { jsonKey: "how_it_works" },
  { jsonKey: "features" },
  { jsonKey: "comparison" },
  { jsonKey: null },
  { jsonKey: "testimonials" },
  { jsonKey: "faq" },
  { jsonKey: "cta_banner" },
];

const MODEL_PAGE_PLAN: SectionPlan[] = [
  { jsonKey: "hero" },
  { jsonKey: null },
  { jsonKey: "capabilities" },
  { jsonKey: "comparison" },
  { jsonKey: "how_to_use" },
  { jsonKey: null },
  { jsonKey: "faq" },
  { jsonKey: "cta_banner" },
];

const USE_CASE_PAGE_PLAN: SectionPlan[] = [
  { jsonKey: "hero" },
  { jsonKey: "showcase" },
  { jsonKey: "features" },
  { jsonKey: "testimonials" },
  { jsonKey: "faq" },
  { jsonKey: "cta_banner" },
];

const PAGE_PLANS: Record<string, SectionPlan[]> = {
  feature_page: FEATURE_PAGE_PLAN,
  model_page: MODEL_PAGE_PLAN,
  use_case_page: USE_CASE_PAGE_PLAN,
};

function readTemplate(file: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf-8");
}

function pickString(obj: Json, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickArray(obj: Json, keys: string[]): Json[] | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v) && v.length > 0) return v as Json[];
  }
  return undefined;
}

function setText(el: HTMLElement | null, text: string | undefined): void {
  if (!el || !text) return;
  el.set_content(text);
}

function fillSection(section: HTMLElement, data: Json): void {
  // Section-level badge / chip (e.g. hero use_case_label, "Why Pexo", etc.)
  const badge = pickString(data, [
    "use_case_label", "badge", "section_label", "eyebrow", "label",
  ]);
  if (badge) {
    const badgeEl = findEyebrowSpan(section);
    if (badgeEl) setText(badgeEl, badge);
  }

  // Title: h1 → h2 (whichever appears first)
  const heading = section.querySelector("h1") ?? section.querySelector("h2");
  setText(heading, pickString(data, ["h1", "h2", "title", "headline"]));

  // First paragraph directly inside section (skip inside items / nested groups)
  const firstP = findFirstTopLevelP(section);
  setText(firstP, pickString(data, ["subheadline", "subtitle", "description", "body"]));

  // CTA button text
  const cta = pickString(data, ["cta_primary", "cta_label", "cta", "button_label"]);
  if (cta) {
    const btn = findCtaElement(section);
    setText(btn, cta);
  }

  // Items array → fill each data-pexo-block="item"
  const items = pickArray(data, ["items", "steps", "rows", "faqs"]);
  if (items && items.length > 0) {
    fillItems(section, items);
  }
}

function findFirstTopLevelP(section: HTMLElement): HTMLElement | null {
  // Search BFS for a <p> that is not inside data-pexo-block="item"
  const stack: HTMLElement[] = [section];
  while (stack.length) {
    const el = stack.shift()!;
    for (const child of el.childNodes as unknown as HTMLElement[]) {
      if (!child || child.nodeType !== 1) continue;
      const tag = child.tagName?.toLowerCase();
      if (child.getAttribute?.("data-pexo-block") === "item") continue;
      if (tag === "p") return child;
      stack.push(child);
    }
  }
  return null;
}

function findCtaElement(section: HTMLElement): HTMLElement | null {
  const candidates = section.querySelectorAll("a, button");
  for (const el of candidates) {
    // Skip inputs / icon-only buttons / send buttons
    if (el.querySelector("svg") && (!el.text || el.text.trim().length < 3)) continue;
    if (el.getAttribute("aria-label")?.toLowerCase().includes("send")) continue;
    if (el.getAttribute("aria-label")?.toLowerCase().includes("attach")) continue;
    if (el.text && el.text.trim().length >= 3) return el;
  }
  return null;
}

function fillItems(section: HTMLElement, items: Json[]): void {
  const itemEls = section.querySelectorAll('[data-pexo-block="item"]');
  itemEls.forEach((el, i) => {
    const item = items[i];
    if (!item || typeof item !== "object") return;

    // Update <video> aria-label / title from item.video_label.
    // Works for both showcase and testimonial cards.
    fillVideoAriaLabel(el, item);

    if (isTestimonialItem(item)) {
      fillTestimonialItem(el, item);
    } else {
      fillDefaultItem(el, item);
    }
  });
}

function fillVideoAriaLabel(el: HTMLElement, item: Json): void {
  const label = pickString(item, ["video_label", "video_aria_label", "aria_label"]);
  if (!label) return;
  for (const v of el.querySelectorAll("video")) {
    v.setAttribute("aria-label", label);
    v.setAttribute("title", label);
  }
}

function isTestimonialItem(item: Json): boolean {
  // Testimonial cards have name + (quote|role|tags); features have eyebrow_label / h3
  return typeof item.name === "string" && (
    typeof item.quote === "string" ||
    typeof item.role === "string" ||
    typeof item.tags === "string"
  );
}

function fillTestimonialItem(el: HTMLElement, item: Json): void {
  // Spans inside the card, in document order (skip ones inside SVG)
  const spans = collectVisibleSpans(el);
  if (spans[0]) setText(spans[0], pickString(item, ["name"]));
  if (spans[1]) setText(spans[1], pickString(item, ["role", "title"]));
  if (spans[2]) setText(spans[2], pickString(item, ["tags"]));

  const ps = el.querySelectorAll("p");
  if (ps[0]) setText(ps[0], pickString(item, ["quote", "body", "text"]));
}

function fillDefaultItem(el: HTMLElement, item: Json): void {
  // Eyebrow / chip label (small label above the title in features cards)
  const eyebrow = pickString(item, [
    "eyebrow", "eyebrow_label", "chip", "tag", "kicker", "section_label",
  ]);
  if (eyebrow) {
    const eyebrowEl = findEyebrowSpan(el);
    setText(eyebrowEl, eyebrow);
  }

  // Title (h3/h4)
  const title = pickString(item, [
    "title", "label", "scenario_label", "name",
    "question", "q",
    "h3", "h4", "feature_label",
  ]);
  const titleEl = el.querySelector("h3") ?? el.querySelector("h4");
  setText(titleEl, title);

  // Body (first <p> inside the item)
  const body = pickString(item, [
    "body", "description",
    "answer", "a",
    "scenario_body", "summary", "quote", "text",
  ]);
  const ps = el.querySelectorAll("p");
  if (ps[0]) setText(ps[0], body);

  // Optional second <p> — italic "Great for: ..." caption / tag line
  const tail = pickString(item, ["great_for", "tags", "footnote", "caption"]);
  if (tail && ps[1]) setText(ps[1], tail);
}

function collectVisibleSpans(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const sp of root.querySelectorAll("span")) {
    const txt = sp.text?.trim();
    if (!txt) continue;
    let p: HTMLElement | null = sp.parentNode as HTMLElement | null;
    let insideSvg = false;
    while (p) {
      if (p.tagName?.toLowerCase() === "svg") { insideSvg = true; break; }
      p = p.parentNode as HTMLElement | null;
    }
    if (insideSvg) continue;
    out.push(sp);
  }
  return out;
}

// Find the eyebrow chip — first <span> inside the item that contains
// human-readable text (not just whitespace, not inside an SVG).
function findEyebrowSpan(item: HTMLElement): HTMLElement | null {
  const spans = item.querySelectorAll("span");
  for (const sp of spans) {
    const txt = sp.text?.trim();
    if (!txt) continue;
    // Skip spans nested inside an SVG (icon-only)
    let p: HTMLElement | null = sp.parentNode as HTMLElement | null;
    let insideSvg = false;
    while (p) {
      if (p.tagName?.toLowerCase() === "svg") { insideSvg = true; break; }
      p = p.parentNode as HTMLElement | null;
    }
    if (insideSvg) continue;
    return sp;
  }
  return null;
}

function buildHtmlDocument(meta: Json | undefined, body: string): string {
  const m = meta ?? {};
  const title = pickString(m, ["page_title", "og_title"]) ?? "Pexo Draft";
  const desc = pickString(m, ["meta_description", "og_description"]) ?? "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: linear-gradient(180deg,#ede6d0 0%,#f2ebd8 50%,#ede8da 100%); color:#0D0D1A; min-height:100vh; }
  .font-poppins { font-family: 'Poppins', sans-serif; }
  .font-inter { font-family: 'Inter', sans-serif; }
  main.draft-wrap { max-width: 1280px; margin: 0 auto; padding: 32px 16px; display: flex; flex-direction: column; gap: 24px; }
  .draft-bar { background: #1d7a5f; color: #fff; text-align: center; padding: 9px 16px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; position: sticky; top: 0; z-index: 100; }
</style>
</head>
<body>
<div class="draft-bar">Draft preview · For review only</div>
<main class="draft-wrap">
${body}
</main>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPageHtmlFromTemplate(pageType: string, json: unknown): string | null {
  const file = PAGE_TEMPLATE_FILES[pageType];
  const plan = PAGE_PLANS[pageType];
  if (!file || !plan) return null;

  let templateHtml: string;
  try {
    templateHtml = readTemplate(file);
  } catch {
    return null;
  }

  const root = parse(templateHtml, { lowerCaseTagName: false, comment: true });
  const data = (json ?? {}) as Json;

  // Apply per-section plan
  const sections = root.querySelectorAll('[data-pexo-block="section"]');
  sections.forEach((section, i) => {
    const cfg = plan[i];
    if (!cfg) return;
    if (cfg.jsonKey === null) return; // keep template content as-is
    const segment = data[cfg.jsonKey] as Json | undefined;
    if (!segment || typeof segment !== "object") return;
    fillSection(section, segment);
  });

  return buildHtmlDocument(data.meta as Json | undefined, root.toString());
}
