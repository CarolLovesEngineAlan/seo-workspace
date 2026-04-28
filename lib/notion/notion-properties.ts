import type {
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

function richTextToPlain(rich: RichTextItemResponse[]): string {
  return rich.map((t) => t.plain_text).join("").trim();
}

export function getTitleProperty(
  page: PageObjectResponse,
  propertyName: string
): string {
  const prop = page.properties[propertyName];
  if (!prop || prop.type !== "title") return "";
  return richTextToPlain(prop.title);
}

export function getRichTextProperty(
  page: PageObjectResponse,
  propertyName: string
): string {
  const prop = page.properties[propertyName];
  if (!prop) return "";
  if (prop.type === "rich_text") {
    return richTextToPlain(prop.rich_text);
  }
  if (prop.type === "url" && prop.url) {
    return prop.url;
  }
  return "";
}

export function getNumberProperty(
  page: PageObjectResponse,
  propertyName: string
): number {
  const prop = page.properties[propertyName];
  if (!prop || prop.type !== "number" || prop.number === null) {
    return 0;
  }
  return Number(prop.number);
}

export function getSelectProperty(
  page: PageObjectResponse,
  propertyName: string
): string {
  const prop = page.properties[propertyName];
  if (!prop) return "";
  if (prop.type === "select" && prop.select) {
    return prop.select.name;
  }
  if (prop.type === "status" && prop.status) {
    return prop.status.name;
  }
  if (prop.type === "multi_select" && prop.multi_select.length > 0) {
    return prop.multi_select.map((s) => s.name).join(", ");
  }
  return "";
}

export function getUrlProperty(
  page: PageObjectResponse,
  propertyName: string
): string {
  const prop = page.properties[propertyName];
  if (!prop || prop.type !== "url") return "";
  return prop.url ?? "";
}

/**
 * same_page_group_id 在 Notion 里可能是 Number、Rich text 或 Title。
 */
export function getGroupIdProperty(
  page: PageObjectResponse,
  propertyName: string
): string | null {
  const prop = page.properties[propertyName];
  if (!prop) return null;

  if (prop.type === "number" && prop.number !== null) {
    return String(prop.number);
  }
  if (prop.type === "rich_text") {
    const s = richTextToPlain(prop.rich_text);
    return s.length > 0 ? s : null;
  }
  if (prop.type === "title") {
    const s = richTextToPlain(prop.title);
    return s.length > 0 ? s : null;
  }
  if (prop.type === "unique_id" && prop.unique_id) {
    return `${prop.unique_id.prefix ?? ""}${prop.unique_id.number}`;
  }
  return null;
}
