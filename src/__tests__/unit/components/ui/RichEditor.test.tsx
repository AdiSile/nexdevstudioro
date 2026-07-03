import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RichEditor,
  htmlToMarkdown,
  markdownToHtml,
  getEmbedUrl,
} from "@/components/ui/RichEditor";
import type { RichEditorProps, RichEditorRef } from "@/components/ui/RichEditor";

// ─── Mock TipTap ────────────────────────────────────────────────────

jest.mock("@tiptap/react", () => {
  const React = require("react");
  const { forwardRef } = require("react");

  const MockEditorContent = forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
      return (
        <div
          ref={ref}
          contentEditable
          role="textbox"
          aria-multiline="true"
          {...props}
          data-testid="editor-content"
          dangerouslySetInnerHTML={{
            __html:
              ((props as Record<string, unknown>).content as string) ||
              "<p></p>",
          }}
        />
      );
    },
  );

  MockEditorContent.displayName = "EditorContent";

  const mockEditor = {
    getHTML: jest.fn(() => "<p>Test content</p>"),
    getText: jest.fn(() => "Test content"),
    chain: jest.fn(() => ({
      focus: jest.fn(() => ({
        toggleBold: jest.fn(() => ({ run: jest.fn() })),
        toggleItalic: jest.fn(() => ({ run: jest.fn() })),
        toggleUnderline: jest.fn(() => ({ run: jest.fn() })),
        toggleStrike: jest.fn(() => ({ run: jest.fn() })),
        toggleCode: jest.fn(() => ({ run: jest.fn() })),
        toggleHighlight: jest.fn(() => ({ run: jest.fn() })),
        toggleHeading: jest.fn(() => ({ run: jest.fn() })),
        toggleBulletList: jest.fn(() => ({ run: jest.fn() })),
        toggleOrderedList: jest.fn(() => ({ run: jest.fn() })),
        toggleBlockquote: jest.fn(() => ({ run: jest.fn() })),
        setHorizontalRule: jest.fn(() => ({ run: jest.fn() })),
        undo: jest.fn(() => ({ run: jest.fn() })),
        redo: jest.fn(() => ({ run: jest.fn() })),
        unsetLink: jest.fn(() => ({ run: jest.fn() })),
        extendMarkRange: jest.fn(() => ({
          setLink: jest.fn(() => ({ run: jest.fn() })),
        })),
        setImage: jest.fn(() => ({ run: jest.fn() })),
        insertTable: jest.fn(() => ({ run: jest.fn() })),
        insertContent: jest.fn(() => ({ run: jest.fn() })),
        insertMediaEmbed: jest.fn(() => ({ run: jest.fn() })),
        setContent: jest.fn(() => ({ run: jest.fn() })),
        clearContent: jest.fn(() => ({ run: jest.fn() })),
      })),
      can: jest.fn(() => ({
        undo: jest.fn(() => true),
        redo: jest.fn(() => true),
      })),
    })),
    isActive: jest.fn(() => false),
    getAttributes: jest.fn(() => ({})),
    commands: {
      setContent: jest.fn(),
      clearContent: jest.fn(),
      focus: jest.fn(),
      insertContent: jest.fn(),
    },
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn(),
    setEditable: jest.fn(),
  };

  return {
    useEditor: jest.fn(() => mockEditor),
    EditorContent: MockEditorContent,
  };
});

// ─── Helpers ────────────────────────────────────────────────────────

const setup = (props: Partial<RichEditorProps> = {}) => {
  const user = userEvent.setup();
  const utils = render(<RichEditor {...props} />);
  return { user, ...utils };
};

// ─── Rendering ──────────────────────────────────────────────────────
describe("RichEditor rendering", () => {
  it("renders the editor content area", () => {
    setup();
    const editor = screen.getByRole("textbox");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute("aria-multiline", "true");
  });

  it("renders with a toolbar by default", () => {
    setup();
    const toolbar = screen.getByRole("toolbar", {
      name: "Text formatting toolbar",
    });
    expect(toolbar).toBeInTheDocument();
  });

  it("hides toolbar when showToolbar is false", () => {
    setup({ showToolbar: false });
    expect(
      screen.queryByRole("toolbar", { name: "Text formatting toolbar" }),
    ).not.toBeInTheDocument();
  });

  it("renders with a label", () => {
    setup({ label: "Content editor" });
    expect(screen.getByText("Content editor")).toBeInTheDocument();
  });

  it("associates label with editor via id", () => {
    setup({ label: "Body", id: "body-editor" });
    const label = screen.getByText("Body");
    expect(label).toHaveAttribute("for", "body-editor");
  });

  it("renders required indicator", () => {
    setup({ label: "Required field", required: true });
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("(required)")).toHaveClass("sr-only");
  });

  it("does not render label when not provided", () => {
    setup();
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });
});

// ─── Toolbar buttons ────────────────────────────────────────────────
describe("RichEditor toolbar", () => {
  it.each([
    "Bold",
    "Italic",
    "Underline",
    "Strikethrough",
    "Inline code",
    "Highlight",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Bullet list",
    "Ordered list",
    "Blockquote",
    "Horizontal rule",
    "Insert link",
    "Insert image",
    "Insert table",
    "Embed media",
    "AI Assist",
    "Undo",
    "Redo",
  ])("renders %s button", (label) => {
    setup();
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it("hides media embed button when enableMediaEmbed is false", () => {
    setup({ enableMediaEmbed: false });
    expect(screen.queryByLabelText("Embed media")).not.toBeInTheDocument();
  });

  it("hides AI assist button when enableAiAssist is false", () => {
    setup({ enableAiAssist: false });
    expect(screen.queryByLabelText("AI Assist")).not.toBeInTheDocument();
  });
});

// ─── Toolbar interactions ───────────────────────────────────────────
describe("RichEditor toolbar interactions", () => {
  it("toggles AI panel on button click", async () => {
    const { user } = setup();
    const aiButton = screen.getByLabelText("AI Assist");

    await user.click(aiButton);
    expect(screen.getByText("AI Assist")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ask AI to write, rewrite, summarize..."),
    ).toBeInTheDocument();

    await user.click(aiButton);
    expect(
      screen.queryByPlaceholderText("Ask AI to write, rewrite, summarize..."),
    ).not.toBeInTheDocument();
  });

  it("shows link input when link button is clicked", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Insert link"));
    expect(
      screen.getByPlaceholderText("https://example.com"),
    ).toBeInTheDocument();
  });

  it("shows image input with URL and alt fields", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Insert image"));
    expect(
      screen.getByPlaceholderText("https://example.com/image.jpg"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Image description"),
    ).toBeInTheDocument();
  });

  it("shows embed input with provider selector", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Embed media"));
    expect(
      screen.getByPlaceholderText(
        "https://youtube.com/watch?v=... or https://vimeo.com/...",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByText("Vimeo")).toBeInTheDocument();
  });
});

// ─── Validation states ──────────────────────────────────────────────
describe("RichEditor validation", () => {
  it("shows error message with alert role", () => {
    setup({ error: "Content is required" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Content is required");
  });

  it("sets aria-invalid on editor when error present", () => {
    setup({ error: "Bad input" });
    const editor = screen.getByRole("textbox");
    expect(editor).toHaveAttribute("aria-invalid", "true");
  });

  it("renders hint text when no error", () => {
    setup({ hint: "Supports markdown formatting" });
    expect(
      screen.getByText("Supports markdown formatting"),
    ).toBeInTheDocument();
  });

  it("applies valid state border styles", () => {
    const { container } = setup({ validation: "valid" });
    const wrapper = container.querySelector("[class*='border-success']");
    expect(wrapper).toBeInTheDocument();
  });

  it("applies invalid state border styles", () => {
    const { container } = setup({ validation: "invalid" });
    const wrapper = container.querySelector("[class*='border-danger']");
    expect(wrapper).toBeInTheDocument();
  });
});

// ─── Variants ───────────────────────────────────────────────────────
describe("RichEditor variants", () => {
  it("renders default variant with border", () => {
    const { container } = setup({ variant: "default" });
    const wrapper = container.querySelector("[class*='border']");
    expect(wrapper).toBeInTheDocument();
  });

  it("renders minimal variant without border", () => {
    const { container } = setup({ variant: "minimal" });
    const wrapper = container.querySelector("[class*='border-0']");
    expect(wrapper).toBeInTheDocument();
  });
});

// ─── Full width ─────────────────────────────────────────────────────
describe("RichEditor fullWidth", () => {
  it("applies full-width class when enabled", () => {
    const { container } = setup({ fullWidth: true });
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass("w-full");
  });
});

// ─── Disabled state ─────────────────────────────────────────────────
describe("RichEditor disabled state", () => {
  it("applies disabled visual styles and aria-disabled", () => {
    const { container } = setup({ disabled: true });
    const wrapper = container.querySelector("[class*='opacity-50']");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("cursor-not-allowed");

    const editor = screen.getByRole("textbox");
    expect(editor).toHaveAttribute("aria-disabled", "true");
  });
});

// ─── Read-only state ────────────────────────────────────────────────
describe("RichEditor readOnly", () => {
  it("sets aria-readonly on editor", () => {
    setup({ readOnly: true });
    const editor = screen.getByRole("textbox");
    expect(editor).toHaveAttribute("aria-readonly", "true");
  });
});

// ─── Toolbar position ───────────────────────────────────────────────
describe("RichEditor toolbar position", () => {
  it("renders toolbar at top by default (border-b)", () => {
    const { container } = setup();
    const wrapper = container.querySelector("[class*='border-b']");
    expect(wrapper).toBeInTheDocument();
  });

  it("renders toolbar at bottom when specified (border-t)", () => {
    const { container } = setup({ toolbarPosition: "bottom" });
    const wrapper = container.querySelector("[class*='border-t']");
    expect(wrapper).toBeInTheDocument();
  });
});

// ─── Min/Max height ─────────────────────────────────────────────────
describe("RichEditor dimensions", () => {
  it("uses default min height of 12rem", () => {
    const { container } = setup();
    const editorArea = container.querySelector("[style*='min-height']");
    expect(editorArea?.getAttribute("style")).toContain("12rem");
  });

  it("applies custom min height", () => {
    const { container } = setup({ minHeight: "20rem" });
    const editorArea = container.querySelector("[style*='min-height']");
    expect(editorArea?.getAttribute("style")).toContain("20rem");
  });

  it("applies max height when specified", () => {
    const { container } = setup({ maxHeight: "30rem" });
    const editorArea = container.querySelector("[style*='max-height']");
    expect(editorArea?.getAttribute("style")).toContain("30rem");
  });
});

// ─── Controlled/uncontrolled value ──────────────────────────────────
describe("RichEditor value handling", () => {
  it("renders with initial value", () => {
    setup({ value: "<p>Initial content</p>" });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with default value", () => {
    setup({ defaultValue: "<p>Default content</p>" });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("accepts onChange and onMarkdownChange callbacks", () => {
    const onChange = jest.fn();
    const onMarkdownChange = jest.fn();
    setup({ onChange, onMarkdownChange });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

// ─── AI Assist ──────────────────────────────────────────────────────
describe("RichEditor AI assist", () => {
  it("shows prompt input and disabled generate button", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("AI Assist"));

    expect(
      screen.getByPlaceholderText("Ask AI to write, rewrite, summarize..."),
    ).toBeInTheDocument();

    const generateBtn = screen.getByText("Generate");
    expect(generateBtn).toBeDisabled();
  });

  it("closes AI panel on close button click", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("AI Assist"));
    const closeBtn = screen.getByLabelText("Close AI panel");
    await user.click(closeBtn);

    expect(
      screen.queryByPlaceholderText("Ask AI to write, rewrite, summarize..."),
    ).not.toBeInTheDocument();
  });

  it("calls custom onAiAssist with prompt and context", async () => {
    const onAiAssist = jest.fn().mockResolvedValue("**AI Generated** content");
    const { user } = setup({ onAiAssist });
    await user.click(screen.getByLabelText("AI Assist"));

    const promptInput = screen.getByPlaceholderText(
      "Ask AI to write, rewrite, summarize...",
    );
    await user.type(promptInput, "Write a summary");

    await user.click(screen.getByText("Generate"));

    await waitFor(() => {
      expect(onAiAssist).toHaveBeenCalledWith(
        "Write a summary",
        "Test content",
      );
    });
  });

  it("shows loading state during AI request", async () => {
    const onAiAssist = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("Result"), 100)),
    );
    const { user } = setup({ onAiAssist });
    await user.click(screen.getByLabelText("AI Assist"));

    await user.type(
      screen.getByPlaceholderText("Ask AI to write, rewrite, summarize..."),
      "Test",
    );
    await user.click(screen.getByText("Generate"));

    expect(screen.getByText("Thinking...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
    });
  });

  it("shows error state on AI failure", async () => {
    const onAiAssist = jest.fn().mockRejectedValue(new Error("API Error"));
    const { user } = setup({ onAiAssist });
    await user.click(screen.getByLabelText("AI Assist"));

    await user.type(
      screen.getByPlaceholderText("Ask AI to write, rewrite, summarize..."),
      "Test",
    );
    await user.click(screen.getByText("Generate"));

    await waitFor(() => {
      expect(screen.getByText("API Error")).toBeInTheDocument();
    });
  });
});

// ─── Escape key closes popovers ─────────────────────────────────────
describe("RichEditor popover dismissal", () => {
  it("closes link input on Escape", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Insert link"));
    expect(
      screen.getByPlaceholderText("https://example.com"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByPlaceholderText("https://example.com"),
    ).not.toBeInTheDocument();
  });

  it("closes image input on Escape", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Insert image"));
    expect(
      screen.getByPlaceholderText("https://example.com/image.jpg"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByPlaceholderText("https://example.com/image.jpg"),
    ).not.toBeInTheDocument();
  });

  it("closes embed input on Escape", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Embed media"));
    expect(
      screen.getByPlaceholderText(
        "https://youtube.com/watch?v=... or https://vimeo.com/...",
      ),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByPlaceholderText(
        "https://youtube.com/watch?v=... or https://vimeo.com/...",
      ),
    ).not.toBeInTheDocument();
  });
});

// ─── Ref imperative API ─────────────────────────────────────────────
describe("RichEditor ref", () => {
  it("forwards ref with all imperative methods", () => {
    const ref = React.createRef<RichEditorRef>();
    render(<RichEditor ref={ref} />);
    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.getHTML).toBe("function");
    expect(typeof ref.current?.getMarkdown).toBe("function");
    expect(typeof ref.current?.getText).toBe("function");
    expect(typeof ref.current?.setContent).toBe("function");
    expect(typeof ref.current?.focus).toBe("function");
    expect(typeof ref.current?.clear).toBe("function");
    expect(typeof ref.current?.insertContent).toBe("function");
  });
});

// ─── Accessibility ──────────────────────────────────────────────────
describe("RichEditor accessibility", () => {
  it("renders with textbox role", () => {
    setup();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("accepts aria-label on editor area", () => {
    setup({ label: "Editor label" });
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-label",
      "Editor label",
    );
  });

  it("toolbar has proper ARIA attributes", () => {
    setup();
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveAttribute("aria-label", "Text formatting toolbar");
    expect(toolbar).toHaveAttribute("aria-controls");
  });

  it("toolbar buttons have aria-pressed", () => {
    setup();
    expect(screen.getByLabelText("Bold")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toolbar separators have separator role", () => {
    setup();
    const separators = screen.getAllByRole("separator");
    expect(separators.length).toBeGreaterThan(0);
    separators.forEach((sep) => {
      expect(sep).toHaveAttribute("aria-orientation", "vertical");
    });
  });

  it("autogenerates unique ids", () => {
    const { container: c1 } = render(<RichEditor />);
    const { container: c2 } = render(<RichEditor />);
    const id1 = c1.querySelector("[aria-multiline]")?.id;
    const id2 = c2.querySelector("[aria-multiline]")?.id;
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("uses provided id", () => {
    setup({ id: "custom-editor" });
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "custom-editor");
  });
});

// ─── Display name ───────────────────────────────────────────────────
describe("RichEditor displayName", () => {
  it("has display name 'RichEditor'", () => {
    expect(RichEditor.displayName).toBe("RichEditor");
  });
});

// ─── Custom className ───────────────────────────────────────────────
describe("RichEditor custom className", () => {
  it("merges custom className on wrapper", () => {
    const { container } = setup({ className: "custom-editor" });
    expect(container.querySelector(".custom-editor")).toBeInTheDocument();
  });
});

// ─── htmlToMarkdown utility ─────────────────────────────────────────
describe("htmlToMarkdown", () => {
  it("converts headings", () => {
    expect(htmlToMarkdown("<h1>Title</h1>")).toBe("# Title");
    expect(htmlToMarkdown("<h2>Subtitle</h2>")).toBe("## Subtitle");
    expect(htmlToMarkdown("<h3>Section</h3>")).toBe("### Section");
  });

  it("converts bold and italic", () => {
    expect(htmlToMarkdown("<strong>Bold</strong>")).toBe("**Bold**");
    expect(htmlToMarkdown("<em>Italic</em>")).toBe("*Italic*");
    expect(htmlToMarkdown("<b>Bold</b>")).toBe("**Bold**");
    expect(htmlToMarkdown("<i>Italic</i>")).toBe("*Italic*");
  });

  it("converts underline and strikethrough", () => {
    expect(htmlToMarkdown("<u>Underlined</u>")).toBe("__Underlined__");
    expect(htmlToMarkdown("<s>Strikethrough</s>")).toBe("~~Strikethrough~~");
  });

  it("converts inline code", () => {
    expect(htmlToMarkdown("<code>const x = 1;</code>")).toBe("`const x = 1;`");
  });

  it("converts links", () => {
    expect(
      htmlToMarkdown('<a href="https://example.com">Link</a>'),
    ).toBe("[Link](https://example.com)");
  });

  it("converts images", () => {
    expect(
      htmlToMarkdown('<img src="https://img.com/pic.jpg" alt="Alt text" />'),
    ).toBe("![Alt text](https://img.com/pic.jpg)");
  });

  it("converts unordered lists", () => {
    const result = htmlToMarkdown("<ul><li>Item 1</li><li>Item 2</li></ul>");
    expect(result).toContain("- Item 1");
    expect(result).toContain("- Item 2");
  });

  it("converts blockquote", () => {
    const result = htmlToMarkdown(
      "<blockquote><p>Quote text</p></blockquote>",
    );
    expect(result).toContain("> Quote text");
  });

  it("converts horizontal rule", () => {
    expect(htmlToMarkdown("<hr />")).toBe("---");
  });

  it("converts paragraphs", () => {
    expect(htmlToMarkdown("<p>Hello world</p>")).toBe("Hello world");
  });

  it("returns empty string for empty/falsy input", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown("<p></p>")).toBe("");
  });

  it("converts multiple paragraphs", () => {
    const result = htmlToMarkdown(
      "<p>First paragraph</p><p>Second paragraph</p>",
    );
    expect(result).toContain("First paragraph");
    expect(result).toContain("Second paragraph");
  });
});

// ─── markdownToHtml utility ─────────────────────────────────────────
describe("markdownToHtml", () => {
  it("converts headings from markdown", () => {
    const html = markdownToHtml("# Heading 1\n\n## Heading 2");
    expect(html).toContain("Heading 1");
    expect(html).toContain("Heading 2");
  });

  it("converts bold from markdown", () => {
    expect(markdownToHtml("**bold text**")).toContain(
      "<strong>bold text</strong>",
    );
  });

  it("converts italic from markdown", () => {
    expect(markdownToHtml("*italic text*")).toContain(
      "<em>italic text</em>",
    );
  });

  it("converts links from markdown", () => {
    const html = markdownToHtml("[Google](https://google.com)");
    expect(html).toContain("https://google.com");
    expect(html).toContain("Google");
  });

  it("converts code blocks from markdown", () => {
    const html = markdownToHtml("```\nconst x = 1;\n```");
    expect(html).toContain("const x = 1;");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code>");
  });

  it("converts inline code from markdown", () => {
    expect(markdownToHtml("Use `const` keyword")).toContain(
      "<code>const</code>",
    );
  });

  it("converts unordered lists from markdown", () => {
    const html = markdownToHtml("- Item 1\n- Item 2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
  });

  it("converts ordered lists from markdown", () => {
    const html = markdownToHtml("1. First\n2. Second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>First</li>");
    expect(html).toContain("<li>Second</li>");
  });

  it("converts blockquote from markdown", () => {
    const html = markdownToHtml("> Quote text");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("Quote text");
  });

  it("converts horizontal rule from markdown", () => {
    expect(markdownToHtml("---")).toContain("<hr>");
  });

  it("returns empty string for empty input", () => {
    expect(markdownToHtml("")).toBe("");
  });

  it("handles YouTube embed syntax", () => {
    const html = markdownToHtml(
      "@[youtube](https://youtube.com/watch?v=dQw4w9WgXcQ)",
    );
    expect(html).toContain("data-media-embed");
    expect(html).toContain('data-provider="youtube"');
  });
});

// ─── getEmbedUrl utility ────────────────────────────────────────────
describe("getEmbedUrl", () => {
  it("converts YouTube watch URL to embed URL", () => {
    expect(
      getEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("converts YouTube short URL to embed URL", () => {
    expect(getEmbedUrl("https://youtu.be/dQw4w9WgXcQ", "youtube")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("keeps existing YouTube embed URL", () => {
    expect(
      getEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube"),
    ).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("converts Vimeo URL to embed URL", () => {
    expect(getEmbedUrl("https://vimeo.com/123456789", "vimeo")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("returns original src for unknown provider", () => {
    expect(getEmbedUrl("https://example.com/video", "unknown")).toBe(
      "https://example.com/video",
    );
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("RichEditor edge cases", () => {
  it("renders without any props", () => {
    render(<RichEditor />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("error takes precedence over hint", () => {
    setup({ error: "Error message", hint: "Helper text" });
    expect(screen.getByText("Error message")).toBeInTheDocument();
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
  });

  it("error overrides validation prop", () => {
    setup({ validation: "valid", error: "Something wrong" });
    const editor = screen.getByRole("textbox");
    expect(editor).toHaveAttribute("aria-invalid", "true");
  });

  it("handles multiple popovers sequentially", async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText("Insert link"));
    expect(
      screen.getByPlaceholderText("https://example.com"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await user.click(screen.getByLabelText("Insert image"));
    expect(
      screen.getByPlaceholderText("https://example.com/image.jpg"),
    ).toBeInTheDocument();
  });
});