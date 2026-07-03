import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FileUpload, {
  formatFileSize,
  getFileCategory,
  truncateFilename,
  FILE_ACCEPT_GROUPS,
  type UploadFile,
  type FileUploadProps,
} from "@/components/ui/FileUpload";
import { UploadCloud } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────

const setup = (props: FileUploadProps = {}) => {
  const user = userEvent.setup();
  const utils = render(<FileUpload {...props} />);
  return { user, ...utils };
};

function createMockFile(name: string, size: number, type: string): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

// ─── Rendering ──────────────────────────────────────────────────────
describe("FileUpload rendering", () => {
  it("renders the upload area", () => {
    setup();
    const area = screen.getByRole("button", { name: /drag & drop files here/i });
    expect(area).toBeInTheDocument();
  });

  it("renders with default title and subtitle", () => {
    setup();
    expect(screen.getByText("Drag & drop files here")).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    expect(screen.getByText("Browse files")).toBeInTheDocument();
  });

  it("renders with custom title and subtitle", () => {
    setup({ title: "Upload your avatar", subtitle: "PNG or JPG only" });
    expect(screen.getByText("Upload your avatar")).toBeInTheDocument();
    expect(screen.getByText(/PNG or JPG only/)).toBeInTheDocument();
  });

  it("renders custom browse label", () => {
    setup({ browseLabel: "Select files" });
    expect(screen.getByText("Select files")).toBeInTheDocument();
  });

  it("renders a hidden file input", () => {
    const { container } = setup();
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-hidden", "true");
  });

  it("renders custom icon", () => {
    setup({ icon: <UploadCloud data-testid="custom-icon" /> });
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders children inside upload area", () => {
    setup({ children: <span data-testid="child">Extra content</span> });
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Extra content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    setup({ className: "my-uploader" });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("my-uploader");
  });

  it("renders with fullWidth class when fullWidth is true", () => {
    setup({ fullWidth: true });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("w-full");
  });

  it("does not apply fullWidth by default", () => {
    setup();
    const area = screen.getByRole("button");
    expect(area).not.toHaveClass("w-full");
  });
});

// ─── Variants ───────────────────────────────────────────────────────
describe("FileUpload variants", () => {
  it("renders default variant", () => {
    setup({ variant: "default" });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("border-border");
    expect(area).toHaveClass("bg-surface-secondary/50");
  });

  it("renders filled variant", () => {
    setup({ variant: "filled" });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("bg-surface-tertiary");
  });

  it("renders minimal variant", () => {
    setup({ variant: "minimal" });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("border-transparent");
    expect(area).toHaveClass("bg-transparent");
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────
describe("FileUpload sizes", () => {
  it("renders default md size", () => {
    setup();
    const area = screen.getByRole("button");
    expect(area).toHaveClass("p-6");
    expect(area).toHaveClass("min-h-[160px]");
  });

  it("renders sm size", () => {
    setup({ size: "sm" });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("p-4");
    expect(area).toHaveClass("min-h-[120px]");
  });

  it("renders lg size", () => {
    setup({ size: "lg" });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("p-8");
    expect(area).toHaveClass("min-h-[200px]");
  });
});

// ─── Disabled state ─────────────────────────────────────────────────
describe("FileUpload disabled state", () => {
  it("applies disabled styling", () => {
    setup({ disabled: true });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("opacity-50");
    expect(area).toHaveClass("cursor-not-allowed");
    expect(area).toHaveClass("pointer-events-none");
  });

  it("sets aria-disabled when disabled", () => {
    setup({ disabled: true });
    const area = screen.getByRole("button");
    expect(area).toHaveAttribute("aria-disabled", "true");
  });

  it("does not set aria-disabled when enabled", () => {
    setup();
    const area = screen.getByRole("button");
    expect(area).not.toHaveAttribute("aria-disabled");
  });

  it("sets tabIndex to -1 when disabled", () => {
    setup({ disabled: true });
    const area = screen.getByRole("button");
    expect(area).toHaveAttribute("tabindex", "-1");
  });
});

// ─── Error state ────────────────────────────────────────────────────
describe("FileUpload error state", () => {
  it("renders error message", () => {
    setup({ error: "File is too large" });
    expect(screen.getByText("File is too large")).toBeInTheDocument();
  });

  it("renders error with alert role", () => {
    setup({ error: "Invalid file type" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Invalid file type");
  });

  it("applies error styling to upload area", () => {
    setup({ error: "Error" });
    const area = screen.getByRole("button");
    expect(area).toHaveClass("border-danger-400");
  });

  it("does not show hint when error is present", () => {
    setup({ error: "Error", hint: "Helper text" });
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
  });
});

// ─── Hint ───────────────────────────────────────────────────────────
describe("FileUpload hint", () => {
  it("renders hint text", () => {
    setup({ hint: "Max 5 files, 10MB each" });
    expect(screen.getByText("Max 5 files, 10MB each")).toBeInTheDocument();
  });

  it("does not render hint when error is present", () => {
    setup({ hint: "Helper", error: "Oops" });
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
  });
});

// ─── File input via click ───────────────────────────────────────────
describe("FileUpload file selection", () => {
  it("opens file dialog when clicking the upload area", async () => {
    const { user, container } = setup();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    const area = screen.getByRole("button");
    await user.click(area);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("opens file dialog when pressing Enter on upload area", async () => {
    const { user, container } = setup();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    const area = screen.getByRole("button");
    area.focus();
    await user.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("opens file dialog when pressing Space on upload area", async () => {
    const { user, container } = setup();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    const area = screen.getByRole("button");
    area.focus();
    await user.keyboard(" ");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("does not open file dialog when disabled", async () => {
    const { user, container } = setup({ disabled: true });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    const area = screen.getByRole("button");
    await user.click(area);
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

// ─── File addition via input change ─────────────────────────────────
describe("FileUpload add files", () => {
  it("adds a file to the list when selected", async () => {
    const onFilesChange = jest.fn();
    const { container } = setup({ onFilesChange });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("test.jpg", 500 * 1024, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("test.jpg")).toBeInTheDocument();
    });
    expect(onFilesChange).toHaveBeenCalled();
  });

  it("adds multiple files", async () => {
    const { container } = setup({ multiple: true });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("a.jpg", 1000, "image/jpeg"));
    dt.items.add(createMockFile("b.png", 2000, "image/png"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("a.jpg")).toBeInTheDocument();
      expect(screen.getByText("b.png")).toBeInTheDocument();
    });
  });

  it("shows file size next to filename", async () => {
    const { container } = setup({ showFileSize: true });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("doc.pdf", 2.5 * 1024 * 1024, "application/pdf");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("2.5 MB")).toBeInTheDocument();
    });
  });

  it("hides file size when showFileSize is false", async () => {
    const { container } = setup({ showFileSize: false });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("doc.pdf", 1000, "application/pdf");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("doc.pdf")).toBeInTheDocument();
      expect(screen.queryByText("1.0 KB")).not.toBeInTheDocument();
    });
  });

  it("calls onFileAdd for each file", async () => {
    const onFileAdd = jest.fn();
    const { container } = setup({ onFileAdd });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("x.jpg", 1000, "image/jpeg"));
    dt.items.add(createMockFile("y.png", 2000, "image/png"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(onFileAdd).toHaveBeenCalledTimes(2);
    });
  });

  it("calls onValidationError for rejected files", async () => {
    const onValidationError = jest.fn();
    const { container } = setup({ maxSize: 100, onValidationError });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("large.jpg", 5000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(onValidationError).toHaveBeenCalled();
      const errors: string[] = onValidationError.mock.calls[0][0];
      expect(errors[0]).toContain("exceeds the maximum size");
    });
  });
});

// ─── File removal ───────────────────────────────────────────────────
describe("FileUpload remove files", () => {
  it("removes a file when clicking the remove button", async () => {
    const onFileRemove = jest.fn();
    const { user, container } = setup({ onFileRemove });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("remove-me.jpg", 1000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(async () => {
      const removeBtn = screen.getByLabelText("Remove remove-me.jpg");
      await user.click(removeBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText("remove-me.jpg")).not.toBeInTheDocument();
      expect(onFileRemove).toHaveBeenCalled();
    });
  });

  it("clears all files when clicking clear all", async () => {
    const onFilesClear = jest.fn();
    const { user, container } = setup({ onFilesClear });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("a.jpg", 1000, "image/jpeg"));
    dt.items.add(createMockFile("b.png", 2000, "image/png"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(async () => {
      const clearBtn = screen.getByText("Clear all");
      await user.click(clearBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText("a.jpg")).not.toBeInTheDocument();
      expect(screen.queryByText("b.png")).not.toBeInTheDocument();
      expect(onFilesClear).toHaveBeenCalled();
    });
  });

  it("hides remove button when showRemoveButton is false", async () => {
    const { container } = setup({ showRemoveButton: false });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("hidden.jpg", 1000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("hidden.jpg")).toBeInTheDocument();
      expect(screen.queryByLabelText("Remove hidden.jpg")).not.toBeInTheDocument();
    });
  });
});

// ─── Validation ─────────────────────────────────────────────────────
describe("FileUpload validation", () => {
  it("rejects files exceeding maxSize", async () => {
    const { container } = setup({ maxSize: 1024 });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("big.jpg", 5000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText("big.jpg")).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("rejects files below minSize", async () => {
    const { container } = setup({ minSize: 10000 });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("small.jpg", 500, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText("small.jpg")).not.toBeInTheDocument();
    });
  });

  it("rejects files not in allowedTypes", async () => {
    const { container } = setup({ allowedTypes: ["image/png", "image/jpeg"] });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("music.mp3", 10000, "audio/mpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText("music.mp3")).not.toBeInTheDocument();
    });
  });

  it("accepts files matching allowedTypes", async () => {
    const { container } = setup({ allowedTypes: ["image/png"] });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("valid.png", 1000, "image/png");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("valid.png")).toBeInTheDocument();
    });
  });

  it("enforces maxFiles limit", async () => {
    const { container } = setup({ maxFiles: 2 });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("1.jpg", 1000, "image/jpeg"));
    dt.items.add(createMockFile("2.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const dt2 = new DataTransfer();
    dt2.items.add(createMockFile("3.jpg", 1000, "image/jpeg"));
    input.files = dt2.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText("3.jpg")).not.toBeInTheDocument();
    });
  });

  it("enforces maxTotalSize", async () => {
    const { container } = setup({ maxTotalSize: 5000 });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("a.jpg", 4000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const dt2 = new DataTransfer();
    dt2.items.add(createMockFile("b.jpg", 4000, "image/jpeg"));
    input.files = dt2.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText("b.jpg")).not.toBeInTheDocument();
    });
  });

  it("shows warning when too few files", async () => {
    const { container } = setup({ minFiles: 3 });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("a.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText(/At least 3 file/)).toBeInTheDocument();
    });
  });

  it("uses customValidator", async () => {
    const customValidator = jest.fn((file: File) => {
      if (file.name.includes("forbidden")) return "Forbidden filename";
      return null;
    });
    const { container } = setup({ validation: { customValidator } });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("forbidden.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(customValidator).toHaveBeenCalled();
      expect(screen.queryByText("forbidden.jpg")).not.toBeInTheDocument();
    });
  });

  it("accepts files matching wildcard allowedTypes", async () => {
    const { container } = setup({ allowedTypes: ["image/*"] });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("photo.jpg", 1000, "image/jpeg"));
    dt.items.add(createMockFile("graphic.png", 1000, "image/png"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("photo.jpg")).toBeInTheDocument();
      expect(screen.getByText("graphic.png")).toBeInTheDocument();
    });
  });
});

// ─── Drag & Drop ────────────────────────────────────────────────────
describe("FileUpload drag and drop", () => {
  it("shows drag active state on drag enter", async () => {
    setup();
    const area = screen.getByRole("button");

    await act(async () => {
      const dt = new DataTransfer();
      dt.items.add(createMockFile("test.jpg", 1000, "image/jpeg"));
      area.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true }));
    });

    await waitFor(() => {
      expect(area).toHaveClass("border-brand-500");
    });
  });

  it("shows drag active text when dragging", async () => {
    setup({ dragActiveText: "Release to upload!" });
    const area = screen.getByRole("button");

    await act(async () => {
      const dt = new DataTransfer();
      dt.items.add(createMockFile("test.jpg", 1000, "image/jpeg"));
      area.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("Release to upload!")).toBeInTheDocument();
    });
  });

  it("removes drag active state on drag leave", async () => {
    setup();
    const area = screen.getByRole("button");

    await act(async () => {
      const dt = new DataTransfer();
      dt.items.add(createMockFile("test.jpg", 1000, "image/jpeg"));
      area.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true }));
    });

    await act(async () => {
      area.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
    });

    await waitFor(() => {
      expect(area).not.toHaveClass("border-brand-500");
    });
  });

  it("adds files on drop", async () => {
    setup();
    const area = screen.getByRole("button");

    await act(async () => {
      const dt = new DataTransfer();
      dt.items.add(createMockFile("dropped.jpg", 1000, "image/jpeg"));
      area.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("dropped.jpg")).toBeInTheDocument();
    });
  });

  it("does not add files on drop when disabled", async () => {
    setup({ disabled: true });
    const area = screen.getByRole("button");

    await act(async () => {
      const dt = new DataTransfer();
      dt.items.add(createMockFile("dropped.jpg", 1000, "image/jpeg"));
      area.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.queryByText("dropped.jpg")).not.toBeInTheDocument();
    });
  });

  it("respects multiple=false on drop", async () => {
    setup({ multiple: false });
    const area = screen.getByRole("button");

    await act(async () => {
      const dt = new DataTransfer();
      dt.items.add(createMockFile("first.jpg", 1000, "image/jpeg"));
      dt.items.add(createMockFile("second.jpg", 1000, "image/jpeg"));
      area.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("first.jpg")).toBeInTheDocument();
      expect(screen.queryByText("second.jpg")).not.toBeInTheDocument();
    });
  });
});

// ─── Preview ────────────────────────────────────────────────────────
describe("FileUpload preview", () => {
  it("shows image preview for image files", async () => {
    const { container } = setup({ showPreview: true });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("preview.jpg", 1000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("alt", "preview.jpg");
    });
  });

  it("shows file type icon for non-image files", async () => {
    const { container } = setup({ showPreview: true });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("doc.pdf", 1000, "application/pdf");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("doc.pdf")).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });
  });

  it("hides preview when showPreview is false", async () => {
    const { container } = setup({ showPreview: false });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("no-preview.jpg", 1000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("no-preview.jpg")).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });
  });
});

// ─── Progress bar ───────────────────────────────────────────────────
describe("FileUpload progress bar", () => {
  it("shows progress bar when showProgressBar is true", async () => {
    const { container } = setup({ showProgressBar: true });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("progress.jpg", 1000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("progress.jpg")).toBeInTheDocument();
    });
  });

  it("hides progress bar when showProgressBar is false", async () => {
    const { container } = setup({ showProgressBar: false });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("no-progress.jpg", 1000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("no-progress.jpg")).toBeInTheDocument();
    });
  });
});

// ─── Controlled files ───────────────────────────────────────────────
describe("FileUpload controlled", () => {
  it("renders controlled files", () => {
    const controlled: UploadFile[] = [
      {
        id: "f1",
        file: createMockFile("controlled.jpg", 1000, "image/jpeg"),
        progress: 50,
        status: "uploading",
      },
      {
        id: "f2",
        file: createMockFile("done.png", 2000, "image/png"),
        progress: 100,
        status: "complete",
      },
    ];
    setup({ files: controlled });

    expect(screen.getByText("controlled.jpg")).toBeInTheDocument();
    expect(screen.getByText("done.png")).toBeInTheDocument();
  });

  it("calls onFilesChange when file is removed in controlled mode", async () => {
    const onFilesChange = jest.fn();
    const onFileRemove = jest.fn();
    const controlled: UploadFile[] = [
      {
        id: "f1",
        file: createMockFile("a.jpg", 1000, "image/jpeg"),
        progress: 0,
        status: "pending",
      },
    ];

    const { user } = setup({ files: controlled, onFilesChange, onFileRemove });

    const removeBtn = screen.getByLabelText("Remove a.jpg");
    await user.click(removeBtn);

    expect(onFilesChange).toHaveBeenCalled();
    expect(onFileRemove).toHaveBeenCalledWith("f1");
  });
});

// ─── Imperative handle ──────────────────────────────────────────────
describe("FileUpload imperative handle", () => {
  it("forwards ref to the component", () => {
    const ref = React.createRef<{
      openFileDialog: () => void;
      clearFiles: () => void;
      removeFile: (id: string) => void;
      getFiles: () => UploadFile[];
      startUpload: () => void;
      reset: () => void;
    }>();
    render(<FileUpload ref={ref} />);
    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.openFileDialog).toBe("function");
    expect(typeof ref.current?.clearFiles).toBe("function");
    expect(typeof ref.current?.removeFile).toBe("function");
    expect(typeof ref.current?.getFiles).toBe("function");
    expect(typeof ref.current?.startUpload).toBe("function");
    expect(typeof ref.current?.reset).toBe("function");
  });

  it("openFileDialog triggers file input click", () => {
    const ref = React.createRef<{ openFileDialog: () => void }>();
    const { container } = render(<FileUpload ref={ref} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    act(() => {
      ref.current?.openFileDialog();
    });

    expect(clickSpy).toHaveBeenCalled();
  });

  it("clearFiles removes all files", async () => {
    const ref = React.createRef<{ clearFiles: () => void }>();
    const { container } = render(<FileUpload ref={ref} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("x.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("x.jpg")).toBeInTheDocument();
    });

    act(() => {
      ref.current?.clearFiles();
    });

    await waitFor(() => {
      expect(screen.queryByText("x.jpg")).not.toBeInTheDocument();
    });
  });

  it("getFiles returns current file list", async () => {
    const ref = React.createRef<{ getFiles: () => UploadFile[] }>();
    const { container } = render(<FileUpload ref={ref} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("y.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      const files = ref.current?.getFiles();
      expect(files).toHaveLength(1);
      expect(files?.[0].file.name).toBe("y.jpg");
    });
  });

  it("reset clears files and resets input", async () => {
    const ref = React.createRef<{ reset: () => void }>();
    const { container } = render(<FileUpload ref={ref} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("z.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("z.jpg")).toBeInTheDocument();
    });

    act(() => {
      ref.current?.reset();
    });

    await waitFor(() => {
      expect(screen.queryByText("z.jpg")).not.toBeInTheDocument();
    });
  });

  it("startUpload triggers upload simulation", async () => {
    const onUploadComplete = jest.fn();
    const ref = React.createRef<{ startUpload: () => void }>();
    const { container } = render(<FileUpload ref={ref} onUploadComplete={onUploadComplete} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("upload-me.jpg", 500, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      ref.current?.startUpload();
    });

    await waitFor(
      () => {
        expect(onUploadComplete).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });
});

// ─── Custom renderFileItem ──────────────────────────────────────────
describe("FileUpload custom renderFileItem", () => {
  it("uses custom render function for file items", async () => {
    const renderFileItem = jest.fn((file: UploadFile, onRemove: (id: string) => void) => (
      <div key={file.id} data-testid={`custom-${file.id}`}>
        <span>{file.file.name}</span>
        <button onClick={() => onRemove(file.id)}>Custom Remove</button>
      </div>
    ));

    const { container } = setup({ renderFileItem });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("custom.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(renderFileItem).toHaveBeenCalled();
      expect(screen.getByText("custom.jpg")).toBeInTheDocument();
      expect(screen.getByText("Custom Remove")).toBeInTheDocument();
    });
  });
});

// ─── Summary footer ─────────────────────────────────────────────────
describe("FileUpload summary footer", () => {
  it("shows file count and total size", async () => {
    const { container } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("a.jpg", 1000, "image/jpeg"));
    dt.items.add(createMockFile("b.png", 2000, "image/png"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText(/2 \/ 10 file/)).toBeInTheDocument();
      expect(screen.getByText(/3\.0 KB/)).toBeInTheDocument();
    });
  });

  it("shows clear all button when files exist", async () => {
    const { container } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("a.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("Clear all")).toBeInTheDocument();
    });
  });

  it("does not show clear all button when no files", () => {
    setup();
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("FileUpload edge cases", () => {
  it("handles empty file selection gracefully", async () => {
    const { container } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("handles file with no extension", async () => {
    const { container } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("noextension", 1000, "application/octet-stream");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("noextension")).toBeInTheDocument();
    });
  });

  it("handles very long filenames with truncation", async () => {
    const { container } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const longName = "this-is-an-extremely-long-filename-that-should-be-truncated-in-the-ui.jpg";
    const file = createMockFile(longName, 1000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      const displayed = screen.getByText((content) => content.includes("..."));
      expect(displayed).toBeInTheDocument();
    });
  });

  it("does not crash with undefined onValidationError", async () => {
    const { container } = setup({ maxSize: 100 });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createMockFile("huge.jpg", 100000, "image/jpeg");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("renders file list when files are provided", () => {
    const files: UploadFile[] = [
      {
        id: "abc",
        file: createMockFile("existing.jpg", 500, "image/jpeg"),
        progress: 100,
        status: "complete",
      },
    ];
    setup({ files });
    expect(screen.getByText("existing.jpg")).toBeInTheDocument();
  });

  it("uses provided accept string on input", () => {
    const { container } = setup({ accept: "image/png,image/jpeg" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg");
  });

  it("computes accept string from allowedTypes", () => {
    const { container } = setup({ allowedTypes: ["image/png", "image/jpeg"] });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg");
  });
});

// ─── Accessibility ──────────────────────────────────────────────────
describe("FileUpload accessibility", () => {
  it("upload area has button role", () => {
    setup();
    const area = screen.getByRole("button");
    expect(area).toBeInTheDocument();
  });

  it("upload area has aria-label", () => {
    setup({ title: "Upload documents" });
    const area = screen.getByRole("button", { name: "Upload documents" });
    expect(area).toBeInTheDocument();
  });

  it("error message has alert role", () => {
    setup({ error: "Something went wrong" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("aria-describedby links error to upload area", () => {
    setup({ error: "Error test" });
    const area = screen.getByRole("button");
    const alert = screen.getByRole("alert");
    expect(area.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("remove button has accessible label", async () => {
    const { container } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("remove.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Remove remove.jpg")).toBeInTheDocument();
    });
  });

  it("is keyboard accessible via Enter", async () => {
    const { user, container } = setup();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    const area = screen.getByRole("button");
    area.focus();
    await user.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ─── Utilities ──────────────────────────────────────────────────────
describe("formatFileSize", () => {
  it("formats 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(3.5 * 1024 * 1024 * 1024)).toBe("3.5 GB");
  });
});

describe("getFileCategory", () => {
  it("returns image for image/jpeg", () => {
    expect(getFileCategory("image/jpeg")).toBe("image");
  });

  it("returns video for video/mp4", () => {
    expect(getFileCategory("video/mp4")).toBe("video");
  });

  it("returns audio for audio/mpeg", () => {
    expect(getFileCategory("audio/mpeg")).toBe("audio");
  });

  it("returns document for application/pdf", () => {
    expect(getFileCategory("application/pdf")).toBe("document");
  });

  it("returns archive for application/zip", () => {
    expect(getFileCategory("application/zip")).toBe("archive");
  });

  it("returns unknown for unlisted type", () => {
    expect(getFileCategory("application/x-custom")).toBe("unknown");
  });
});

describe("truncateFilename", () => {
  it("returns short filename as-is", () => {
    expect(truncateFilename("file.txt")).toBe("file.txt");
  });

  it("truncates long filename", () => {
    const result = truncateFilename("very-long-filename-that-exceeds-limit.txt", 24);
    expect(result).toContain("...");
    expect(result).toContain(".txt");
  });

  it("handles filename without extension", () => {
    const result = truncateFilename("a-very-long-filename-without-dot", 20);
    expect(result).toContain("...");
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("handles extension longer than maxLength", () => {
    const result = truncateFilename("x.verylongextension", 10);
    expect(result).toBe("....verylongextension");
  });
});

// ─── Display name ───────────────────────────────────────────────────
describe("FileUpload displayName", () => {
  it("has display name 'FileUpload'", () => {
    expect(FileUpload.displayName).toBe("FileUpload");
  });
});

// ─── FILE_ACCEPT_GROUPS ─────────────────────────────────────────────
describe("FILE_ACCEPT_GROUPS", () => {
  it("contains images group", () => {
    expect(FILE_ACCEPT_GROUPS.images).toContain("image/jpeg");
    expect(FILE_ACCEPT_GROUPS.images).toContain("image/png");
  });

  it("contains media group with images, videos, audio", () => {
    expect(FILE_ACCEPT_GROUPS.media).toContain("image/jpeg");
    expect(FILE_ACCEPT_GROUPS.media).toContain("video/mp4");
    expect(FILE_ACCEPT_GROUPS.media).toContain("audio/mpeg");
  });

  it("contains all group as '*'", () => {
    expect(FILE_ACCEPT_GROUPS.all).toBe("*");
  });
});

// ─── Accept description ─────────────────────────────────────────────
describe("FileUpload accept description", () => {
  it("shows file type description when allowedTypes has few types", () => {
    setup({ allowedTypes: ["image/jpeg", "image/png"] });
    expect(screen.getByText(/\.jpeg, \.png/)).toBeInTheDocument();
  });

  it("shows count when many types are allowed", () => {
    setup({
      allowedTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "image/gif",
        "image/svg+xml",
      ],
    });
    expect(screen.getByText(/6 file types allowed/)).toBeInTheDocument();
  });
});

// ─── Upload simulation ──────────────────────────────────────────────
describe("FileUpload upload simulation", () => {
  it("calls onUpload when custom upload handler is provided", async () => {
    const onUpload = jest.fn().mockResolvedValue(undefined);
    const ref = React.createRef<{ startUpload: () => void }>();
    const { container } = render(<FileUpload ref={ref} onUpload={onUpload} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("up.jpg", 500, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      ref.current?.startUpload();
    });

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalled();
    });
  });
});

// ─── Revoke object URLs on unmount ──────────────────────────────────
describe("FileUpload cleanup", () => {
  it("revokes object URLs on unmount", async () => {
    const revokeSpy = jest.spyOn(URL, "revokeObjectURL");
    const { container, unmount } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(createMockFile("temp.jpg", 1000, "image/jpeg"));
    input.files = dt.files;

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("temp.jpg")).toBeInTheDocument();
    });

    unmount();

    expect(revokeSpy).toHaveBeenCalled();
    revokeSpy.mockRestore();
  });
});