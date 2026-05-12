// One-off rewriter: normalize data-pexo-label values in feature/model templates
// to the same semantic shape used by use-case-template-v2.
// Usage: npx tsx scripts/rewrite-template-labels.ts

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parse } from "node-html-parser";

const ROOT = process.cwd();

type Plan = {
  file: string;
  sectionLabels: string[];
  itemPrefixFor: (sectionLabel: string) => string;
};

const FEATURE_PLAN: Plan = {
  file: "doc/templates/features-template-v1.html",
  sectionLabels: [
    "hero",
    "how-it-works",
    "features",
    "comparison",
    "use-cases",
    "testimonials",
    "faq",
    "cta",
  ],
  itemPrefixFor: (s) => ({
    "hero": "hero-item",
    "how-it-works": "step",
    "features": "feature",
    "comparison": "comparison-row",
    "use-cases": "use-case",
    "testimonials": "testimonial",
    "faq": "faq",
    "cta": "cta-button",
  })[s] ?? "item",
};

const MODEL_PLAN: Plan = {
  file: "doc/templates/model-template-v1.html",
  sectionLabels: [
    "hero",
    "gallery",
    "capabilities",
    "comparison",
    "how-to-use",
    "use-cases",
    "faq",
    "cta",
  ],
  itemPrefixFor: (s) => ({
    "hero": "hero-item",
    "gallery": "gallery-video",
    "capabilities": "capability",
    "comparison": "comparison-row",
    "how-to-use": "step",
    "use-cases": "use-case",
    "faq": "faq",
    "cta": "cta-button",
  })[s] ?? "item",
};

function rewrite(plan: Plan): { srcPath: string; libPath: string } {
  const srcPath = resolve(ROOT, plan.file);
  const html = readFileSync(srcPath, "utf-8");
  const root = parse(html, { lowerCaseTagName: false, comment: true });

  const sections = root.querySelectorAll('[data-pexo-block="section"]');
  if (sections.length !== plan.sectionLabels.length) {
    throw new Error(
      `${plan.file}: expected ${plan.sectionLabels.length} sections, found ${sections.length}`
    );
  }

  sections.forEach((section, sIdx) => {
    const secLabel = plan.sectionLabels[sIdx];
    section.setAttribute("data-pexo-label", secLabel);

    const groups = section.querySelectorAll('[data-pexo-block="group"]');
    groups.forEach((g, gIdx) => {
      g.setAttribute("data-pexo-label", `${secLabel}-group-${gIdx + 1}`);
    });

    const items = section.querySelectorAll('[data-pexo-block="item"]');
    const itemPrefix = plan.itemPrefixFor(secLabel);
    items.forEach((it, iIdx) => {
      it.setAttribute("data-pexo-label", `${itemPrefix}-${iIdx + 1}`);
    });
  });

  const out = root.toString();
  writeFileSync(srcPath, out);
  const libPath = resolve(ROOT, "lib/production/html-templates", plan.file.split("/").pop()!);
  writeFileSync(libPath, out);
  return { srcPath, libPath };
}

for (const plan of [FEATURE_PLAN, MODEL_PLAN]) {
  const { srcPath, libPath } = rewrite(plan);
  console.log(`OK  ${plan.file}`);
  console.log(`     -> ${srcPath}`);
  console.log(`     -> ${libPath}`);
}
