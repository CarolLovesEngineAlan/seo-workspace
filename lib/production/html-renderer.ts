/**
 * Renders SEO page copy JSON to a standalone HTML preview file.
 * Pure TypeScript — no React or server dependencies.
 * Output is for stakeholder review and developer handoff, not production deployment.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function str(s: string | undefined | null): string {
  return s?.trim() ?? "";
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --brand:#1d7a5f;--dark:#1c221d;--muted:#5e6860;
  --border:rgba(28,34,29,0.12);--bg:#f5f0e8;--bg2:#ede8da;
  --r:16px;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--dark);line-height:1.6;font-size:16px}
a{color:var(--brand);text-decoration:none}

/* Draft banner */
.draft-bar{background:var(--brand);color:#fff;text-align:center;padding:9px 16px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;position:sticky;top:0;z-index:100}

/* Layout */
.wrap{max-width:960px;margin:0 auto;padding:0 28px}
section{padding:72px 0;border-bottom:1px solid var(--border)}
section:last-of-type{border-bottom:none}

/* Typography */
h1{font-size:clamp(2rem,5vw,3rem);font-weight:800;line-height:1.15;margin-bottom:20px}
h2{font-size:clamp(1.4rem,3vw,2rem);font-weight:700;line-height:1.25;margin-bottom:14px}
h3{font-size:1.1rem;font-weight:600;line-height:1.3;margin-bottom:8px}
h4{font-size:1rem;font-weight:600;margin-bottom:6px}
p{color:var(--muted);margin-bottom:14px}
p:last-child{margin-bottom:0}

/* Labels */
.label{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--brand);margin-bottom:10px}
.badge{display:inline-block;background:rgba(29,122,95,.12);color:var(--brand);font-size:12px;font-weight:700;padding:5px 14px;border-radius:999px;margin-bottom:18px;letter-spacing:.04em}

/* Hero */
.hero{text-align:center;padding:96px 0 80px}
.hero h1{max-width:780px;margin:0 auto 20px}
.hero .sub{font-size:1.05rem;max-width:620px;margin:0 auto 28px;color:var(--muted)}

/* Input mockup */
.input-mock{display:flex;align-items:center;gap:12px;border:1.5px solid var(--border);border-radius:999px;padding:13px 22px;background:#fff;max-width:560px;margin:0 auto 28px;font-size:14px;color:var(--muted);box-shadow:0 4px 16px rgba(28,34,29,.07)}
.input-mock::before{content:'✦';color:var(--brand);font-size:16px;flex-shrink:0}

/* Button */
.btn{display:inline-block;background:var(--brand);color:#fff !important;font-size:14px;font-weight:700;padding:13px 30px;border-radius:999px;letter-spacing:.02em;box-shadow:0 6px 18px rgba(29,122,95,.3)}
.btn-outline{display:inline-block;border:1.5px solid var(--border);color:var(--dark) !important;font-size:14px;font-weight:600;padding:11px 26px;border-radius:999px;background:#fff}

/* Steps */
.steps{display:grid;gap:20px;margin-top:32px}
@media(min-width:600px){.steps{grid-template-columns:repeat(3,1fr)}}
.step{background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:24px}
.step-num{font-size:11px;font-weight:700;color:var(--brand);letter-spacing:.06em;margin-bottom:10px}
.step h4{color:var(--dark)}
.step p{font-size:14px}

/* Feature grid */
.features-grid{display:grid;gap:18px;margin-top:32px}
@media(min-width:580px){.features-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:860px){.features-grid{grid-template-columns:repeat(3,1fr)}}
.feat-card{background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:24px}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--brand);margin-bottom:10px;display:block}
.feat-card h3{font-size:1rem}
.feat-card p{font-size:14px}
.great-for{display:inline-block;font-size:11px;font-weight:600;color:var(--muted);margin-top:12px;padding:3px 10px;background:rgba(28,34,29,.06);border-radius:999px}

/* Comparison table */
.table-wrap{overflow-x:auto;margin-top:28px;border-radius:var(--r);box-shadow:0 2px 12px rgba(28,34,29,.08)}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:480px}
thead tr th{padding:14px 18px;text-align:left;font-weight:700;font-size:13px}
thead tr th:first-child{background:var(--dark);color:#fff;border-radius:var(--r) 0 0 0}
thead tr th:not(:first-child){background:var(--brand);color:#fff}
thead tr th:last-child{border-radius:0 var(--r) 0 0}
tbody tr td{padding:13px 18px;border-bottom:1px solid var(--border);background:#fff}
tbody tr:last-child td{border-bottom:none}
tbody tr:last-child td:first-child{border-radius:0 0 0 var(--r)}
tbody tr:last-child td:last-child{border-radius:0 0 var(--r) 0}
tbody tr:nth-child(even) td{background:rgba(28,34,29,.02)}
td.pexo-col{color:var(--brand);font-weight:600}
.sources{font-size:12px;color:var(--muted);margin-top:12px}

/* Testimonials */
.testi-grid{display:grid;gap:18px;margin-top:28px}
@media(min-width:600px){.testi-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:860px){.testi-grid{grid-template-columns:repeat(3,1fr)}}
.testi-card{background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:24px}
.testi-card blockquote{font-style:italic;color:var(--dark);margin-bottom:18px;font-size:15px;line-height:1.55}
.testi-name{font-weight:700;font-size:14px}
.testi-role{color:var(--muted);font-size:13px}
.testi-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.testi-tag{font-size:11px;padding:3px 9px;background:rgba(29,122,95,.09);color:var(--brand);border-radius:999px;font-weight:600}
.testi-4{grid-template-columns:repeat(2,1fr)!important}

/* FAQ */
.faq-list{margin-top:28px;display:flex;flex-direction:column;gap:10px}
details{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden}
summary{padding:17px 22px;font-weight:600;font-size:15px;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px}
summary::-webkit-details-marker{display:none}
.faq-chevron{color:var(--brand);font-size:20px;flex-shrink:0;transition:transform .2s}
details[open] .faq-chevron{transform:rotate(45deg)}
.faq-answer{padding:0 22px 18px;font-size:14px;color:var(--muted);line-height:1.65}

/* CTA Banner */
.cta-banner{background:var(--dark);border-radius:24px;text-align:center;padding:80px 32px;margin:56px 0 0}
.cta-banner h2{color:#fff}
.cta-banner p{color:rgba(255,255,255,.65)}
.cta-banner .btn{margin-top:24px}

/* Gallery placeholder */
.media-placeholder{background:rgba(28,34,29,.05);border:2px dashed var(--border);border-radius:var(--r);height:280px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;font-weight:500;margin-top:24px}

/* Showcase placeholder */
.showcase-wrap{margin-top:24px}

/* Section helpers */
.section-cta{margin-top:28px}
.text-center{text-align:center}
.mt-4{margin-top:16px}
.mt-6{margin-top:24px}
`;

// ─── Page wrapper ─────────────────────────────────────────────────────────────

function wrapPage(opts: {
  title: string;
  desc: string;
  ogTitle?: string;
  ogDesc?: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.desc)}">
<meta property="og:title" content="${esc(opts.ogTitle ?? opts.title)}">
<meta property="og:description" content="${esc(opts.ogDesc ?? opts.desc)}">
<meta name="robots" content="noindex,nofollow">
<style>${CSS}</style>
</head>
<body>
<div class="draft-bar">DRAFT PREVIEW — Not for publication</div>
${opts.body}
</body>
</html>`;
}

// ─── FAQ section (shared) ─────────────────────────────────────────────────────

function renderFaqSection(h2: string | undefined, items: Array<{ q?: string; a?: string }> | undefined): string {
  if (!items?.length) return "";
  const itemsHtml = items
    .filter((it) => it.q || it.a)
    .map(
      (it) => `
      <details>
        <summary>${esc(it.q)}<span class="faq-chevron">+</span></summary>
        <div class="faq-answer">${esc(it.a)}</div>
      </details>`
    )
    .join("");
  return `
  <section>
    <div class="wrap">
      <h2>${esc(h2)}</h2>
      <div class="faq-list">${itemsHtml}</div>
    </div>
  </section>`;
}

// ─── CTA Banner (shared) ──────────────────────────────────────────────────────

function renderCtaBanner(data: { h2?: string; body?: string; button_label?: string } | undefined): string {
  if (!data) return "";
  return `
  <section>
    <div class="wrap">
      <div class="cta-banner">
        <h2>${esc(data.h2)}</h2>
        <p>${esc(data.body)}</p>
        <a href="#" class="btn">${esc(data.button_label)}</a>
      </div>
    </div>
  </section>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export type FeatureStep = { h4?: string; body?: string };
export type FeatureItem = { eyebrow?: string; h3?: string; body?: string };
export type ComparisonRow = { capability?: string; traditional?: string; pexo?: string };
export type Testimonial = { name?: string; role?: string; quote?: string };
export type FaqItem = { q?: string; a?: string };

export type FeaturePageData = {
  meta?: { page_slug?: string; page_title?: string; meta_description?: string; og_title?: string; og_description?: string };
  hero?: { badge?: string; h1?: string; subheadline?: string; input_placeholder?: string; cta_primary?: string };
  how_it_works?: { h2?: string; subtitle?: string; steps?: FeatureStep[]; cta?: string };
  features?: { section_label?: string; h2?: string; subtitle?: string; items?: FeatureItem[]; cta?: string };
  comparison?: { section_label?: string; h2?: string; subtitle?: string; col_traditional?: string; col_pexo?: string; rows?: ComparisonRow[] };
  testimonials?: { section_label?: string; h2?: string; items?: Testimonial[]; cta?: string };
  faq?: { h2?: string; items?: FaqItem[] };
  cta_banner?: { h2?: string; body?: string; button_label?: string };
};

function renderFeaturePage(data: FeaturePageData): string {
  const m = data.meta ?? {};
  const hero = data.hero ?? {};
  const hiw = data.how_it_works ?? {};
  const feats = data.features ?? {};
  const comp = data.comparison ?? {};
  const testi = data.testimonials ?? {};

  // Hero
  const heroHtml = `
  <section class="hero">
    <div class="wrap">
      ${hero.badge ? `<div class="badge">${esc(hero.badge)}</div>` : ""}
      <h1>${esc(hero.h1)}</h1>
      <p class="sub">${esc(hero.subheadline)}</p>
      ${hero.input_placeholder ? `<div class="input-mock">${esc(hero.input_placeholder)}</div>` : ""}
      ${hero.cta_primary ? `<a href="#" class="btn">${esc(hero.cta_primary)}</a>` : ""}
    </div>
  </section>`;

  // How it works
  const stepsHtml = (hiw.steps ?? [])
    .map(
      (s, i) => `
      <div class="step">
        <div class="step-num">STEP ${i + 1}</div>
        <h4>${esc(s.h4)}</h4>
        <p>${esc(s.body)}</p>
      </div>`
    )
    .join("");
  const hiwHtml = `
  <section>
    <div class="wrap">
      <h2>${esc(hiw.h2)}</h2>
      <p>${esc(hiw.subtitle)}</p>
      <div class="steps">${stepsHtml}</div>
      ${hiw.cta ? `<div class="section-cta"><a href="#" class="btn">${esc(hiw.cta)}</a></div>` : ""}
    </div>
  </section>`;

  // Features
  const featItemsHtml = (feats.items ?? [])
    .map(
      (it) => `
      <div class="feat-card">
        ${it.eyebrow ? `<span class="eyebrow">${esc(it.eyebrow)}</span>` : ""}
        <h3>${esc(it.h3)}</h3>
        <p>${esc(it.body)}</p>
      </div>`
    )
    .join("");
  const featsHtml = `
  <section>
    <div class="wrap">
      ${feats.section_label ? `<span class="label">${esc(feats.section_label)}</span>` : ""}
      <h2>${esc(feats.h2)}</h2>
      <p>${esc(feats.subtitle)}</p>
      <div class="features-grid">${featItemsHtml}</div>
      ${feats.cta ? `<div class="section-cta mt-6"><a href="#" class="btn">${esc(feats.cta)}</a></div>` : ""}
    </div>
  </section>`;

  // Comparison
  const rowsHtml = (comp.rows ?? [])
    .map(
      (r) => `
      <tr>
        <td>${esc(r.capability)}</td>
        <td>${esc(r.traditional)}</td>
        <td class="pexo-col">${esc(r.pexo)}</td>
      </tr>`
    )
    .join("");
  const compHtml = `
  <section>
    <div class="wrap">
      ${comp.section_label ? `<span class="label">${esc(comp.section_label)}</span>` : ""}
      <h2>${esc(comp.h2)}</h2>
      <p>${esc(comp.subtitle)}</p>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Capability</th>
            <th>${esc(comp.col_traditional ?? "Traditional Tools")}</th>
            <th>${esc(comp.col_pexo ?? "Pexo")}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  </section>`;

  // Testimonials
  const testiItemsHtml = (testi.items ?? [])
    .map(
      (t) => `
      <div class="testi-card">
        <blockquote>"${esc(t.quote)}"</blockquote>
        <div class="testi-name">${esc(t.name)}</div>
        <div class="testi-role">${esc(t.role)}</div>
      </div>`
    )
    .join("");
  const testiHtml = `
  <section>
    <div class="wrap">
      ${testi.section_label ? `<span class="label">${esc(testi.section_label)}</span>` : ""}
      <h2>${esc(testi.h2)}</h2>
      <div class="testi-grid">${testiItemsHtml}</div>
      ${testi.cta ? `<div class="section-cta mt-6 text-center"><a href="#" class="btn">${esc(testi.cta)}</a></div>` : ""}
    </div>
  </section>`;

  const body = [
    heroHtml,
    hiwHtml,
    featsHtml,
    compHtml,
    testiHtml,
    renderFaqSection(data.faq?.h2, data.faq?.items),
    renderCtaBanner(data.cta_banner),
  ].join("\n");

  return wrapPage({
    title: str(m.page_title) || "Feature Page Draft",
    desc: str(m.meta_description),
    ogTitle: str(m.og_title),
    ogDesc: str(m.og_description),
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// USE CASE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export type UseCaseFeatureItem = { eyebrow_label?: string; h3?: string; body?: string; great_for?: string };
export type UseCaseTestimonial = { name?: string; role?: string; quote?: string; tags?: string };

export type UseCasePageData = {
  meta?: { page_title?: string; meta_description?: string; og_title?: string; og_description?: string };
  hero?: { use_case_label?: string; h1?: string; description?: string; cta_label?: string };
  showcase?: { h2?: string };
  features?: { section_label?: string; h2?: string; items?: UseCaseFeatureItem[] };
  testimonials?: { h2?: string; items?: UseCaseTestimonial[] };
  faq?: { h2?: string; items?: FaqItem[] };
  cta_banner?: { h2?: string; body?: string; button_label?: string };
};

function renderUseCasePage(data: UseCasePageData): string {
  const m = data.meta ?? {};
  const hero = data.hero ?? {};
  const showcase = data.showcase ?? {};
  const feats = data.features ?? {};
  const testi = data.testimonials ?? {};

  // Hero
  const heroHtml = `
  <section class="hero">
    <div class="wrap">
      ${hero.use_case_label ? `<div class="badge">${esc(hero.use_case_label)}</div>` : ""}
      <h1>${esc(hero.h1)}</h1>
      <p class="sub">${esc(hero.description)}</p>
      ${hero.cta_label ? `<a href="#" class="btn">${esc(hero.cta_label)}</a>` : ""}
    </div>
  </section>`;

  // Showcase
  const showcaseHtml = showcase.h2
    ? `
  <section>
    <div class="wrap">
      <h2>${esc(showcase.h2)}</h2>
      <div class="media-placeholder">[Video / Gallery Placeholder]</div>
    </div>
  </section>`
    : "";

  // Features
  const featItemsHtml = (feats.items ?? [])
    .map(
      (it) => `
      <div class="feat-card">
        ${it.eyebrow_label ? `<span class="eyebrow">${esc(it.eyebrow_label)}</span>` : ""}
        <h3>${esc(it.h3)}</h3>
        <p>${esc(it.body)}</p>
        ${it.great_for ? `<span class="great-for">Great for: ${esc(it.great_for)}</span>` : ""}
      </div>`
    )
    .join("");
  const featsHtml = `
  <section>
    <div class="wrap">
      ${feats.section_label ? `<span class="label">${esc(feats.section_label)}</span>` : ""}
      <h2>${esc(feats.h2)}</h2>
      <div class="features-grid">${featItemsHtml}</div>
    </div>
  </section>`;

  // Testimonials (4 items → 2-col grid)
  const testiCount = (testi.items ?? []).length;
  const testiGridClass = testiCount >= 4 ? "testi-grid testi-4" : "testi-grid";
  const testiItemsHtml = (testi.items ?? [])
    .map((t) => {
      const tags = str(t.tags)
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => `<span class="testi-tag">${esc(tag)}</span>`)
        .join("");
      return `
      <div class="testi-card">
        <blockquote>"${esc(t.quote)}"</blockquote>
        <div class="testi-name">${esc(t.name)}</div>
        <div class="testi-role">${esc(t.role)}</div>
        ${tags ? `<div class="testi-tags">${tags}</div>` : ""}
      </div>`;
    })
    .join("");
  const testiHtml = `
  <section>
    <div class="wrap">
      <h2>${esc(testi.h2)}</h2>
      <div class="${testiGridClass}">${testiItemsHtml}</div>
    </div>
  </section>`;

  const body = [
    heroHtml,
    showcaseHtml,
    featsHtml,
    testiHtml,
    renderFaqSection(data.faq?.h2, data.faq?.items),
    renderCtaBanner(data.cta_banner),
  ].join("\n");

  return wrapPage({
    title: str(m.page_title) || "Use Case Page Draft",
    desc: str(m.meta_description),
    ogTitle: str(m.og_title),
    ogDesc: str(m.og_description),
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export type ModelCapabilityItem = { eyebrow?: string; h3?: string; body?: string };
export type ModelComparisonRow = { feature?: string; values?: string[] };

export type ModelPageData = {
  meta?: { model_name?: string; page_slug?: string; page_title?: string; meta_description?: string; og_title?: string; og_description?: string };
  hero?: { badge?: string; h1?: string; description?: string; cta_label?: string };
  gallery?: { section_label?: string; h2?: string; subtitle?: string; cta_label?: string };
  capabilities?: { h2?: string; subtitle?: string; items?: ModelCapabilityItem[] };
  comparison?: { h2?: string; subtitle?: string; sources_html?: string; col_headers?: string[]; rows?: ModelComparisonRow[] };
  how_to_use?: { h2?: string; subtitle?: string; steps?: Array<{ title?: string; body?: string }>; cta_label?: string };
  use_cases?: { h2?: string; subtitle?: string; cta_label?: string };
  faq?: { h2?: string; items?: FaqItem[] };
  cta_banner?: { h2?: string; body?: string; button_label?: string };
};

function renderModelPage(data: ModelPageData): string {
  const m = data.meta ?? {};
  const hero = data.hero ?? {};
  const gallery = data.gallery ?? {};
  const caps = data.capabilities ?? {};
  const comp = data.comparison ?? {};
  const htu = data.how_to_use ?? {};
  const uc = data.use_cases ?? {};

  // Hero
  const heroHtml = `
  <section class="hero">
    <div class="wrap">
      ${hero.badge ? `<div class="badge">${esc(hero.badge)}</div>` : ""}
      <h1>${esc(hero.h1)}</h1>
      <p class="sub">${esc(hero.description)}</p>
      ${hero.cta_label ? `<a href="#" class="btn">${esc(hero.cta_label)}</a>` : ""}
    </div>
  </section>`;

  // Gallery
  const galleryHtml = `
  <section>
    <div class="wrap">
      ${gallery.section_label ? `<span class="label">${esc(gallery.section_label)}</span>` : ""}
      <h2>${esc(gallery.h2)}</h2>
      <p>${esc(gallery.subtitle)}</p>
      <div class="media-placeholder">[Output Gallery — Video / Image Examples]</div>
      ${gallery.cta_label ? `<div class="section-cta mt-6"><a href="#" class="btn">${esc(gallery.cta_label)}</a></div>` : ""}
    </div>
  </section>`;

  // Capabilities
  const capItemsHtml = (caps.items ?? [])
    .map(
      (it) => `
      <div class="feat-card">
        ${it.eyebrow ? `<span class="eyebrow">${esc(it.eyebrow)}</span>` : ""}
        <h3>${esc(it.h3)}</h3>
        <p>${esc(it.body)}</p>
      </div>`
    )
    .join("");
  const capsHtml = `
  <section>
    <div class="wrap">
      <h2>${esc(caps.h2)}</h2>
      <p>${esc(caps.subtitle)}</p>
      <div class="features-grid">${capItemsHtml}</div>
    </div>
  </section>`;

  // Comparison (multi-column)
  const colHeaders = comp.col_headers ?? [];
  const theadHtml = `<tr>${colHeaders.map((h, i) => `<th${i === 0 ? "" : ""}>${esc(h)}</th>`).join("")}</tr>`;
  const rowsHtml = (comp.rows ?? [])
    .map((r) => {
      const cells = (r.values ?? [])
        .map((v, i) => `<td${i === colHeaders.length - 1 ? ' class="pexo-col"' : ""}>${esc(v)}</td>`)
        .join("");
      return `<tr><td>${esc(r.feature)}</td>${cells}</tr>`;
    })
    .join("");
  const compHtml = `
  <section>
    <div class="wrap">
      <h2>${esc(comp.h2)}</h2>
      <p>${esc(comp.subtitle)}</p>
      <div class="table-wrap">
        <table>
          <thead>${theadHtml}</thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${comp.sources_html ? `<div class="sources">Sources: ${comp.sources_html}</div>` : ""}
    </div>
  </section>`;

  // How to use
  const htuStepsHtml = (htu.steps ?? [])
    .map(
      (s, i) => `
      <div class="step">
        <div class="step-num">STEP ${i + 1}</div>
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.body)}</p>
      </div>`
    )
    .join("");
  const htuHtml = `
  <section>
    <div class="wrap">
      <h2>${esc(htu.h2)}</h2>
      <p>${esc(htu.subtitle)}</p>
      <div class="steps">${htuStepsHtml}</div>
      ${htu.cta_label ? `<div class="section-cta mt-6"><a href="#" class="btn">${esc(htu.cta_label)}</a></div>` : ""}
    </div>
  </section>`;

  // Use cases
  const ucHtml = uc.h2
    ? `
  <section>
    <div class="wrap">
      <h2>${esc(uc.h2)}</h2>
      <p>${esc(uc.subtitle)}</p>
      <div class="media-placeholder">[Use Cases Grid — Hardcoded in Template]</div>
      ${uc.cta_label ? `<div class="section-cta mt-6"><a href="#" class="btn">${esc(uc.cta_label)}</a></div>` : ""}
    </div>
  </section>`
    : "";

  const body = [
    heroHtml,
    galleryHtml,
    capsHtml,
    compHtml,
    htuHtml,
    ucHtml,
    renderFaqSection(data.faq?.h2, data.faq?.items),
    renderCtaBanner(data.cta_banner),
  ].join("\n");

  return wrapPage({
    title: str(m.page_title) || `${str(m.model_name) || "Model"} Page Draft`,
    desc: str(m.meta_description),
    ogTitle: str(m.og_title),
    ogDesc: str(m.og_description),
    body,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main dispatch
// ═══════════════════════════════════════════════════════════════════════════════

import { renderPageHtmlFromTemplate } from "./template-renderer";

export function renderPageHtml(pageType: string, json: unknown): string {
  // Prefer the design template (lib/production/html-templates/*.html)
  const fromTemplate = renderPageHtmlFromTemplate(pageType, json);
  if (fromTemplate) return fromTemplate;

  const data = json as Record<string, unknown>;
  switch (pageType) {
    case "feature_page":
      return renderFeaturePage(data as FeaturePageData);
    case "use_case_page":
      return renderUseCasePage(data as UseCasePageData);
    case "model_page":
      return renderModelPage(data as ModelPageData);
    default:
      // Fallback: dump JSON in a readable format
      return wrapPage({
        title: `${pageType} Draft`,
        desc: "",
        body: `
        <section>
          <div class="wrap">
            <span class="label">${esc(pageType)}</span>
            <h2>Page Copy (JSON)</h2>
            <p>No HTML renderer for this page type yet. Here is the raw JSON:</p>
            <pre style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:24px;overflow:auto;font-size:13px;line-height:1.6;margin-top:16px">${esc(JSON.stringify(json, null, 2))}</pre>
          </div>
        </section>`,
      });
  }
}
