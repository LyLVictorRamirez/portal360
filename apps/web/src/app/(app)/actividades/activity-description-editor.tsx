"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconUnderline,
} from "@tabler/icons-react";
import { forwardRef, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  activityDescriptionText,
  emptyActivityDescription,
  type ActivityDescription,
  type ActivityDescriptionNode,
} from "../../../lib/activity-description";
import { normalizeActivityLinkUrl } from "../../../lib/activity-links";

const editorExtensions = [
  StarterKit.configure({
    heading: false,
    link: {
      autolink: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      openOnClick: false,
    },
  }),
];

export function ActivityDescriptionEditor({
  onChange,
  value,
}: Readonly<{
  onChange: (value: ActivityDescription | null) => void;
  value: ActivityDescription | null;
}>) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkSelection = useRef<{ from: number; to: number } | null>(null);
  const editor = useEditor({
    content: (value ?? emptyActivityDescription) as never,
    editorProps: {
      attributes: {
        "aria-label": "Descripción de la Actividad",
        class:
          "min-h-32 px-3 py-2 text-sm text-foreground outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    extensions: editorExtensions,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      const document = currentEditor.getJSON() as ActivityDescription;
      onChange(activityDescriptionText(document) ? document : null);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value ?? emptyActivityDescription;
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next))
      editor.commands.setContent(next as never, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;
  const captureLinkSelection = () => {
    linkSelection.current = {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
  };
  const addLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = normalizeActivityLinkUrl(linkUrl);
    if (!href) {
      setLinkError("Ingresa una URL válida que empiece por http:// o https://.");
      return;
    }

    const selection = linkSelection.current;
    if (!selection || selection.from === selection.to) {
      setLinkError("Selecciona el texto que quieres convertir en enlace.");
      return;
    }

    editor.chain().focus().setTextSelection(selection).setLink({ href }).run();
    setLinkOpen(false);
    setLinkUrl("");
    setLinkError(null);
  };

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring/30">
      <div
        className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-1.5"
        role="toolbar"
      >
        <EditorButton
          active={editor.isActive("bold")}
          icon={IconBold}
          label="Negrita"
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <EditorButton
          active={editor.isActive("italic")}
          icon={IconItalic}
          label="Cursiva"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <EditorButton
          active={editor.isActive("underline")}
          icon={IconUnderline}
          label="Subrayado"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <span aria-hidden="true" className="mx-1 h-5 border-l border-border" />
        <EditorButton
          active={editor.isActive("bulletList")}
          icon={IconList}
          label="Lista con viñetas"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <EditorButton
          active={editor.isActive("orderedList")}
          icon={IconListNumbers}
          label="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <span aria-hidden="true" className="mx-1 h-5 border-l border-border" />
        <Popover
          onOpenChange={(open) => {
            setLinkOpen(open);
            if (!open) {
              setLinkError(null);
              linkSelection.current = null;
              setLinkUrl("");
            }
          }}
          open={linkOpen}
        >
          <PopoverTrigger asChild>
            <EditorButton
              active={editor.isActive("link")}
              icon={IconLink}
              label="Agregar enlace"
              onClick={captureLinkSelection}
              onMouseDown={captureLinkSelection}
            />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-4" side="bottom">
            <form className="space-y-3" onSubmit={addLink}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="activity-link-url">
                  URL del enlace
                </label>
                <input
                  aria-describedby={linkError ? "activity-link-url-error" : undefined}
                  aria-invalid={Boolean(linkError)}
                  autoFocus
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  id="activity-link-url"
                  onChange={(event) => {
                    setLinkUrl(event.target.value);
                    if (linkError) setLinkError(null);
                  }}
                  placeholder="https://ejemplo.com"
                  type="url"
                  value={linkUrl}
                />
                {linkError ? (
                  <p className="text-xs text-destructive" id="activity-link-url-error">
                    {linkError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pega la dirección que quieres enlazar.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setLinkOpen(false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button size="sm" type="submit">
                  Agregar enlace
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
        <EditorButton
          disabled={!editor.can().undo()}
          icon={IconArrowBackUp}
          label="Deshacer"
          onClick={() => editor.chain().focus().undo().run()}
        />
        <EditorButton
          disabled={!editor.can().redo()}
          icon={IconArrowForwardUp}
          label="Rehacer"
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      <EditorContent editor={editor} />
      <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        {activityDescriptionText(editor.getJSON() as ActivityDescription).length}/2000 caracteres
      </p>
    </div>
  );
}

export function ActivityDescriptionContent({
  value,
}: Readonly<{ value: ActivityDescription | null }>) {
  if (!value || !value.content.length)
    return <p className="text-muted-foreground">Sin descripción</p>;
  return (
    <div className="space-y-2 break-words text-foreground">{value.content.map(renderNode)}</div>
  );
}

const EditorButton = forwardRef<
  HTMLButtonElement,
  Readonly<{
    active?: boolean;
    disabled?: boolean;
    icon: typeof IconBold;
    label: string;
    onClick: () => void;
    onMouseDown?: () => void;
  }>
>(function EditorButton(
  { active = false, disabled = false, icon: Icon, label, onClick, onMouseDown },
  ref,
) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-background text-primary shadow-xs" : ""}`}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      ref={ref}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={17} />
    </button>
  );
});

function renderNode(node: ActivityDescriptionNode, index: number) {
  const key = `${node.type}-${index}`;
  if (node.type === "paragraph") return <p key={key}>{renderChildren(node.content)}</p>;
  if (node.type === "bulletList")
    return (
      <ul className="list-disc space-y-1 pl-5" key={key}>
        {renderChildren(node.content)}
      </ul>
    );
  if (node.type === "orderedList")
    return (
      <ol className="list-decimal space-y-1 pl-5" key={key}>
        {renderChildren(node.content)}
      </ol>
    );
  if (node.type === "listItem") return <li key={key}>{renderChildren(node.content)}</li>;
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "text") return <TextWithMarks key={key} node={node} />;
  return null;
}

function renderChildren(content: readonly ActivityDescriptionNode[] | undefined) {
  return content?.map(renderNode) ?? null;
}

function TextWithMarks({ node }: Readonly<{ node: ActivityDescriptionNode }>) {
  let rendered: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") rendered = <strong>{rendered}</strong>;
    if (mark.type === "italic") rendered = <em>{rendered}</em>;
    if (mark.type === "underline") rendered = <u>{rendered}</u>;
    if (mark.type === "link")
      rendered = (
        <a href={mark.attrs.href} rel="noopener noreferrer" target="_blank">
          {rendered}
        </a>
      );
  }
  return <>{rendered}</>;
}
