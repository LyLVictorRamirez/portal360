export type ActivityDescriptionMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { attrs: { href: string }; type: "link" };

export interface ActivityDescriptionNode {
  content?: ActivityDescriptionNode[];
  marks?: ActivityDescriptionMark[];
  text?: string;
  type: "bulletList" | "doc" | "hardBreak" | "listItem" | "orderedList" | "paragraph" | "text";
}

export interface ActivityDescription {
  content: ActivityDescriptionNode[];
  type: "doc";
}

const allowedNodeTypes = new Set<ActivityDescriptionNode["type"]>([
  "bulletList",
  "doc",
  "hardBreak",
  "listItem",
  "orderedList",
  "paragraph",
  "text",
]);
const allowedMarkTypes = new Set<ActivityDescriptionMark["type"]>([
  "bold",
  "italic",
  "underline",
  "link",
]);

export function normalizeActivityDescription(
  value: unknown,
): ActivityDescription | null | undefined {
  if (value === undefined || value === null) return value;
  const document = sanitizeNode(value, undefined, 0);
  if (document.type !== "doc" || !document.content)
    throw new Error("Invalid Activity description.");
  const description = document as ActivityDescription;
  if (descriptionTextLength(description) > 2000)
    throw new Error("Activity description must contain at most 2000 characters.");
  return descriptionTextLength(description) ? description : null;
}

export function isActivityDescription(value: unknown): value is ActivityDescription {
  try {
    return normalizeActivityDescription(value) !== undefined;
  } catch {
    return false;
  }
}

function sanitizeNode(
  value: unknown,
  parent: ActivityDescriptionNode["type"] | undefined,
  depth: number,
): ActivityDescriptionNode {
  if (depth > 12 || !value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Activity description.");
  const node = value as Record<string, unknown>;
  if (!allowedNodeTypes.has(node.type as ActivityDescriptionNode["type"]))
    throw new Error("Invalid Activity description.");
  const type = node.type as ActivityDescriptionNode["type"];
  if (parent && !allowedChild(parent, type)) throw new Error("Invalid Activity description.");
  if (type === "text") {
    if (typeof node.text !== "string") throw new Error("Invalid Activity description.");
    return { marks: sanitizeMarks(node.marks), text: node.text, type };
  }
  if (type === "hardBreak") return { type };
  if (type === "paragraph" && node.content === undefined) return { content: [], type };
  if (!Array.isArray(node.content)) throw new Error("Invalid Activity description.");
  return { content: node.content.map((child) => sanitizeNode(child, type, depth + 1)), type };
}

function allowedChild(
  parent: ActivityDescriptionNode["type"],
  child: ActivityDescriptionNode["type"],
): boolean {
  if (parent === "doc")
    return child === "paragraph" || child === "bulletList" || child === "orderedList";
  if (parent === "paragraph") return child === "text" || child === "hardBreak";
  if (parent === "bulletList" || parent === "orderedList") return child === "listItem";
  if (parent === "listItem")
    return child === "paragraph" || child === "bulletList" || child === "orderedList";
  return false;
}

function sanitizeMarks(value: unknown): ActivityDescriptionMark[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid Activity description.");
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      throw new Error("Invalid Activity description.");
    const mark = candidate as Record<string, unknown>;
    if (!allowedMarkTypes.has(mark.type as ActivityDescriptionMark["type"]))
      throw new Error("Invalid Activity description.");
    if (mark.type !== "link") return { type: mark.type } as ActivityDescriptionMark;
    const href = (mark.attrs as Record<string, unknown> | undefined)?.href;
    if (typeof href !== "string" || !isHttpUrl(href))
      throw new Error("Invalid Activity description link.");
    return { attrs: { href }, type: "link" };
  });
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function descriptionTextLength(node: ActivityDescriptionNode): number {
  return (
    (node.text?.length ?? 0) +
    (node.content?.reduce((sum, child) => sum + descriptionTextLength(child), 0) ?? 0)
  );
}
