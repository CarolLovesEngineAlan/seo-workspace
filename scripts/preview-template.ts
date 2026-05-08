import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { renderPageHtml } from "../lib/production/html-renderer.ts";

const [, , jsonPath, pageType, outPath] = process.argv;
if (!jsonPath || !pageType || !outPath) {
  console.error("Usage: tsx scripts/preview-template.mjs <json> <pageType> <out.html>");
  process.exit(1);
}
const json = JSON.parse(readFileSync(resolve(jsonPath), "utf-8"));
const html = renderPageHtml(pageType, json);
writeFileSync(resolve(outPath), html);
console.log(`Wrote ${outPath} (${html.length} bytes)`);
