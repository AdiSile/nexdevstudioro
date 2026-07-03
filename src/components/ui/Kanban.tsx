"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cva } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Pencil,
} from "lucide-react";

import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface KanbanCardData {
  /** Unique identifier for the card */
  id: string;
  /** Column ID this card belongs to */
  columnId: string;
  /** Swimlane ID this card belongs to (optional) */
  swimlaneId?: string;
  /** Card title */
  title: string;
  /** Card description (optional) */
  description?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
  /** Display order within the column */
  order?: number;
  /** Visual variant */
  variant?: KanbanCardVariant;
}

export interface KanbanColumnData {
  id: string;
  title: string;
  swimlaneId?: string;
  color?: string;
  order?: number;
  /** Max number of cards allowed in this column */
  limit?: number;
  /** Whether cards can be added to this column */
  allowAdd?: boolean;
}

export interface KanbanSwimlaneData {
  id: string;
  title: string;
  order?: number;
  collapsed?: boolean;
}

export type KanbanCardVariant = "default" | "compact" | "detailed";

export interface KanbanDragEvent {
  active: {
    id: string;
    type: "card" | "column";
    data: KanbanCardData | KanbanColumnData;
  };
  over: {
    id: string;
    type: "column" | "card" | "swimlane";
    data?: KanbanColumnData | KanbanCardData | KanbanSwimlaneData;
  } | null;
}

export interface KanbanChangeEvent {
  type: "card-move" | "card-add" | "card-update" | "card-delete" | "column-move" | "column-add" | "column-update" | "column-delete" | "swimlane-add" | "swimlane-update" | "swimlane-delete";
  payload: Record<string, unknown>;
}

export interface KanbanProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Columns data */
  columns: KanbanColumnData[];
  /** Cards data */
  cards: KanbanCardData[];
  /** Swimlanes (optional) */
  swimlanes?: KanbanSwimlaneData[];
  /** Called when the board state changes */
  onChange?: (event: KanbanChangeEvent) => void;
  /** Called when drag starts */
  onDragStart?: (event: KanbanDragEvent) => void;
  /** Called when drag ends */
  onDragEnd?: (event: KanbanDragEvent) => void;
  /** Render custom card content */
  renderCard?: (card: KanbanCardData) => React.ReactNode;
  /** Render custom column header */
  renderColumnHeader?: (column: KanbanColumnData) => React.ReactNode;
  /** Render custom swimlane header */
  renderSwimlaneHeader?: (swimlane: KanbanSwimlaneData) => React.ReactNode;
  /** Whether to enable inline editing of cards */
  enableInlineEdit?: boolean;
  /** Whether to enable inline editing of column titles */
  enableColumnEdit?: boolean;
  /** Whether to enable adding new cards */
  enableAddCard?: boolean;
  /** Whether to enable deleting cards */
  enableDeleteCard?: boolean;
  /** Whether to enable adding new columns */
  enableAddColumn?: boolean;
  /** Whether columns are sortable via drag */
  enableColumnDrag?: boolean;
  /** Whether swimlanes are collapsible */
  enableSwimlaneCollapse?: boolean;
  /** Placeholder text for new card input */
  newCardPlaceholder?: string;
  /** Placeholder text for new column input */
  newColumnPlaceholder?: string;
  /** Empty state message when a column has no cards */
  emptyColumnMessage?: string;
  /** Default card variant */
  cardVariant?: KanbanCardVariant;
  /** Board height (CSS value) */
  height?: string;
  /** Board variant */
  variant?: "default" | "bordered" | "minimal";
  /** Card size */
  size?: "sm" | "md" | "lg";
  /** Disable all interactions */
  disabled?: boolean;
}

export interface KanbanColumnProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  column: KanbanColumnData;
  cards: KanbanCardData[];
  /** Enable inline editing of cards */
  enableInlineEdit?: boolean;
  /** Enable column title editing */
  enableColumnEdit?: boolean;
  /** Enable adding new cards */
  enableAddCard?: boolean;
  /** Enable deleting cards */
  enableDeleteCard?: boolean;
  /** Placeholder for new card */
  newCardPlaceholder?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Card variant */
  cardVariant?: KanbanCardVariant;
  /** Size */
  size?: "sm" | "md" | "lg";
  /** Disabled */
  disabled?: boolean;
  /** Render custom card */
  renderCard?: (card: KanbanCardData) => React.ReactNode;
  /** Render custom header */
  renderHeader?: (column: KanbanColumnData) => React.ReactNode;
  /** Called on card add */
  onCardAdd?: (columnId: string, title: string) => void;
  /** Called on card delete */
  onCardDelete?: (cardId: string) => void;
  /** Called on card update */
  onCardUpdate?: (cardId: string, updates: Partial<KanbanCardData>) => void;
  /** Called on column update */
  onColumnUpdate?: (columnId: string, updates: Partial<KanbanColumnData>) => void;
  /** Called on column delete */
  onColumnDelete?: (columnId: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

interface KanbanContextValue {
  enableInlineEdit: boolean;
  enableColumnEdit: boolean;
  enableAddCard: boolean;
  enableDeleteCard: boolean;
  enableAddColumn: boolean;
  enableColumnDrag: boolean;
  enableSwimlaneCollapse: boolean;
  newCardPlaceholder: string;
  newColumnPlaceholder: string;
  emptyColumnMessage: string;
  cardVariant: KanbanCardVariant;
  size: "sm" | "md" | "lg";
  disabled: boolean;
  renderCard?: (card: KanbanCardData) => React.ReactNode;
  renderColumnHeader?: (column: KanbanColumnData) => React.ReactNode;
  renderSwimlaneHeader?: (swimlane: KanbanSwimlaneData) => React.ReactNode;
  activeId: string | null;
  activeType: "card" | "column" | null;
  setActiveId: (id: string | null) => void;
  setActiveType: (type: "card" | "column" | null) => void;
  handleCardAdd: (columnId: string, title: string, swimlaneId?: string) => void;
  handleCardDelete: (cardId: string) => void;
  handleCardUpdate: (cardId: string, updates: Partial<KanbanCardData>) => void;
  handleColumnAdd: (title: string, swimlaneId?: string) => void;
  handleColumnUpdate: (columnId: string, updates: Partial<KanbanColumnData>) => void;
  handleColumnDelete: (columnId: string) => void;
  handleSwimlaneToggle: (swimlaneId: string) => void;
  onChange?: (event: KanbanChangeEvent) => void;
}

const KanbanContext = createContext<KanbanContextValue | null>(null);

function useKanbanContext(): KanbanContextValue {
  const ctx = useContext(KanbanContext);
  if (!ctx) {
    throw new Error("Kanban compound components must be used within <Kanban>");
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════
// Variants
// ═══════════════════════════════════════════════════════════════════════

const boardVariants = cva(
  "flex gap-0 overflow-x-auto scrollbar-thin scrollbar-thumb-border-subtle scrollbar-track-transparent",
  {
    variants: {
      variant: {
        default: "bg-surface-secondary/30 rounded-xl p-4",
        bordered: "bg-surface-primary border border-border-subtle rounded-xl p-4",
        minimal: "bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const columnVariants = cva(
  "flex shrink-0 flex-col rounded-lg border border-border-subtle bg-surface-primary shadow-sm",
  {
    variants: {
      size: {
        sm: "w-64",
        md: "w-72",
        lg: "w-80",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const cardVariants = cva(
  "group relative cursor-grab rounded-lg border bg-surface-primary p-3 shadow-sm transition-shadow duration-150 active:cursor-grabbing",
  {
    variants: {
      variant: {
        default: "border-border-subtle hover:border-border-default hover:shadow-md",
        compact: "border-border-subtle py-2 px-2.5 text-sm hover:border-border-default",
        detailed: "border-border-subtle hover:border-border-default hover:shadow-md",
      },
      isDragging: {
        true: "shadow-lg ring-2 ring-border-focus opacity-90 rotate-1 scale-105 z-50",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      isDragging: false,
    },
  },
);

const inlineInputVariants = cva(
  "w-full rounded-md border bg-surface-primary px-2 py-1 text-sm outline-none transition-colors",
  {
    variants: {
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════════════════════════════════

function useKanbanSensors() {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  return useMemo(
    () => [pointerSensor, keyboardSensor],
    [pointerSensor, keyboardSensor],
  );
}

function useInlineEdit(
  initialValue: string,
  onSave: (value: string) => void,
  onCancel?: () => void,
) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setValue(initialValue);
  }, [initialValue]);

  const commitEdit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialValue) {
      onSave(trimmed);
    }
    setIsEditing(false);
  }, [value, initialValue, onSave]);

  const cancelEdit = useCallback(() => {
    setValue(initialValue);
    setIsEditing(false);
    onCancel?.();
  }, [initialValue, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  return {
    isEditing,
    value,
    setValue,
    inputRef,
    startEditing,
    commitEdit,
    cancelEdit,
    handleKeyDown,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Sortable Wrappers
// ═══════════════════════════════════════════════════════════════════════

interface SortableColumnWrapperProps {
  column: KanbanColumnData;
  children: React.ReactNode;
  disabled?: boolean;
}

function SortableColumnWrapper({
  column,
  children,
  disabled,
}: SortableColumnWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "column", column },
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {React.cloneElement(children as React.ReactElement, {
        "data-dragging": isDragging || undefined,
        dragHandleProps: listeners,
      })}
    </div>
  );
}

interface SortableCardWrapperProps {
  card: KanbanCardData;
  children: React.ReactNode;
  disabled?: boolean;
}

function SortableCardWrapper({
  card,
  children,
  disabled,
}: SortableCardWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", card },
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {React.cloneElement(children as React.ReactElement, {
        "data-dragging": isDragging || undefined,
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Card Component
// ═══════════════════════════════════════════════════════════════════════

interface KanbanCardComponentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "id"> {
  card: KanbanCardData;
  enableInlineEdit?: boolean;
  enableDelete?: boolean;
  variant?: KanbanCardVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  renderCard?: (card: KanbanCardData) => React.ReactNode;
  onDelete?: (cardId: string) => void;
  onUpdate?: (cardId: string, updates: Partial<KanbanCardData>) => void;
}

function KanbanCardComponent({
  card,
  enableInlineEdit = true,
  enableDelete = true,
  variant = "default",
  size = "md",
  disabled = false,
  renderCard,
  onDelete,
  onUpdate,
  className,
  ...rest
}: KanbanCardComponentProps) {
  const titleEdit = useInlineEdit(
    card.title,
    (value) => onUpdate?.(card.id, { title: value }),
  );

  const descEdit = useInlineEdit(
    card.description ?? "",
    (value) => onUpdate?.(card.id, { description: value }),
  );

  const isDragging = rest["data-dragging"] === "true";

  if (renderCard) {
    return (
      <div
        className={cn(
          cardVariants({ variant, isDragging }),
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Card: ${card.title}`}
        aria-roledescription="draggable card"
        {...rest}
      >
        {renderCard(card)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        cardVariants({ variant, isDragging }),
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Card: ${card.title}`}
      aria-roledescription="draggable card"
      {...rest}
    >
      {/* Drag handle */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-60">
        <GripVertical className="h-3.5 w-3.5 text-text-tertiary" />
      </div>

      <div className="flex flex-col gap-1 pl-3">
        {/* Title with inline edit */}
        {titleEdit.isEditing ? (
          <div className="flex items-center gap-1">
            <input
              ref={titleEdit.inputRef as React.Ref<HTMLInputElement>}
              type="text"
              value={titleEdit.value}
              onChange={(e) => titleEdit.setValue(e.target.value)}
              onKeyDown={titleEdit.handleKeyDown}
              onBlur={titleEdit.commitEdit}
              className={cn(
                inlineInputVariants({ size }),
                "flex-1 border-border-focus ring-1 ring-border-focus font-medium",
              )}
              placeholder="Card title"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                titleEdit.commitEdit();
              }}
              className="rounded p-0.5 text-accent-500 hover:bg-accent-50"
              aria-label="Save title"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                titleEdit.cancelEdit();
              }}
              className="rounded p-0.5 text-text-tertiary hover:bg-surface-secondary"
              aria-label="Cancel edit"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <h4
              className={cn(
                "flex-1 font-medium text-text-primary",
                size === "sm" && "text-xs",
                size === "md" && "text-sm",
                size === "lg" && "text-sm",
              )}
            >
              {card.title}
            </h4>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {enableInlineEdit && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    titleEdit.startEditing();
                  }}
                  className="rounded p-0.5 text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary"
                  aria-label="Edit card title"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {enableDelete && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(card.id);
                  }}
                  className="rounded p-0.5 text-text-tertiary hover:text-danger-500 hover:bg-danger-50"
                  aria-label="Delete card"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {variant !== "compact" && (
          <>
            {descEdit.isEditing ? (
              <div className="flex items-start gap-1">
                <textarea
                  ref={descEdit.inputRef as React.Ref<HTMLTextAreaElement>}
                  value={descEdit.value}
                  onChange={(e) => descEdit.setValue(e.target.value)}
                  onKeyDown={descEdit.handleKeyDown}
                  onBlur={descEdit.commitEdit}
                  className={cn(
                    inlineInputVariants({ size }),
                    "min-h-[40px] resize-none border-border-focus ring-1 ring-border-focus",
                  )}
                  rows={2}
                  placeholder="Add description..."
                />
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      descEdit.commitEdit();
                    }}
                    className="rounded p-0.5 text-accent-500 hover:bg-accent-50"
                    aria-label="Save description"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      descEdit.cancelEdit();
                    }}
                    className="rounded p-0.5 text-text-tertiary hover:bg-surface-secondary"
                    aria-label="Cancel edit"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-1">
                {card.description ? (
                  <p className="flex-1 text-xs text-text-tertiary line-clamp-2">
                    {card.description}
                  </p>
                ) : (
                  enableInlineEdit &&
                  !disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        descEdit.startEditing();
                      }}
                      className="text-xs text-text-quaternary hover:text-text-tertiary transition-colors"
                    >
                      + Add description
                    </button>
                  )
                )}
                {card.description && enableInlineEdit && !disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      descEdit.startEditing();
                    }}
                    className="shrink-0 rounded p-0.5 text-text-quaternary opacity-0 transition-opacity hover:text-text-tertiary group-hover:opacity-100"
                    aria-label="Edit description"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Metadata badges */}
        {variant === "detailed" && card.metadata && Object.keys(card.metadata).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(card.metadata).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-text-tertiary"
              >
                {key}: {String(value)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Add Card Form
// ═══════════════════════════════════════════════════════════════════════

interface AddCardFormProps {
  columnId: string;
  swimlaneId?: string;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  onAdd: (columnId: string, title: string, swimlaneId?: string) => void;
}

function AddCardForm({
  columnId,
  swimlaneId,
  placeholder = "Add a card...",
  size = "md",
  onAdd,
}: AddCardFormProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed) {
      onAdd(columnId, trimmed, swimlaneId);
      setTitle("");
      setIsAdding(false);
    }
  }, [title, columnId, swimlaneId, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        setIsAdding(false);
        setTitle("");
      }
    },
    [handleSubmit],
  );

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left transition-colors",
          "text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary/50",
          size === "sm" && "text-xs py-1.5",
        )}
        aria-label={`Add card to column`}
      >
        <Plus className={cn("h-4 w-4", size === "sm" && "h-3.5 w-3.5")} />
        <span>{placeholder}</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!title.trim()) {
            setIsAdding(false);
          }
        }}
        className={cn(
          inlineInputVariants({ size }),
          "flex-1 border-border-focus ring-1 ring-border-focus",
        )}
        placeholder="Card title"
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="rounded p-1 text-accent-500 hover:bg-accent-50"
        aria-label="Add card"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setIsAdding(false);
          setTitle("");
        }}
        className="rounded p-1 text-text-tertiary hover:bg-surface-secondary"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Column Component
// ═══════════════════════════════════════════════════════════════════════

interface KanbanColumnComponentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  column: KanbanColumnData;
  cards: KanbanCardData[];
  swimlaneId?: string;
  dragHandleProps?: Record<string, unknown>;
}

function KanbanColumnComponent({
  column,
  cards,
  swimlaneId,
  dragHandleProps,
  className,
  ...rest
}: KanbanColumnComponentProps & {
  swimlaneId?: string;
  dragHandleProps?: Record<string, unknown>;
}) {
  const {
    enableInlineEdit,
    enableAddCard,
    enableDeleteCard,
    enableColumnEdit,
    newCardPlaceholder,
    emptyColumnMessage,
    cardVariant,
    size,
    disabled,
    renderCard,
    renderColumnHeader,
    handleCardAdd,
    handleCardDelete,
    handleCardUpdate,
    handleColumnUpdate,
    handleColumnDelete,
  } = useKanbanContext();

  const colEdit = useInlineEdit(
    column.title,
    (value) => handleColumnUpdate(column.id, { title: value }),
  );

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [cards],
  );

  const cardIds = useMemo(() => sortedCards.map((c) => c.id), [sortedCards]);

  return (
    <div
      className={cn(
        columnVariants({ size }),
        className,
      )}
      data-column-id={column.id}
      data-swimlane-id={swimlaneId}
      {...rest}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2.5",
          size === "sm" && "px-2.5 py-2",
        )}
        style={
          column.color
            ? { borderTopColor: column.color, borderTopWidth: "3px", borderTopStyle: "solid" }
            : undefined
        }
      >
        {/* Drag handle */}
        {dragHandleProps && !disabled && (
          <div
            {...dragHandleProps}
            className="cursor-grab text-text-quaternary hover:text-text-tertiary active:cursor-grabbing"
            aria-label="Drag column"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* Column title */}
        <div className="flex-1 min-w-0">
          {renderColumnHeader ? (
            renderColumnHeader(column)
          ) : colEdit.isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={colEdit.inputRef as React.Ref<HTMLInputElement>}
                type="text"
                value={colEdit.value}
                onChange={(e) => colEdit.setValue(e.target.value)}
                onKeyDown={colEdit.handleKeyDown}
                onBlur={colEdit.commitEdit}
                className={cn(
                  inlineInputVariants({ size }),
                  "flex-1 border-border-focus ring-1 ring-border-focus font-semibold",
                )}
                placeholder="Column name"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  colEdit.commitEdit();
                }}
                className="rounded p-0.5 text-accent-500 hover:bg-accent-50"
                aria-label="Save column name"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  colEdit.cancelEdit();
                }}
                className="rounded p-0.5 text-text-tertiary hover:bg-surface-secondary"
                aria-label="Cancel edit"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3
                className={cn(
                  "truncate font-semibold text-text-primary",
                  size === "sm" && "text-xs",
                  size === "md" && "text-sm",
                  size === "lg" && "text-sm",
                )}
              >
                {column.title}
              </h3>
              <span
                className={cn(
                  "shrink-0 rounded-full bg-surface-secondary px-1.5 py-0.5 text-text-tertiary",
                  size === "sm" && "text-[10px]",
                  size === "md" && "text-xs",
                  size === "lg" && "text-xs",
                )}
              >
                {cards.length}
                {column.limit ? `/${column.limit}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Column actions */}
        {!disabled && (
          <div className="flex shrink-0 items-center gap-0.5">
            {enableColumnEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  colEdit.startEditing();
                }}
                className="rounded p-0.5 text-text-quaternary hover:text-text-secondary hover:bg-surface-secondary"
                aria-label="Edit column name"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleColumnDelete(column.id);
              }}
              className="rounded p-0.5 text-text-quaternary hover:text-danger-500 hover:bg-danger-50"
              aria-label="Delete column"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Cards list */}
      <div
        className={cn(
          "flex flex-1 flex-col gap-1.5 overflow-y-auto p-2",
          size === "sm" && "p-1.5 gap-1",
        )}
      >
        <SortableContext
          items={cardIds}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence mode="popLayout">
            {sortedCards.map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                transition={{ duration: 0.15 }}
              >
                <SortableCardWrapper card={card} disabled={disabled}>
                  <KanbanCardComponent
                    card={card}
                    enableInlineEdit={enableInlineEdit}
                    enableDelete={enableDeleteCard}
                    variant={cardVariant}
                    size={size}
                    disabled={disabled}
                    renderCard={renderCard}
                    onDelete={handleCardDelete}
                    onUpdate={handleCardUpdate}
                  />
                </SortableCardWrapper>
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>

        {sortedCards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-text-quaternary">{emptyColumnMessage}</p>
          </div>
        )}
      </div>

      {/* Add card */}
      {enableAddCard && !disabled && (
        <div className="border-t border-border-subtle">
          <AddCardForm
            columnId={column.id}
            swimlaneId={swimlaneId}
            placeholder={newCardPlaceholder}
            size={size}
            onAdd={handleCardAdd}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Swimlane Component
// ═══════════════════════════════════════════════════════════════════════

interface KanbanSwimlaneComponentProps {
  swimlane: KanbanSwimlaneData;
  columns: KanbanColumnData[];
  cards: KanbanCardData[];
}

function KanbanSwimlaneComponent({
  swimlane,
  columns,
  cards,
}: KanbanSwimlaneComponentProps) {
  const {
    enableSwimlaneCollapse,
    enableColumnDrag,
    disabled,
    renderSwimlaneHeader,
    handleSwimlaneToggle,
  } = useKanbanContext();

  const isCollapsed = swimlane.collapsed ?? false;

  const swimlaneColumns = useMemo(
    () =>
      columns
        .filter((col) => col.swimlaneId === swimlane.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [columns, swimlane.id],
  );

  const swimlaneCards = useMemo(
    () => cards.filter((card) => card.swimlaneId === swimlane.id),
    [cards, swimlane.id],
  );

  const columnIds = useMemo(
    () => swimlaneColumns.map((c) => c.id),
    [swimlaneColumns],
  );

  return (
    <div className="flex flex-col" data-swimlane-id={swimlane.id}>
      {/* Swimlane header */}
      <div className="flex items-center gap-2 px-4 py-2">
        {enableSwimlaneCollapse && (
          <button
            type="button"
            onClick={() => handleSwimlaneToggle(swimlane.id)}
            className="rounded p-0.5 text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
            aria-label={isCollapsed ? "Expand swimlane" : "Collapse swimlane"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}

        {renderSwimlaneHeader ? (
          renderSwimlaneHeader(swimlane)
        ) : (
          <h3 className="text-sm font-semibold text-text-secondary">
            {swimlane.title}
          </h3>
        )}

        <span className="text-xs text-text-quaternary">
          {swimlaneCards.length} cards
        </span>
      </div>

      {/* Columns */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex gap-3 overflow-x-auto px-4 pb-3"
          >
            <SortableContext
              items={columnIds}
              strategy={horizontalListSortingStrategy}
            >
              {swimlaneColumns.map((column) => (
                <SortableColumnWrapper
                  key={column.id}
                  column={column}
                  disabled={!enableColumnDrag || disabled}
                >
                  <KanbanColumnComponent
                    column={column}
                    cards={swimlaneCards.filter((c) => c.columnId === column.id)}
                    swimlaneId={swimlane.id}
                  />
                </SortableColumnWrapper>
              ))}
            </SortableContext>

            {/* Add column button */}
            <AddColumnInline swimlaneId={swimlane.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Add Column Inline
// ═══════════════════════════════════════════════════════════════════════

interface AddColumnInlineProps {
  swimlaneId?: string;
}

function AddColumnInline({ swimlaneId }: AddColumnInlineProps) {
  const {
    enableAddColumn,
    newColumnPlaceholder,
    disabled,
    handleColumnAdd,
  } = useKanbanContext();

  if (!enableAddColumn || disabled) return null;

  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed) {
      handleColumnAdd(trimmed, swimlaneId);
      setTitle("");
      setIsAdding(false);
    }
  }, [title, swimlaneId, handleColumnAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        setIsAdding(false);
        setTitle("");
      }
    },
    [handleSubmit],
  );

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className={cn(
          "flex h-fit shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-border-subtle px-4 py-3",
          "text-text-tertiary hover:text-text-secondary hover:border-border-default hover:bg-surface-secondary/30",
          "transition-colors",
        )}
        aria-label="Add column"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm whitespace-nowrap">
          {newColumnPlaceholder}
        </span>
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-focus bg-surface-primary px-3 py-2 shadow-sm">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!title.trim()) setIsAdding(false);
        }}
        className="w-32 border-none bg-transparent text-sm outline-none placeholder:text-text-quaternary"
        placeholder="Column name"
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="rounded p-0.5 text-accent-500 hover:bg-accent-50"
        aria-label="Confirm add column"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setIsAdding(false);
          setTitle("");
        }}
        className="rounded p-0.5 text-text-tertiary hover:bg-surface-secondary"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Drag Overlay Components
// ═══════════════════════════════════════════════════════════════════════

function CardDragOverlay({ card }: { card: KanbanCardData }) {
  return (
    <div
      className={cn(
        cardVariants({ variant: "default", isDragging: true }),
        "w-72",
      )}
    >
      <div className="flex flex-col gap-1 pl-3">
        <h4 className="text-sm font-medium text-text-primary">{card.title}</h4>
        {card.description && (
          <p className="text-xs text-text-tertiary line-clamp-2">
            {card.description}
          </p>
        )}
      </div>
    </div>
  );
}

function ColumnDragOverlay({ column }: { column: KanbanColumnData }) {
  return (
    <div className={cn(columnVariants({ size: "md" }), "opacity-90 shadow-xl rotate-2")}>
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <GripVertical className="h-4 w-4 text-text-quaternary" />
        <h3 className="text-sm font-semibold text-text-primary">{column.title}</h3>
      </div>
      <div className="flex-1 p-2">
        <div className="rounded-lg border border-dashed border-border-subtle py-8 text-center text-xs text-text-quaternary">
          Drop here
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Kanban Board
// ═══════════════════════════════════════════════════════════════════════

function KanbanBoardComponent({
  columns,
  cards,
  swimlanes,
  onChange,
  onDragStart: onDragStartProp,
  onDragEnd: onDragEndProp,
  renderCard,
  renderColumnHeader,
  renderSwimlaneHeader,
  enableInlineEdit = true,
  enableColumnEdit = true,
  enableAddCard = true,
  enableDeleteCard = true,
  enableAddColumn = true,
  enableColumnDrag = true,
  enableSwimlaneCollapse = true,
  newCardPlaceholder = "+ Add card",
  newColumnPlaceholder = "+ Add column",
  emptyColumnMessage = "No cards yet",
  cardVariant = "default",
  height,
  variant = "default",
  size = "md",
  disabled = false,
  className,
  ...rest
}: KanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"card" | "column" | null>(null);
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(
    new Set(),
  );

  const sensors = useKanbanSensors();

  // ── Handlers ────────────────────────────────────────────────────

  const handleCardAdd = useCallback(
    (columnId: string, title: string, swimlaneId?: string) => {
      onChange?.({
        type: "card-add",
        payload: { columnId, title, swimlaneId },
      });
    },
    [onChange],
  );

  const handleCardDelete = useCallback(
    (cardId: string) => {
      onChange?.({
        type: "card-delete",
        payload: { cardId },
      });
    },
    [onChange],
  );

  const handleCardUpdate = useCallback(
    (cardId: string, updates: Partial<KanbanCardData>) => {
      onChange?.({
        type: "card-update",
        payload: { cardId, updates },
      });
    },
    [onChange],
  );

  const handleColumnAdd = useCallback(
    (title: string, swimlaneId?: string) => {
      onChange?.({
        type: "column-add",
        payload: { title, swimlaneId },
      });
    },
    [onChange],
  );

  const handleColumnUpdate = useCallback(
    (columnId: string, updates: Partial<KanbanColumnData>) => {
      onChange?.({
        type: "column-update",
        payload: { columnId, updates },
      });
    },
    [onChange],
  );

  const handleColumnDelete = useCallback(
    (columnId: string) => {
      onChange?.({
        type: "column-delete",
        payload: { columnId },
      });
    },
    [onChange],
  );

  const handleSwimlaneToggle = useCallback(
    (swimlaneId: string) => {
      setCollapsedSwimlanes((prev) => {
        const next = new Set(prev);
        if (next.has(swimlaneId)) {
          next.delete(swimlaneId);
        } else {
          next.add(swimlaneId);
        }
        return next;
      });
    },
    [],
  );

  // ── Drag handlers ───────────────────────────────────────────────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const activeData = active.data.current;

      setActiveId(String(active.id));
      setActiveType(activeData?.type as "card" | "column" | null);

      if (activeData?.type === "card") {
        onDragStartProp?.({
          active: {
            id: String(active.id),
            type: "card",
            data: activeData.card as KanbanCardData,
          },
          over: null,
        });
      } else if (activeData?.type === "column") {
        onDragStartProp?.({
          active: {
            id: String(active.id),
            type: "column",
            data: activeData.column as KanbanColumnData,
          },
          over: null,
        });
      }
    },
    [onDragStartProp],
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Used for visual feedback; main logic in handleDragEnd
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeData = active.data.current;
      const overData = over?.data.current;

      if (!over) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);

      if (activeIdStr === overIdStr) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      if (activeData?.type === "card") {
        const activeCard = activeData.card as KanbanCardData;

        if (overData?.type === "column") {
          // Card dropped on a column
          const targetColumn = overData.column as KanbanColumnData;
          onChange?.({
            type: "card-move",
            payload: {
              cardId: activeCard.id,
              fromColumnId: activeCard.columnId,
              toColumnId: targetColumn.id,
              fromSwimlaneId: activeCard.swimlaneId,
              toSwimlaneId: targetColumn.swimlaneId,
            },
          });

          onDragEndProp?.({
            active: { id: activeCard.id, type: "card", data: activeCard },
            over: { id: targetColumn.id, type: "column", data: targetColumn },
          });
        } else if (overData?.type === "card") {
          // Card dropped on another card (reorder)
          const overCard = overData.card as KanbanCardData;
          onChange?.({
            type: "card-move",
            payload: {
              cardId: activeCard.id,
              fromColumnId: activeCard.columnId,
              toColumnId: overCard.columnId,
              fromSwimlaneId: activeCard.swimlaneId,
              toSwimlaneId: overCard.swimlaneId,
              overCardId: overCard.id,
            },
          });

          onDragEndProp?.({
            active: { id: activeCard.id, type: "card", data: activeCard },
            over: { id: overCard.id, type: "card", data: overCard },
          });
        }
      } else if (activeData?.type === "column") {
        const activeColumn = activeData.column as KanbanColumnData;

        if (overData?.type === "column") {
          const overColumn = overData.column as KanbanColumnData;
          onChange?.({
            type: "column-move",
            payload: {
              columnId: activeColumn.id,
              overColumnId: overColumn.id,
              swimlaneId: activeColumn.swimlaneId,
            },
          });

          onDragEndProp?.({
            active: { id: activeColumn.id, type: "column", data: activeColumn },
            over: { id: overColumn.id, type: "column", data: overColumn },
          });
        }
      }

      setActiveId(null);
      setActiveType(null);
    },
    [onChange, onDragEndProp],
  );

  // ── Active item for overlay ─────────────────────────────────────

  const activeCard = useMemo(() => {
    if (activeType !== "card" || !activeId) return null;
    return cards.find((c) => c.id === activeId) ?? null;
  }, [activeType, activeId, cards]);

  const activeColumn = useMemo(() => {
    if (activeType !== "column" || !activeId) return null;
    return columns.find((c) => c.id === activeId) ?? null;
  }, [activeType, activeId, columns]);

  // ── Context value ───────────────────────────────────────────────

  const ctxValue = useMemo<KanbanContextValue>(
    () => ({
      enableInlineEdit,
      enableColumnEdit,
      enableAddCard,
      enableDeleteCard,
      enableAddColumn,
      enableColumnDrag,
      enableSwimlaneCollapse,
      newCardPlaceholder,
      newColumnPlaceholder,
      emptyColumnMessage,
      cardVariant,
      size,
      disabled,
      renderCard,
      renderColumnHeader,
      renderSwimlaneHeader,
      activeId,
      activeType,
      setActiveId,
      setActiveType,
      handleCardAdd,
      handleCardDelete,
      handleCardUpdate,
      handleColumnAdd,
      handleColumnUpdate,
      handleColumnDelete,
      handleSwimlaneToggle,
      onChange,
    }),
    [
      enableInlineEdit,
      enableColumnEdit,
      enableAddCard,
      enableDeleteCard,
      enableAddColumn,
      enableColumnDrag,
      enableSwimlaneCollapse,
      newCardPlaceholder,
      newColumnPlaceholder,
      emptyColumnMessage,
      cardVariant,
      size,
      disabled,
      renderCard,
      renderColumnHeader,
      renderSwimlaneHeader,
      activeId,
      activeType,
      handleCardAdd,
      handleCardDelete,
      handleCardUpdate,
      handleColumnAdd,
      handleColumnUpdate,
      handleColumnDelete,
      handleSwimlaneToggle,
      onChange,
    ],
  );

  // ── Render ──────────────────────────────────────────────────────

  const hasSwimlanes = swimlanes && swimlanes.length > 0;

  const sortedSwimlanes = useMemo(() => {
    if (!swimlanes) return [];
    return [...swimlanes]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s) => ({
        ...s,
        collapsed: collapsedSwimlanes.has(s.id),
      }));
  }, [swimlanes, collapsedSwimlanes]);

  // Columns without swimlane
  const unassignedColumns = useMemo(
    () =>
      columns
        .filter((col) => !col.swimlaneId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [columns],
  );

  const unassignedColumnIds = useMemo(
    () => unassignedColumns.map((c) => c.id),
    [unassignedColumns],
  );

  return (
    <KanbanContext.Provider value={ctxValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className={cn(
            boardVariants({ variant }),
            "flex flex-col",
            height && `h-[${height}]`,
            className,
          )}
          role="region"
          aria-label="Kanban board"
          aria-roledescription="kanban board"
          {...rest}
        >
          {hasSwimlanes ? (
            <>
              {sortedSwimlanes.map((swimlane) => (
                <KanbanSwimlaneComponent
                  key={swimlane.id}
                  swimlane={swimlane}
                  columns={columns}
                  cards={cards}
                />
              ))}

              {/* Unassigned columns at the bottom */}
              {unassignedColumns.length > 0 && (
                <div className="flex gap-3 overflow-x-auto px-4 pb-4">
                  <SortableContext
                    items={unassignedColumnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {unassignedColumns.map((column) => (
                      <SortableColumnWrapper
                        key={column.id}
                        column={column}
                        disabled={!enableColumnDrag || disabled}
                      >
                        <KanbanColumnComponent
                          column={column}
                          cards={cards.filter((c) => c.columnId === column.id)}
                        />
                      </SortableColumnWrapper>
                    ))}
                  </SortableContext>
                  <AddColumnInline />
                </div>
              )}
            </>
          ) : (
            /* No swimlanes: just columns */
            <div className="flex gap-3 overflow-x-auto">
              <SortableContext
                items={unassignedColumnIds}
                strategy={horizontalListSortingStrategy}
              >
                {unassignedColumns.map((column) => (
                  <SortableColumnWrapper
                    key={column.id}
                    column={column}
                    disabled={!enableColumnDrag || disabled}
                  >
                    <KanbanColumnComponent
                      column={column}
                      cards={cards.filter((c) => c.columnId === column.id)}
                    />
                  </SortableColumnWrapper>
                ))}
              </SortableContext>
              <AddColumnInline />
            </div>
          )}
        </div>

        {/* Drag overlay */}
        <DragOverlay
          adjustScale={false}
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.18, 0.89, 0.32, 1.05)",
          }}
        >
          {activeCard && <CardDragOverlay card={activeCard} />}
          {activeColumn && <ColumnDragOverlay column={activeColumn} />}
        </DragOverlay>
      </DndContext>
    </KanbanContext.Provider>
  );
}

KanbanBoardComponent.displayName = "Kanban";

// ═══════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════

const Kanban = KanbanBoardComponent as (
  props: KanbanProps,
) => React.ReactElement;

export {
  // Main component
  Kanban,
  KanbanBoardComponent as KanbanBoard,

  // Sub-components for custom compositions
  KanbanCardComponent as KanbanCard,
  KanbanColumnComponent as KanbanColumn,
  KanbanSwimlaneComponent as KanbanSwimlane,

  // Variants
  boardVariants,
  columnVariants,
  cardVariants,
  inlineInputVariants,

  // Hooks
  useKanbanContext,
  useInlineEdit,
  useKanbanSensors,

  // Wrappers
  SortableColumnWrapper,
  SortableCardWrapper,

  // Types
  type KanbanProps,
  type KanbanCardData,
  type KanbanColumnData,
  type KanbanSwimlaneData,
  type KanbanCardVariant,
  type KanbanDragEvent,
  type KanbanChangeEvent,
  type KanbanColumnProps,
};

export default Kanban;