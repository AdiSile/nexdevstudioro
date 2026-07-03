"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { Editor } from "@tiptap/react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import TableExtension from "@tiptap/extension-table";
import TableRowExtension from "@tiptap/extension-table-row";
import TableCellExtension from "@tiptap/extension-table-cell";
import TableHeaderExtension from "@tiptap/extension-table-header";
import HighlightExtension from "@tiptap/extension-highlight";
import { Mark, Node } from "@tiptap/core";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Link,
  Unlink,
  Image,
  Table,
  Highlighter,
  Sparkles,
  Youtube,
  X,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ─── Custom Underline Mark ──────────────────────────────────────────

const UnderlineMark = Mark.create({
  name: "underline",
  parseHTML() {
    return [{ tag: "u" }, { style: "text-decoration: underline" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["u", HTMLAttributes, 0];
  },
  addCommands() {
    return {
      toggleUnderline:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-u": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

// ─── Custom Media Embed Node ────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mediaEmbed: {
      insertMediaEmbed: (options: { src: string; provider: string }) => ReturnType;
    };
  }
}

interface MediaEmbedOptions {
  src: string;
  provider: string;
}

const MediaEmbedNode = Node.create({
  name: "mediaEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      provider: { default: "youtube" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-media-embed]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            src: el.getAttribute("data-src"),
            provider: el.getAttribute("data-provider") || "youtube",
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { src, provider } = HTMLAttributes as unknown as MediaEmbedOptions;
    const embedUrl = getEmbedUrl(src ?? "", provider ?? "youtube");

    return [
      "div",
      {
        "data-media-embed": "true",
        "data-src": src,
        "data-provider": provider,
        class: "media-embed-wrapper my-4",
      },
      [
        "div",
        {
          class: "relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-900",
        },
        [
          "iframe",
          {
            src: embedUrl,
            class: "absolute inset-0 h-full w-full",
            frameborder: "0",
            allow:
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
            allowfullscreen: "true",
          },
        ],
      ],
    ];
  },
  addCommands() {
    return {
      insertMediaEmbed:
        (options: MediaEmbedOptions) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

function getEmbedUrl(src: string, provider: string): string {
  if (provider === "youtube") {
    const match =
      src.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      );
    const videoId = match?.[1] ?? src;
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (provider === "vimeo") {
    const match = src.match(/vimeo\.com\/(\d+)/);
    const videoId = match?.[1] ?? src;
    return `https://player.vimeo.com/video/${videoId}`;
  }
  return src;
}

// ─── Variant Definitions ────────────────────────────────────────────

const editorWrapperVariants = cva(
  [
    "relative flex flex-col",
    "rounded-md border border-border",
    "bg-surface",
    "transition-all duration-200",
    "ring-offset-surface",
    "focus-within:border-brand-500",
    "focus-within:ring-2 focus-within:ring-brand-500/20",
    "focus-within:shadow-elevation-1",
  ],
  {
    variants: {
      variant: {
        default: [],
        minimal: [
          "border-0 rounded-none bg-transparent",
          "focus-within:ring-0 focus-within:border-transparent",
          "focus-within:shadow-none",
        ],
      },
      validation: {
        none: [],
        valid: [
          "border-success-500",
          "focus-within:border-success-500",
          "focus-within:ring-success-500/20",
        ],
        invalid: [
          "border-danger-500",
          "focus-within:border-danger-500",
          "focus-within:ring-danger-500/20",
        ],
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      validation: "none",
    },
  },
);

const toolbarButtonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "h-8 w-8 rounded",
    "text-text-tertiary hover:text-text-primary",
    "hover:bg-surface-secondary",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-1",
    "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
  ],
  {
    variants: {
      active: {
        true: "bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300",
      },
    },
  },
);

const helperTextVariants = cva(["mt-1.5 flex items-center gap-1.5 text-xs"], {
  variants: {
    validation: {
      none: "text-text-tertiary",
      valid: "text-success-600",
      invalid: "text-danger-600",
    },
  },
  defaultVariants: {
    validation: "none",
  },
});

// ─── Types ──────────────────────────────────────────────────────────

type EditorVariant = "default" | "minimal";
type EditorValidation = "none" | "valid" | "invalid";

export interface RichEditorProps {
  /** Visual variant */
  variant?: EditorVariant;
  /** Validation state */
  validation?: EditorValidation;
  /** Expand to full width */
  fullWidth?: boolean;
  /** Label text */
  label?: string;
  /** Mark as required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Hint / helper text */
  hint?: string;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Controlled content (HTML) */
  value?: string;
  /** Default content (uncontrolled) */
  defaultValue?: string;
  /** Called when content changes */
  onChange?: (html: string, markdown: string, plainText: string) => void;
  /** Called when markdown content changes */
  onMarkdownChange?: (markdown: string) => void;
  /** Show toolbar. Default: true */
  showToolbar?: boolean;
  /** Enable markdown paste conversion. Default: true */
  enableMarkdown?: boolean;
  /** Enable media embed. Default: true */
  enableMediaEmbed?: boolean;
  /** Enable AI assist. Default: true */
  enableAiAssist?: boolean;
  /** AI assist callback - receives current text and prompt, returns response */
  onAiAssist?: (prompt: string, context: string) => Promise<string>;
  /** Toolbar position */
  toolbarPosition?: "top" | "bottom";
  /** Min height of editor area */
  minHeight?: string;
  /** Max height of editor area (triggers scroll) */
  maxHeight?: string;
  /** Disable editing */
  disabled?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** ID for the editor; auto-generated if not provided */
  id?: string;
  /** Additional CSS classes */
  className?: string;
}

export interface RichEditorRef {
  /** Get the TipTap editor instance */
  editor: Editor | null;
  /** Get content as HTML */
  getHTML: () => string;
  /** Get content as Markdown */
  getMarkdown: () => string;
  /** Get content as plain text */
  getText: () => string;
  /** Set content from HTML */
  setContent: (html: string) => void;
  /** Focus the editor */
  focus: () => void;
  /** Clear all content */
  clear: () => void;
  /** Insert content at cursor position */
  insertContent: (content: string) => void;
}

// ─── HTML to Markdown converter (bidirectional) ─────────────────────

function htmlToMarkdown(html: string): string {
  if (!html || html === "<p></p>") return "";

  let md = html;

  // Headings
  md = md.replace(
    /<h1[^>]*>(.*?)<\/h1>/gi,
    (_, content) => `# ${stripHtml(content)}\n\n`,
  );
  md = md.replace(
    /<h2[^>]*>(.*?)<\/h2>/gi,
    (_, content) => `## ${stripHtml(content)}\n\n`,
  );
  md = md.replace(
    /<h3[^>]*>(.*?)<\/h3>/gi,
    (_, content) => `### ${stripHtml(content)}\n\n`,
  );

  // Bold & Italic
  md = md.replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, "**$2**");
  md = md.replace(/<(em|i)>(.*?)<\/(em|i)>/gi, "*$2*");
  md = md.replace(/<u>(.*?)<\/u>/gi, "__$1__");
  md = md.replace(/<s>(.*?)<\/s>/gi, "~~$1~~");
  md = md.replace(/<code>(.*?)<\/code>/gi, "`$1`");

  // Links
  md = md.replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Images
  md = md.replace(
    /<img[^>]*src="(.*?)"[^>]*alt="(.*?)"[^>]*\/?>/gi,
    "![$2]($1)",
  );
  md = md.replace(/<img[^>]*src="(.*?)"[^>]*\/?>/gi, "![]($1)");

  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<\/?(ul|ol)[^>]*>/gi, "\n");

  // Blockquote
  md = md.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, content) => {
      return content
        .split("\n")
        .filter((l: string) => l.trim())
        .map((l: string) => `> ${l}`)
        .join("\n");
    },
  );

  // Code blocks
  md = md.replace(
    /<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi,
    "```\n$1\n```\n\n",
  );

  // Media embeds
  md = md.replace(
    /<div[^>]*data-media-embed[^>]*data-src="(.*?)"[^>]*data-provider="(.*?)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, src, provider) =>
      provider === "youtube"
        ? `@[youtube](${src})\n\n`
        : `@[${provider}](${src})\n\n`,
  );

  // Horizontal rule
  md = md.replace(/<hr[^>]*\/?>/gi, "---\n\n");

  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");

  // Line breaks
  md = md.replace(/<br[^>]*\/?>/gi, "\n");

  // Clean up
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#x27;/g, "'");
  md = md.trim();

  return md;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

// ─── Markdown to HTML converter ─────────────────────────────────────

function markdownToHtml(md: string): string {
  if (!md) return "";

  // Pre-process media embed syntax @[youtube](url) before marked
  let processed = md.replace(
    /@\[(youtube|vimeo)\]\((.*?)\)/g,
    (_, provider, src) => {
      return `<div data-media-embed="true" data-src="${src}" data-provider="${provider}"></div>`;
    },
  );

  const rawHtml = marked.parse(processed, { breaks: true }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ["iframe", "div"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "data-media-embed",
      "data-src",
      "data-provider",
    ],
  });
}

// ─── Component ──────────────────────────────────────────────────────

const RichEditor = forwardRef<RichEditorRef, RichEditorProps>((props, ref) => {
  const {
    variant = "default",
    validation: validationProp,
    fullWidth,
    label,
    required = false,
    error,
    hint,
    placeholder = "Write something...",
    value,
    defaultValue,
    onChange,
    onMarkdownChange,
    showToolbar = true,
    enableMarkdown = true,
    enableMediaEmbed = true,
    enableAiAssist = true,
    onAiAssist,
    toolbarPosition = "top",
    minHeight = "12rem",
    maxHeight,
    disabled = false,
    readOnly = false,
    id: idProp,
    className,
  } = props;

  // ── State ──────────────────────────────────────────────────────
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [showEmbedInput, setShowEmbedInput] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedProvider, setEmbedProvider] = useState<"youtube" | "vimeo">("youtube");
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  const autoId = React.useId();
  const editorId = idProp ?? `rich-editor-${autoId}`;
  const errorId = `${editorId}-error`;
  const hintId = `${editorId}-hint`;
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const embedInputRef = useRef<HTMLInputElement>(null);
  const previousValueRef = useRef<string | undefined>(value);

  const validation = error ? "invalid" : validationProp ?? "none";

  // ── TipTap Editor ───────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder }),
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: "text-brand-500 underline underline-offset-2 hover:text-brand-600 cursor-pointer",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      ImageExtension.configure({
        HTMLAttributes: {
          class: "max-w-full rounded-lg my-4",
        },
      }),
      TableExtension.configure({
        resizable: true,
      }),
      TableRowExtension,
      TableCellExtension,
      TableHeaderExtension,
      HighlightExtension.configure({
        multicolor: true,
      }),
      UnderlineMark,
      MediaEmbedNode,
    ],
    content: value ?? defaultValue ?? "",
    editable: !disabled && !readOnly,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "px-4 py-3 min-h-[12rem]",
          "outline-none",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      const plainText = editor.getText();
      onChange?.(html, markdown, plainText);
      onMarkdownChange?.(markdown);
    },
    onFocus: () => setIsEditorFocused(true),
    onBlur: () => setIsEditorFocused(false),
  });

  // ── Sync controlled value ──────────────────────────────────────
  useEffect(() => {
    if (
      editor &&
      value !== undefined &&
      value !== previousValueRef.current &&
      value !== editor.getHTML()
    ) {
      previousValueRef.current = value;
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  // ── Expose imperative handle ───────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      editor,
      getHTML: () => editor?.getHTML() ?? "",
      getMarkdown: () => htmlToMarkdown(editor?.getHTML() ?? ""),
      getText: () => editor?.getText() ?? "",
      setContent: (html: string) => {
        editor?.commands.setContent(html);
      },
      focus: () => {
        editor?.commands.focus();
      },
      clear: () => {
        editor?.commands.clearContent();
      },
      insertContent: (content: string) => {
        editor?.commands.insertContent(content);
      },
    }),
    [editor],
  );

  // ── Toolbar actions ────────────────────────────────────────────
  const isActive = useCallback(
    (name: string, attrs?: Record<string, unknown>) => {
      if (!editor) return false;
      return editor.isActive(name, attrs);
    },
    [editor],
  );

  const handleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const handleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const handleUnderline = useCallback(() => editor?.chain().focus().toggleUnderline().run(), [editor]);
  const handleStrike = useCallback(() => editor?.chain().focus().toggleStrike().run(), [editor]);
  const handleCode = useCallback(() => editor?.chain().focus().toggleCode().run(), [editor]);
  const handleHighlight = useCallback(() => editor?.chain().focus().toggleHighlight().run(), [editor]);
  const handleH1 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const handleH2 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const handleH3 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);
  const handleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const handleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const handleBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const handleHorizontalRule = useCallback(() => editor?.chain().focus().setHorizontalRule().run(), [editor]);
  const handleUndo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
  const handleRedo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

  // ── Link handling ─────────────────────────────────────────────
  const handleLinkClick = useCallback(() => {
    if (editor?.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      const previousUrl = editor?.getAttributes("link").href ?? "";
      setLinkUrl(previousUrl);
      setShowLinkInput(true);
      setTimeout(() => linkInputRef.current?.focus(), 100);
    }
  }, [editor]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleCancelLink = useCallback(() => {
    setShowLinkInput(false);
    setLinkUrl("");
  }, []);

  // ── Image handling ────────────────────────────────────────────
  const handleImageClick = useCallback(() => {
    setImageUrl("");
    setImageAlt("");
    setShowImageInput(true);
    setTimeout(() => imageInputRef.current?.focus(), 100);
  }, []);

  const handleSetImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    editor
      .chain()
      .focus()
      .setImage({ src: imageUrl, alt: imageAlt })
      .run();
    setShowImageInput(false);
    setImageUrl("");
    setImageAlt("");
  }, [editor, imageUrl, imageAlt]);

  const handleCancelImage = useCallback(() => {
    setShowImageInput(false);
    setImageUrl("");
    setImageAlt("");
  }, []);

  // ── Table handling ────────────────────────────────────────────
  const handleTableClick = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  // ── Media Embed handling ──────────────────────────────────────
  const handleEmbedClick = useCallback(() => {
    setEmbedUrl("");
    setEmbedProvider("youtube");
    setShowEmbedInput(true);
    setTimeout(() => embedInputRef.current?.focus(), 100);
  }, []);

  const handleSetEmbed = useCallback(() => {
    if (!editor || !embedUrl) return;
    editor
      .chain()
      .focus()
      .insertMediaEmbed({ src: embedUrl, provider: embedProvider })
      .run();
    setShowEmbedInput(false);
    setEmbedUrl("");
    setEmbedProvider("youtube");
  }, [editor, embedUrl, embedProvider]);

  const handleCancelEmbed = useCallback(() => {
    setShowEmbedInput(false);
    setEmbedUrl("");
    setEmbedProvider("youtube");
  }, []);

  // ── AI Assist ─────────────────────────────────────────────────
  const handleAiAssist = useCallback(async () => {
    if (!editor || !aiPrompt.trim()) return;

    setAiLoading(true);
    setAiError("");

    try {
      const context = editor.getText();
      let result: string;

      if (onAiAssist) {
        result = await onAiAssist(aiPrompt, context);
      } else {
        result = await defaultAiAssist(aiPrompt, context);
      }

      setAiResponse(result);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "AI assist failed",
      );
    } finally {
      setAiLoading(false);
    }
  }, [editor, aiPrompt, onAiAssist]);

  const handleInsertAiResponse = useCallback(() => {
    if (!editor || !aiResponse) return;
    editor.chain().focus().insertContent(aiResponse).run();
    setAiPrompt("");
    setAiResponse("");
    setIsAiPanelOpen(false);
  }, [editor, aiResponse]);

  const handleDiscardAiResponse = useCallback(() => {
    setAiPrompt("");
    setAiResponse("");
    setAiError("");
  }, []);

  // ── Markdown paste handler ────────────────────────────────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!enableMarkdown || !editor) return;

      const text = e.clipboardData.getData("text/plain");
      const looksLikeMarkdown =
        /^#{1,6}\s|^\*{1,3}.*\*{1,3}|^`{3}|^>\s|^[-*+]\s|^\d+\.\s|^\[.*\]\(.*\)|^!\[.*\]\(.*\)|^@\[(youtube|vimeo)\]/.test(
          text,
        );

      if (looksLikeMarkdown) {
        e.preventDefault();
        const html = markdownToHtml(text);
        editor.commands.insertContent(html);
      }
    },
    [editor, enableMarkdown],
  );

  // ── Close popovers on Escape ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLinkInput) handleCancelLink();
        if (showImageInput) handleCancelImage();
        if (showEmbedInput) handleCancelEmbed();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showLinkInput,
    showImageInput,
    showEmbedInput,
    handleCancelLink,
    handleCancelImage,
    handleCancelEmbed,
  ]);

  // ── Toolbar rendering ─────────────────────────────────────────
  const renderToolbar = () => {
    if (!editor || !showToolbar) return null;

    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5",
          "bg-surface-secondary/50",
          toolbarPosition === "bottom" && "border-b-0 border-t",
        )}
        role="toolbar"
        aria-label="Text formatting toolbar"
        aria-controls={editorId}
      >
        <ToolbarButton
          onClick={handleUndo}
          disabled={!editor.can().undo()}
          label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleRedo}
          disabled={!editor.can().redo()}
          label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={handleBold}
          active={isActive("bold")}
          label="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleItalic}
          active={isActive("italic")}
          label="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleUnderline}
          active={isActive("underline")}
          label="Underline"
        >
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleStrike}
          active={isActive("strike")}
          label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleCode}
          active={isActive("code")}
          label="Inline code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleHighlight}
          active={isActive("highlight")}
          label="Highlight"
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={handleH1}
          active={isActive("heading", { level: 1 })}
          label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleH2}
          active={isActive("heading", { level: 2 })}
          label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleH3}
          active={isActive("heading", { level: 3 })}
          label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={handleBulletList}
          active={isActive("bulletList")}
          label="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleOrderedList}
          active={isActive("orderedList")}
          label="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={handleBlockquote}
          active={isActive("blockquote")}
          label="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleHorizontalRule} label="Horizontal rule">
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          onClick={handleLinkClick}
          active={isActive("link")}
          label="Insert link"
        >
          {isActive("link") ? (
            <Unlink className="h-4 w-4" />
          ) : (
            <Link className="h-4 w-4" />
          )}
        </ToolbarButton>
        <ToolbarButton onClick={handleImageClick} label="Insert image">
          <Image className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={handleTableClick} label="Insert table">
          <Table className="h-4 w-4" />
        </ToolbarButton>

        {enableMediaEmbed && (
          <ToolbarButton onClick={handleEmbedClick} label="Embed media">
            <Youtube className="h-4 w-4" />
          </ToolbarButton>
        )}

        {enableAiAssist && (
          <>
            <ToolbarDivider />
            <ToolbarButton
              onClick={() => setIsAiPanelOpen((prev) => !prev)}
              active={isAiPanelOpen}
              label="AI Assist"
            >
              <Sparkles className="h-4 w-4" />
            </ToolbarButton>
          </>
        )}
      </div>
    );
  };

  // ── Inline popovers ───────────────────────────────────────────
  const renderLinkInput = () => {
    if (!showLinkInput) return null;
    return (
      <div className="flex items-center gap-2 border-t border-border bg-surface-secondary/30 px-4 py-2">
        <Link className="h-4 w-4 text-text-tertiary shrink-0" />
        <input
          ref={linkInputRef}
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSetLink();
            if (e.key === "Escape") handleCancelLink();
          }}
          placeholder="https://example.com"
          className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <button
          type="button"
          onClick={handleSetLink}
          className="inline-flex items-center gap-1 rounded bg-brand-500 px-2 py-1 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <Check className="h-3 w-3" />
          Apply
        </button>
        <button
          type="button"
          onClick={handleCancelLink}
          className="inline-flex items-center justify-center h-6 w-6 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const renderImageInput = () => {
    if (!showImageInput) return null;
    return (
      <div className="flex flex-col gap-2 border-t border-border bg-surface-secondary/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-text-tertiary shrink-0" />
          <input
            ref={imageInputRef}
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSetImage();
              if (e.key === "Escape") handleCancelImage();
            }}
            placeholder="https://example.com/image.jpg"
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary shrink-0 pl-6">Alt:</span>
          <input
            type="text"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSetImage();
              if (e.key === "Escape") handleCancelImage();
            }}
            placeholder="Image description"
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
          <button
            type="button"
            onClick={handleSetImage}
            className="inline-flex items-center gap-1 rounded bg-brand-500 px-2 py-1 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <Check className="h-3 w-3" />
            Insert
          </button>
          <button
            type="button"
            onClick={handleCancelImage}
            className="inline-flex items-center justify-center h-6 w-6 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderEmbedInput = () => {
    if (!showEmbedInput) return null;
    return (
      <div className="flex flex-col gap-2 border-t border-border bg-surface-secondary/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Youtube className="h-4 w-4 text-text-tertiary shrink-0" />
          <input
            ref={embedInputRef}
            type="url"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSetEmbed();
              if (e.key === "Escape") handleCancelEmbed();
            }}
            placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary shrink-0 pl-6">Type:</span>
          <select
            value={embedProvider}
            onChange={(e) =>
              setEmbedProvider(e.target.value as "youtube" | "vimeo")
            }
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
          </select>
          <button
            type="button"
            onClick={handleSetEmbed}
            className="inline-flex items-center gap-1 rounded bg-brand-500 px-2 py-1 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
          >
            <Check className="h-3 w-3" />
            Embed
          </button>
          <button
            type="button"
            onClick={handleCancelEmbed}
            className="inline-flex items-center justify-center h-6 w-6 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // ── AI Panel ──────────────────────────────────────────────────
  const renderAiPanel = () => {
    if (!isAiPanelOpen || !enableAiAssist) return null;

    return (
      <div
        ref={aiPanelRef}
        className="flex flex-col gap-3 border-t border-border bg-surface-secondary/20 px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-500" />
            AI Assist
          </span>
          <button
            type="button"
            onClick={() => setIsAiPanelOpen(false)}
            className="inline-flex items-center justify-center h-6 w-6 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
            aria-label="Close AI panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAiAssist();
              }
            }}
            placeholder="Ask AI to write, rewrite, summarize..."
            className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
          />
          <button
            type="button"
            onClick={handleAiAssist}
            disabled={aiLoading || !aiPrompt.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {aiLoading ? "Thinking..." : "Generate"}
          </button>
        </div>

        {aiError && (
          <div className="flex items-center gap-2 rounded-md bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {aiError}
          </div>
        )}

        {aiResponse && (
          <div className="flex flex-col gap-2">
            <div className="rounded-md border border-border bg-surface p-3 text-sm text-text-primary max-h-48 overflow-y-auto prose prose-sm dark:prose-invert">
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(markdownToHtml(aiResponse)),
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleDiscardAiResponse}
                className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-tertiary transition-colors"
              >
                <X className="h-3 w-3" />
                Discard
              </button>
              <button
                type="button"
                onClick={handleInsertAiResponse}
                className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
              >
                <Check className="h-3 w-3" />
                Insert
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Helper Text / Error ────────────────────────────────────────
  const renderHelperText = () => {
    if (error) {
      return (
        <p
          id={errorId}
          role="alert"
          className={cn(helperTextVariants({ validation: "invalid" }))}
        >
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      );
    }

    if (hint) {
      return (
        <p id={hintId} className={cn(helperTextVariants({ validation }))}>
          <span>{hint}</span>
        </p>
      );
    }

    return null;
  };

  // ── Render ─────────────────────────────────────────────────────
  const wrapperClassName = cn(
    editorWrapperVariants({ variant, validation, fullWidth }),
    disabled && "opacity-50 cursor-not-allowed",
    className,
  );

  const styleVars: Record<string, string> = {
    "--editor-min-height": minHeight,
  };
  if (maxHeight) {
    styleVars["--editor-max-height"] = maxHeight;
  }

  return (
    <div className={cn(fullWidth && "w-full")}>
      {label && (
        <label
          htmlFor={editorId}
          className={cn(
            "block text-sm font-medium text-text-secondary mb-1.5",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {label}
          {required && (
            <span className="text-danger-500 ml-0.5 select-none" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </label>
      )}

      <div
        className={wrapperClassName}
        style={styleVars}
        onPaste={handlePaste}
      >
        {toolbarPosition === "top" && renderToolbar()}
        {toolbarPosition === "top" && renderLinkInput()}
        {toolbarPosition === "top" && renderImageInput()}
        {toolbarPosition === "top" && renderEmbedInput()}
        {toolbarPosition === "top" && renderAiPanel()}

        <div
          id={editorId}
          className={cn(
            "flex-1 relative",
            maxHeight && "overflow-y-auto",
          )}
          style={{
            minHeight,
            ...(maxHeight ? { maxHeight } : {}),
          }}
        >
          <EditorContent
            editor={editor}
            role="textbox"
            aria-multiline="true"
            aria-label={label ?? "Rich text editor"}
            aria-describedby={
              [error ? errorId : null, hint && !error ? hintId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={validation === "invalid" ? true : undefined}
            aria-errormessage={error ? errorId : undefined}
            aria-required={required ? true : undefined}
            aria-readonly={readOnly ? true : undefined}
            aria-disabled={disabled ? true : undefined}
          />
        </div>

        {toolbarPosition === "bottom" && renderAiPanel()}
        {toolbarPosition === "bottom" && renderEmbedInput()}
        {toolbarPosition === "bottom" && renderImageInput()}
        {toolbarPosition === "bottom" && renderLinkInput()}
        {toolbarPosition === "bottom" && renderToolbar()}
      </div>

      {renderHelperText()}
    </div>
  );
});

RichEditor.displayName = "RichEditor";

// ─── Sub-components ─────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  label,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(toolbarButtonVariants({ active }))}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="mx-1 h-5 w-px bg-border"
    />
  );
}

// ─── Default AI Assist ──────────────────────────────────────────────

async function defaultAiAssist(
  prompt: string,
  context: string,
): Promise<string> {
  return `**AI Response**\n\nHere is a suggested response based on your prompt: "${prompt}"\n\n> Consider integrating with OpenAI, Anthropic, or Google AI for enhanced responses.\n\nConfigure the \`onAiAssist\` prop to connect to your preferred AI provider.`;
}

// ─── Exports ────────────────────────────────────────────────────────

export {
  RichEditor,
  editorWrapperVariants,
  toolbarButtonVariants,
  helperTextVariants,
  htmlToMarkdown,
  markdownToHtml,
  getEmbedUrl,
  UnderlineMark,
  MediaEmbedNode,
};

export type { EditorVariant, EditorValidation };

export default RichEditor;