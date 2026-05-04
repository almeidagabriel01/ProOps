"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { cn } from "@/lib/utils";

// tiptap-markdown augments editor.storage at runtime; no static type available
type MarkdownStorage = { markdown: { getMarkdown: () => string } };

export interface MarkdownEditorHandle {
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const MarkdownEditor = React.forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor({ value, onChange, className }, ref) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Markdown.configure({
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value ?? "",
    onUpdate({ editor: e }) {
      onChange((e.storage as unknown as MarkdownStorage).markdown.getMarkdown());
    },
    editorProps: {
      attributes: { class: "outline-none" },
    },
    immediatelyRender: false,
  });

  React.useImperativeHandle(
    ref,
    () => ({
      toggleBold: () => editor?.chain().focus().toggleBold().run(),
      toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
      toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
      toggleOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    }),
    [editor],
  );

  React.useEffect(() => {
    if (!editor) return;
    const current = (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();
    if (current !== (value ?? "")) {
      editor.commands.setContent(value ?? "");
    }
  }, [value, editor]);

  return (
    <div
      className={cn(
        "min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
        "focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
        "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[80px]",
        "[&_.ProseMirror_p]:my-0 [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_em]:italic",
        "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:my-1",
        "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:my-1",
        "[&_.ProseMirror_li]:my-0.5",
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
});
