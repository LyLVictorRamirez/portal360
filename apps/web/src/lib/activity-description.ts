export type ActivityDescriptionMark =
  | Readonly<{ type: "bold" }>
  | Readonly<{ type: "italic" }>
  | Readonly<{ type: "underline" }>
  | Readonly<{ attrs: Readonly<{ href: string }>; type: "link" }>;

export type ActivityDescriptionNode = Readonly<{
  attrs?: Readonly<{ level?: number; start?: number }>;
  content?: readonly ActivityDescriptionNode[];
  marks?: readonly ActivityDescriptionMark[];
  text?: string;
  type: "bulletList" | "doc" | "hardBreak" | "listItem" | "orderedList" | "paragraph" | "text";
}>;

export type ActivityDescription = Readonly<{
  content: readonly ActivityDescriptionNode[];
  type: "doc";
}>;

export const emptyActivityDescription: ActivityDescription = { content: [], type: "doc" };

export function isActivityDescription(value: unknown): value is ActivityDescription {
  return (
    isNode(value) &&
    value.type === "doc" &&
    Array.isArray(value.content) &&
    value.content.every(isNode)
  );
}

export function activityDescriptionText(value: ActivityDescription | null): string {
  if (!value || !Array.isArray(value.content)) return "";
  return textFromNodes(value.content, "\n").trim();
}

function isNode(value: unknown): value is ActivityDescriptionNode {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const node = value as Record<string, unknown>;
  if (
    !["bulletList", "doc", "hardBreak", "listItem", "orderedList", "paragraph", "text"].includes(
      String(node.type),
    )
  )
    return false;
  if (node.text !== undefined && typeof node.text !== "string") return false;
  return (
    (node.content === undefined || (Array.isArray(node.content) && node.content.every(isNode))) &&
    (node.marks === undefined || Array.isArray(node.marks))
  );
}

function textFromNodes(
  nodes: readonly ActivityDescriptionNode[] | undefined,
  separator: string,
): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      const ownText = node.text ?? "";
      const childText = node.content
        ? textFromNodes(node.content, node.type === "paragraph" ? "" : "\n")
        : "";
      return [ownText, childText].filter(Boolean).join(ownText && childText ? " " : "");
    })
    .join(separator);
}
