"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud,
  File,
  Image,
  Film,
  Music,
  FileText,
  Archive,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Constants ──────────────────────────────────────────────────────

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
];

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/mp4",
];

const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/json",
  "text/markdown",
];

const ACCEPTED_ARCHIVE_TYPES = [
  "application/zip",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
];

/** Predefined accept groups for convenient filtering */
export const FILE_ACCEPT_GROUPS = {
  images: ACCEPTED_IMAGE_TYPES.join(","),
  videos: ACCEPTED_VIDEO_TYPES.join(","),
  audio: ACCEPTED_AUDIO_TYPES.join(","),
  documents: ACCEPTED_DOCUMENT_TYPES.join(","),
  archives: ACCEPTED_ARCHIVE_TYPES.join(","),
  media: [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_AUDIO_TYPES].join(","),
  all: "*",
} as const;

// ─── Formatting Utilities ───────────────────────────────────────────

/** Format bytes to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Derive file category from MIME type */
export function getFileCategory(
  mimeType: string,
): "image" | "video" | "audio" | "document" | "archive" | "unknown" {
  if (ACCEPTED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (ACCEPTED_VIDEO_TYPES.includes(mimeType)) return "video";
  if (ACCEPTED_AUDIO_TYPES.includes(mimeType)) return "audio";
  if (ACCEPTED_DOCUMENT_TYPES.includes(mimeType)) return "document";
  if (ACCEPTED_ARCHIVE_TYPES.includes(mimeType)) return "archive";
  return "unknown";
}

/** Truncate filename for display while preserving extension */
export function truncateFilename(filename: string, maxLength = 24): string {
  if (filename.length <= maxLength) return filename;
  const extIndex = filename.lastIndexOf(".");
  if (extIndex === -1) {
    return filename.slice(0, maxLength - 3) + "...";
  }
  const ext = filename.slice(extIndex);
  const name = filename.slice(0, extIndex);
  const available = maxLength - ext.length - 3;
  if (available <= 0) return "..." + ext;
  return name.slice(0, available) + "..." + ext;
}

// ─── Variant Definitions ────────────────────────────────────────────

const uploadAreaVariants = cva(
  [
    "relative flex flex-col items-center justify-center",
    "rounded-lg border-2 border-dashed",
    "transition-all duration-200",
    "cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-border bg-surface-secondary/50",
          "hover:border-brand-400 hover:bg-surface-secondary",
          "active:border-brand-500",
        ],
        filled: [
          "border-surface-tertiary bg-surface-tertiary",
          "hover:border-brand-400 hover:bg-surface-secondary",
          "active:border-brand-500",
        ],
        minimal: [
          "border-transparent bg-transparent",
          "hover:border-border hover:bg-surface-secondary/50",
          "active:border-brand-400",
        ],
      },
      size: {
        sm: "p-4 gap-1.5 min-h-[120px]",
        md: "p-6 gap-2 min-h-[160px]",
        lg: "p-8 gap-3 min-h-[200px]",
      },
      isDragActive: {
        true: [
          "border-brand-500 bg-brand-50/50",
          "ring-2 ring-brand-500/20",
          "scale-[1.01]",
        ],
        false: "",
      },
      isDisabled: {
        true: "opacity-50 cursor-not-allowed pointer-events-none",
        false: "",
      },
      isError: {
        true: "border-danger-400 bg-danger-50/30 hover:border-danger-500",
        false: "",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    compoundVariants: [
      {
        isDragActive: true,
        isError: true,
        className: "border-brand-500 bg-brand-50/50 ring-brand-500/20",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
      isDragActive: false,
      isDisabled: false,
      isError: false,
    },
  },
);

const fileItemVariants = cva(
  [
    "relative flex items-center gap-3",
    "rounded-lg border border-border",
    "bg-surface",
    "transition-all duration-200",
    "group",
  ],
  {
    variants: {
      size: {
        sm: "p-2",
        md: "p-3",
        lg: "p-4",
      },
      hasError: {
        true: "border-danger-300 bg-danger-50/30",
        false: "",
      },
      isUploading: {
        true: "border-brand-200 bg-brand-50/20",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      hasError: false,
      isUploading: false,
    },
  },
);

const previewVariants = cva(
  [
    "relative flex-shrink-0 overflow-hidden rounded-md",
    "flex items-center justify-center",
    "bg-surface-secondary",
    "border border-border-subtle",
  ],
  {
    variants: {
      size: {
        sm: "h-10 w-10",
        md: "h-12 w-12",
        lg: "h-16 w-16",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const progressBarVariants = cva(
  ["absolute bottom-0 left-0 h-1 rounded-full", "transition-all duration-300 ease-out"],
  {
    variants: {
      status: {
        uploading: "bg-brand-500",
        complete: "bg-success-500",
        error: "bg-danger-500",
      },
    },
    defaultVariants: {
      status: "uploading",
    },
  },
);

// ─── Types ──────────────────────────────────────────────────────────

/** Represents a single file in the upload queue */
export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
}

/** Validation rule for files */
export interface FileValidationRule {
  allowedTypes?: string[];
  maxSize?: number;
  minSize?: number;
  maxTotalSize?: number;
  maxFiles?: number;
  minFiles?: number;
  customValidator?: (file: File) => string | null;
}

/** Imperative handle exposed via ref */
export interface FileUploadHandles {
  openFileDialog: () => void;
  clearFiles: () => void;
  removeFile: (id: string) => void;
  getFiles: () => UploadFile[];
  startUpload: () => void;
  reset: () => void;
}

type FileUploadVariant = VariantProps<typeof uploadAreaVariants>["variant"];
type FileUploadSize = VariantProps<typeof uploadAreaVariants>["size"];

interface FileUploadBaseProps {
  variant?: FileUploadVariant;
  size?: FileUploadSize;
  fullWidth?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  minSize?: number;
  maxTotalSize?: number;
  minFiles?: number;
  allowedTypes?: string[];
  validation?: FileValidationRule;
  showPreview?: boolean;
  showFileSize?: boolean;
  showRemoveButton?: boolean;
  showProgressBar?: boolean;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  dragActiveText?: string;
  browseLabel?: string;
  error?: string;
  hint?: string;
  files?: UploadFile[];
  onFilesChange?: (files: UploadFile[]) => void;
  onFileAdd?: (file: UploadFile) => void;
  onFileRemove?: (fileId: string) => void;
  onFilesClear?: () => void;
  onValidationError?: (errors: string[]) => void;
  onUpload?: (files: UploadFile[]) => void | Promise<void>;
  onUploadComplete?: (file: UploadFile) => void;
  renderFileItem?: (file: UploadFile, onRemove: (id: string) => void) => React.ReactNode;
  className?: string;
}

export type FileUploadProps = FileUploadBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof FileUploadBaseProps | "onError">;

// ─── Helpers ────────────────────────────────────────────────────────

let fileIdCounter = 0;
function generateFileId(): string {
  fileIdCounter += 1;
  return `file-${Date.now()}-${fileIdCounter}`;
}

function createPreviewUrl(file: File): string | undefined {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return URL.createObjectURL(file);
  }
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

function revokePreviewUrl(url?: string): void {
  if (url && (url.startsWith("blob:") || url.startsWith("data:"))) {
    URL.revokeObjectURL(url);
  }
}

function validateFile(
  file: File,
  index: number,
  allFiles: UploadFile[],
  rules: FileValidationRule,
): string | null {
  if (rules.allowedTypes && rules.allowedTypes.length > 0) {
    const isAllowed = rules.allowedTypes.some((t) => {
      if (t.endsWith("/*")) {
        return file.type.startsWith(t.slice(0, -1));
      }
      return file.type === t;
    });
    if (!isAllowed) {
      const allowed = rules.allowedTypes.map((t) => t.replace("/*", "/* files")).join(", ");
      return `File type "${file.type || "unknown"}" is not allowed. Accepted: ${allowed}`;
    }
  }

  if (rules.maxSize && file.size > rules.maxSize) {
    return `File "${file.name}" exceeds the maximum size of ${formatFileSize(rules.maxSize)}.`;
  }

  if (rules.minSize && file.size < rules.minSize) {
    return `File "${file.name}" is below the minimum size of ${formatFileSize(rules.minSize)}.`;
  }

  if (rules.maxFiles && allFiles.length >= rules.maxFiles) {
    return `Maximum ${rules.maxFiles} file(s) allowed.`;
  }

  if (rules.maxTotalSize) {
    const currentTotal = allFiles.reduce((sum, f) => sum + f.file.size, 0);
    if (currentTotal + file.size > rules.maxTotalSize) {
      return `Adding this file would exceed the total size limit of ${formatFileSize(rules.maxTotalSize)}.`;
    }
  }

  if (rules.customValidator) {
    return rules.customValidator(file);
  }

  return null;
}

// ─── File Type Icons ────────────────────────────────────────────────

const fileIconMap: Record<string, React.FC<{ className?: string }>> = {
  image: Image,
  video: Film,
  audio: Music,
  document: FileText,
  archive: Archive,
  unknown: File,
};

function FileTypeIcon({
  category,
  className,
}: {
  category: ReturnType<typeof getFileCategory>;
  className?: string;
}) {
  const Icon = fileIconMap[category] || File;
  const colorMap: Record<string, string> = {
    image: "text-info-500",
    video: "text-accent-500",
    audio: "text-warning-500",
    document: "text-brand-500",
    archive: "text-neutral-500",
    unknown: "text-text-tertiary",
  };
  return <Icon className={cn("shrink-0", colorMap[category], className)} />;
}

// ─── Component ──────────────────────────────────────────────────────

const FileUpload = forwardRef<FileUploadHandles, FileUploadProps>((props, ref) => {
  const {
    variant = "default",
    size = "md",
    fullWidth,
    disabled = false,
    multiple = true,
    accept,
    maxFiles = 10,
    maxSize = 10 * 1024 * 1024,
    minSize,
    maxTotalSize,
    minFiles,
    allowedTypes,
    validation: validationProp,
    showPreview = true,
    showFileSize = true,
    showRemoveButton = true,
    showProgressBar = true,
    title = "Drag & drop files here",
    subtitle = "or click to browse",
    icon,
    dragActiveText = "Drop files to upload",
    browseLabel = "Browse files",
    error: errorProp,
    hint,
    files: controlledFiles,
    onFilesChange,
    onFileAdd,
    onFileRemove,
    onFilesClear,
    onValidationError,
    onUpload,
    onUploadComplete,
    renderFileItem,
    className,
    children,
    ...rest
  } = props;

  // ── IDs ────────────────────────────────────────────────────────
  const autoId = useId();
  const inputId = `${autoId}-input`;
  const errorId = `${autoId}-error`;
  const hintId = `${autoId}-hint`;

  // ── Refs ────────────────────────────────────────────────────────
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ───────────────────────────────────────────────────────
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [internalFiles, setInternalFiles] = useState<UploadFile[]>([]);
  const [internalError, setInternalError] = useState<string | undefined>(undefined);

  const isControlled = controlledFiles !== undefined;
  const files = isControlled ? controlledFiles : internalFiles;
  const displayError = errorProp ?? internalError;

  // ── Derived validation rules ───────────────────────────────────
  const validationRules = useMemo<FileValidationRule>(() => {
    return {
      allowedTypes: allowedTypes ?? validationProp?.allowedTypes,
      maxSize: maxSize ?? validationProp?.maxSize,
      minSize: minSize ?? validationProp?.minSize,
      maxTotalSize: maxTotalSize ?? validationProp?.maxTotalSize,
      maxFiles: maxFiles ?? validationProp?.maxFiles,
      minFiles: minFiles ?? validationProp?.minFiles,
      customValidator: validationProp?.customValidator,
    };
  }, [allowedTypes, maxSize, minSize, maxTotalSize, maxFiles, minFiles, validationProp]);

  // ── File management ─────────────────────────────────────────────
  const updateFiles = useCallback(
    (newFiles: UploadFile[]) => {
      if (!isControlled) {
        setInternalFiles(newFiles);
      }
      onFilesChange?.(newFiles);
    },
    [isControlled, onFilesChange],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const errors: string[] = [];
      const newUploadFiles: UploadFile[] = [];

      for (let i = 0; i < incoming.length; i++) {
        const file = incoming[i];
        const validationError = validateFile(file, i, files, validationRules);

        if (validationError) {
          errors.push(validationError);
          continue;
        }

        const uploadFile: UploadFile = {
          id: generateFileId(),
          file,
          progress: 0,
          status: "pending",
          previewUrl: createPreviewUrl(file),
        };

        newUploadFiles.push(uploadFile);
        onFileAdd?.(uploadFile);
      }

      if (errors.length > 0) {
        setInternalError(errors.join("\n"));
        onValidationError?.(errors);
      } else {
        setInternalError(undefined);
      }

      if (newUploadFiles.length > 0) {
        const combined = [...files, ...newUploadFiles].slice(0, maxFiles);
        updateFiles(combined);
      }
    },
    [files, validationRules, maxFiles, onFileAdd, onValidationError, updateFiles],
  );

  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = files.find((f) => f.id === id);
      if (fileToRemove) {
        revokePreviewUrl(fileToRemove.previewUrl);
        revokePreviewUrl(fileToRemove.thumbnailUrl);
      }
      const updated = files.filter((f) => f.id !== id);
      updateFiles(updated);
      onFileRemove?.(id);

      if (updated.every((f) => f.status !== "error")) {
        setInternalError(undefined);
      }
    },
    [files, onFileRemove, updateFiles],
  );

  const clearFiles = useCallback(() => {
    files.forEach((f) => {
      revokePreviewUrl(f.previewUrl);
      revokePreviewUrl(f.thumbnailUrl);
    });
    updateFiles([]);
    setInternalError(undefined);
    onFilesClear?.();
  }, [files, updateFiles, onFilesClear]);

  // ── Upload simulation ───────────────────────────────────────────
  const startUpload = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === "pending" || f.status === "error");

    if (pendingFiles.length === 0) return;

    const updated = files.map((f) =>
      f.status === "pending" || f.status === "error"
        ? { ...f, status: "uploading" as const, progress: 0, error: undefined }
        : f,
    );
    updateFiles(updated);

    if (onUpload) {
      try {
        await onUpload(pendingFiles);
        const completed = files.map((f) =>
          f.status === "uploading" ? { ...f, status: "complete" as const, progress: 100 } : f,
        );
        updateFiles(completed);
        pendingFiles.forEach((f) => onUploadComplete?.({ ...f, status: "complete", progress: 100 }));
      } catch {
        const errored = files.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error" as const, error: "Upload failed" }
            : f,
        );
        updateFiles(errored);
      }
      return;
    }

    // Simulated upload with progress
    for (const pf of pendingFiles) {
      await new Promise<void>((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 25;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            const allFiles = isControlled ? controlledFiles! : internalFiles;
            const finished = allFiles.map((f) =>
              f.id === pf.id
                ? { ...f, status: "complete" as const, progress: 100 }
                : f,
            );
            updateFiles(finished);
            onUploadComplete?.({
              ...pf,
              status: "complete",
              progress: 100,
            });
            resolve();
          } else {
            const allFiles = isControlled ? controlledFiles! : internalFiles;
            const progressing = allFiles.map((f) =>
              f.id === pf.id ? { ...f, progress: Math.min(Math.round(progress), 99) } : f,
            );
            updateFiles(progressing);
          }
        }, 200);
      });
    }
  }, [files, isControlled, controlledFiles, internalFiles, onUpload, onUploadComplete, updateFiles]);

  // ── Reset ───────────────────────────────────────────────────────
  const reset = useCallback(() => {
    clearFiles();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [clearFiles]);

  // ── Imperative handle ───────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      fileInputRef.current?.click();
    },
    clearFiles,
    removeFile,
    getFiles: () => files,
    startUpload,
    reset,
  }));

  // ── Drag & Drop handlers ────────────────────────────────────────
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setDragCounter((prev) => prev + 1);
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragActive(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsDragActive(false);
          return 0;
        }
        return next;
      });
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      setDragCounter(0);
      if (disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(multiple ? e.dataTransfer.files : [e.dataTransfer.files[0]]);
      }
    },
    [disabled, multiple, addFiles],
  );

  // ── File input handler ──────────────────────────────────────────
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles],
  );

  // ── Keyboard handler for drop zone ──────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [disabled],
  );

  // ── Cleanup preview URLs on unmount ─────────────────────────────
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        revokePreviewUrl(f.previewUrl);
        revokePreviewUrl(f.thumbnailUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ──────────────────────────────────────────────
  const tooFewFiles = minFiles !== undefined && files.length < minFiles && files.length > 0;
  const resolvedAccept = accept ?? validationRules.allowedTypes?.join(",");

  // ── Upload area classes ─────────────────────────────────────────
  const areaClassName = cn(
    uploadAreaVariants({
      variant,
      size,
      isDragActive,
      isDisabled: disabled,
      isError: Boolean(displayError),
      fullWidth,
    }),
    className,
  );

  // ── Render file preview ─────────────────────────────────────────
  const renderPreview = (file: UploadFile) => {
    if (!showPreview) return null;

    const category = getFileCategory(file.file.type);

    if (category === "image" && file.previewUrl) {
      return (
        <div className={cn(previewVariants({ size }))}>
          <img
            src={file.previewUrl}
            alt={file.file.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      );
    }

    if (category === "video" && file.previewUrl) {
      return (
        <div className={cn(previewVariants({ size }))}>
          <video
            src={file.previewUrl}
            className="h-full w-full object-cover"
            muted
            preload="metadata"
          />
        </div>
      );
    }

    return (
      <div className={cn(previewVariants({ size }))}>
        <FileTypeIcon category={category} className="h-5 w-5" />
      </div>
    );
  };

  // ── Render single file item ─────────────────────────────────────
  const renderDefaultFileItem = (file: UploadFile) => {
    const category = getFileCategory(file.file.type);
    const hasError = file.status === "error";
    const isUploading = file.status === "uploading";

    return (
      <motion.div
        key={file.id}
        layout
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className={cn(
          fileItemVariants({
            size,
            hasError,
            isUploading,
          }),
        )}
      >
        {renderPreview(file)}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-text-primary truncate">
              {truncateFilename(file.file.name)}
            </span>
            {file.status === "error" && (
              <AlertCircle className="h-3.5 w-3.5 text-danger-500 shrink-0" aria-hidden="true" />
            )}
            {file.status === "complete" && (
              <CheckCircle2 className="h-3.5 w-3.5 text-success-500 shrink-0" aria-hidden="true" />
            )}
            {file.status === "uploading" && (
              <Loader2 className="h-3.5 w-3.5 text-brand-500 animate-spin shrink-0" aria-hidden="true" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {showFileSize && (
              <span className="text-xs text-text-tertiary">
                {formatFileSize(file.file.size)}
              </span>
            )}
            {file.error && (
              <span className="text-xs text-danger-500 truncate">{file.error}</span>
            )}
          </div>

          {showProgressBar && (file.status === "uploading" || file.status === "pending" || file.status === "complete") && (
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-secondary">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  file.status === "complete"
                    ? "bg-success-500"
                    : file.status === "error"
                      ? "bg-danger-500"
                      : "bg-brand-500",
                )}
                initial={{ width: 0 }}
                animate={{
                  width: `${file.progress}%`,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          )}
        </div>

        {showRemoveButton && file.status !== "uploading" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFile(file.id);
            }}
            className={cn(
              "shrink-0 inline-flex items-center justify-center",
              "h-7 w-7 rounded-md",
              "text-text-tertiary hover:text-danger-500",
              "hover:bg-danger-50",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-border-focus focus-visible:ring-offset-1",
              "opacity-0 group-hover:opacity-100",
              "focus-visible:opacity-100",
            )}
            aria-label={`Remove ${file.file.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}

        {file.status === "uploading" && (
          <span className="shrink-0 text-xs font-medium text-brand-600 tabular-nums">
            {file.progress}%
          </span>
        )}
      </motion.div>
    );
  };

  // ── Accept description ──────────────────────────────────────────
  const acceptDescription = useMemo(() => {
    if (!resolvedAccept && !validationRules.allowedTypes?.length) return null;
    const types = validationRules.allowedTypes;
    if (!types || types.length === 0) return null;
    if (types.length <= 3) {
      return types.map((t) => t.replace("image/", ".").replace("video/", ".")).join(", ");
    }
    return `${types.length} file types allowed`;
  }, [resolvedAccept, validationRules.allowedTypes]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className={cn(fullWidth && "w-full")}>
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        multiple={multiple}
        accept={resolvedAccept}
        onChange={handleFileSelect}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div
        ref={dropZoneRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={areaClassName}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (!disabled) fileInputRef.current?.click();
        }}
        aria-label={title}
        aria-describedby={
          [displayError ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-disabled={disabled || undefined}
        {...rest}
      >
        <div
          className={cn(
            "flex items-center justify-center",
            "rounded-full",
            "transition-all duration-200",
            isDragActive
              ? "bg-brand-100 text-brand-600"
              : "bg-surface-secondary text-text-tertiary",
            size === "sm" ? "h-10 w-10" : size === "lg" ? "h-14 w-14" : "h-12 w-12",
          )}
          aria-hidden="true"
        >
          {icon ?? <UploadCloud className={cn(size === "sm" ? "h-5 w-5" : size === "lg" ? "h-7 w-7" : "h-6 w-6")} />}
        </div>

        <div className="text-center px-2">
          {isDragActive ? (
            <p className={cn("font-medium text-brand-600", size === "sm" ? "text-sm" : "text-base")}>
              {dragActiveText}
            </p>
          ) : (
            <>
              <p className={cn("font-medium text-text-primary", size === "sm" ? "text-sm" : "text-base")}>
                {title}
              </p>
              <p
                className={cn(
                  "text-text-tertiary mt-0.5",
                  size === "sm" ? "text-xs" : "text-sm",
                )}
              >
                {subtitle}{" "}
                <span className="text-brand-500 font-medium underline underline-offset-2">
                  {browseLabel}
                </span>
              </p>
              {acceptDescription && (
                <p className="text-xs text-text-tertiary mt-1">
                  {acceptDescription} up to {formatFileSize(maxSize || validationRules.maxSize || 0)}
                </p>
              )}
            </>
          )}
        </div>

        {children}
      </div>

      {displayError && (
        <div
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-xs text-danger-600"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="whitespace-pre-line">{displayError}</span>
        </div>
      )}
      {!displayError && hint && (
        <div id={hintId} className="mt-2 text-xs text-text-tertiary">
          {hint}
        </div>
      )}
      {!displayError && tooFewFiles && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-warning-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>At least {minFiles} file(s) required.</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <AnimatePresence mode="popLayout">
            {files.map((file) =>
              renderFileItem
                ? renderFileItem(file, removeFile)
                : renderDefaultFileItem(file),
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-2 text-xs text-text-tertiary">
            <span>
              {files.length} / {maxFiles} file(s) — {formatFileSize(files.reduce((sum, f) => sum + f.file.size, 0))}
            </span>
            {files.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFiles();
                }}
                className={cn(
                  "inline-flex items-center gap-1",
                  "text-text-tertiary hover:text-danger-500",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:underline",
                )}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

FileUpload.displayName = "FileUpload";

export {
  FileUpload,
  uploadAreaVariants,
  fileItemVariants,
  previewVariants,
  progressBarVariants,
  FILE_ACCEPT_GROUPS,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  ACCEPTED_AUDIO_TYPES,
  ACCEPTED_DOCUMENT_TYPES,
  ACCEPTED_ARCHIVE_TYPES,
};

export default FileUpload;