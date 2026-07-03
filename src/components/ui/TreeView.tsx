"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { cva } from "class-variance-authority";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight,
  GripVertical,
  Folder,
  FolderOpen,
  File,
  Loader2,
  Minus,
  Check,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Types ──────────────────────────────────────────────────────────

export type TreeNodeId = string | number;

export interface TreeNode {
  /** Unique identifier */
  id: TreeNodeId;
  /** Display label */
  label: string;
  /** Optional icon before label */
  icon?: React.ReactNode;
  /** Children nodes (loaded synchronously or initially) */
  children?: TreeNode[];
  /** Whether this node has children (for lazy load) */
  hasChildren?: boolean;
  /** Custom data payload */
  data?: Record<string, unknown>;
  /** If true, node cannot be expanded (leaf) */
  isLeaf?: boolean;
  /** Disable interaction on this node */
  disabled?: boolean;
  /** Disable drag on this node */
  disableDrag?: boolean;
  /** Disable drop under this node */
  disableDrop?: boolean;
}

export interface TreeViewDragResult {
  /** The dragged node id */
  activeId: TreeNodeId;
  /** The node id over which active was dropped */
  overId: TreeNodeId;
  /** Where relative to over node: "before", "after", "inside" */
  position: "before" | "after" | "inside";
}

export interface TreeViewCheckResult {
  /** All currently checked node ids */
  checked: TreeNodeId[];
  /** The node id that was just toggled */
  triggeredId: TreeNodeId;
  /** New checked state of the toggled node */
  newState: boolean;
}

export type TreeViewSize = "sm" | "md" | "lg";

export interface TreeViewProps {
  /** Array of root tree nodes */
  nodes: TreeNode[];
  /** Size variant */
  size?: TreeViewSize;
  /** Enable checkboxes for selection */
  enableCheckboxes?: boolean;
  /** Controlled checked ids */
  checkedIds?: TreeNodeId[];
  /** Called when checkbox selection changes */
  onCheckChange?: (result: TreeViewCheckResult) => void;
  /** Enable drag and drop reorder */
  enableDragDrop?: boolean;
  /** Called after a successful drag and drop */
  onDragEnd?: (result: TreeViewDragResult) => void;
  /** Enable lazy loading of children */
  enableLazyLoad?: boolean;
  /** Async function to load children for a node; return array of TreeNode */
  onLazyLoad?: (nodeId: TreeNodeId, node: TreeNode) => Promise<TreeNode[]>;
  /** Controlled expanded node ids */
  expandedIds?: TreeNodeId[];
  /** Called when expand/collapse state changes */
  onExpandChange?: (expandedIds: TreeNodeId[]) => void;
  /** Callback when a node is clicked */
  onNodeClick?: (nodeId: TreeNodeId, node: TreeNode) => void;
  /** Callback when a node receives focus via keyboard */
  onNodeFocus?: (nodeId: TreeNodeId, node: TreeNode) => void;
  /** Render a custom label instead of default <span> */
  renderLabel?: (node: TreeNode) => React.ReactNode;
  /** Render custom icon per node */
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
  /** Show connecting guide lines */
  showGuides?: boolean;
  /** Indentation width in px per depth level */
  indentWidth?: number;
  /** Additional class on the wrapper */
  className?: string;
  /** Show loading spinner on root */
  loading?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Show node count badge */
  showNodeCount?: boolean;
}

export interface TreeViewRef {
  /** Expand a node by id */
  expand: (nodeId: TreeNodeId) => void;
  /** Collapse a node by id */
  collapse: (nodeId: TreeNodeId) => void;
  /** Toggle a node by id */
  toggle: (nodeId: TreeNodeId) => void;
  /** Scroll to a node by id */
  scrollTo: (nodeId: TreeNodeId) => void;
  /** Returns list of currently expanded ids */
  getExpandedIds: () => TreeNodeId[];
  /** Returns list of currently checked ids */
  getCheckedIds: () => TreeNodeId[];
}

// ─── Variants ───────────────────────────────────────────────────────

const treeWrapperVariants = cva(
  [
    "w-full overflow-auto",
    "rounded-md border border-border",
    "bg-surface",
    "shadow-elevation-1",
  ],
  {
    variants: {
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const treeItemVariants = cva(
  [
    "flex items-center gap-1.5",
    "cursor-pointer select-none",
    "rounded-sm",
    "transition-colors duration-100",
    "group/tree-item",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset",
  ],
  {
    variants: {
      size: {
        sm: "py-0.5 px-1 text-xs",
        md: "py-1 px-1.5 text-sm",
        lg: "py-1.5 px-2 text-base",
      },
      isSelected: {
        true: "bg-brand-50 text-brand-700",
        false: "text-text-primary hover:bg-surface-secondary",
      },
      isDropTarget: {
        true: "ring-2 ring-brand-400 bg-brand-50",
        false: "",
      },
      isDragOver: {
        true: "border-t-2 border-brand-500",
        false: "",
      },
      isDragging: {
        true: "opacity-40",
        false: "",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      isSelected: false,
      isDropTarget: false,
      isDragOver: false,
      isDragging: false,
      disabled: false,
    },
  },
);

const expandButtonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "shrink-0",
    "rounded-sm",
    "text-text-tertiary hover:text-text-primary",
    "hover:bg-surface-tertiary active:bg-neutral-200",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
  ],
  {
    variants: {
      size: {
        sm: "h-4 w-4",
        md: "h-5 w-5",
        lg: "h-6 w-6",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const checkboxVariants = cva(
  [
    "inline-flex items-center justify-center",
    "shrink-0",
    "rounded-sm border transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1",
  ],
  {
    variants: {
      checked: {
        true: "border-brand-500 bg-brand-500 text-text-inverse",
        false: "border-border bg-surface hover:border-border-strong",
      },
      indeterminate: {
        true: "border-brand-500 bg-brand-500 text-text-inverse",
        false: "",
      },
      size: {
        sm: "h-3.5 w-3.5",
        md: "h-4 w-4",
        lg: "h-5 w-5",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
        false: "",
      },
    },
    defaultVariants: {
      checked: false,
      indeterminate: false,
      size: "md",
      disabled: false,
    },
  },
);

const dragHandleVariants = cva(
  [
    "shrink-0",
    "text-text-tertiary opacity-0 group-hover/tree-item:opacity-100 transition-opacity",
    "cursor-grab active:cursor-grabbing",
    "rounded-sm hover:bg-surface-tertiary hover:text-text-primary",
  ],
  {
    variants: {
      size: {
        sm: "h-3 w-3",
        md: "h-3.5 w-3.5",
        lg: "h-4 w-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const guideLineVariants = cva("border-l border-border-subtle", {
  variants: {
    visible: {
      true: "",
      false: "border-transparent",
    },
    isLastChild: {
      true: "h-[50%]",
      false: "h-full",
    },
  },
  defaultVariants: {
    visible: true,
    isLastChild: false,
  },
});

// ─── Utility: Flatten tree & collect ids ────────────────────────────

interface FlattenedNode {
  node: TreeNode;
  depth: number;
  parentId: TreeNodeId | null;
  index: number;
  isLastChild: boolean;
  path: TreeNodeId[];
}

function flattenTree(
  nodes: TreeNode[],
  expandedIds: Set<TreeNodeId>,
  depth: number = 0,
  parentId: TreeNodeId | null = null,
  path: TreeNodeId[] = [],
): FlattenedNode[] {
  const result: FlattenedNode[] = [];

  nodes.forEach((node, index) => {
    const currentPath = [...path, node.id];
    const isLastChild = index === nodes.length - 1;

    result.push({
      node,
      depth,
      parentId,
      index,
      isLastChild,
      path: currentPath,
    });

    if (node.children && expandedIds.has(node.id)) {
      result.push(
        ...flattenTree(node.children, expandedIds, depth + 1, node.id, currentPath),
      );
    }
  });

  return result;
}

function collectAllDescendantIds(node: TreeNode): TreeNodeId[] {
  const ids: TreeNodeId[] = [];
  if (node.children) {
    for (const child of node.children) {
      ids.push(child.id);
      ids.push(...collectAllDescendantIds(child));
    }
  }
  return ids;
}

function collectChildIds(nodes: TreeNode[]): TreeNodeId[] {
  const ids: TreeNodeId[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    ids.push(...collectAllDescendantIds(node));
  }
  return ids;
}

function findNodeInTree(nodes: TreeNode[], id: TreeNodeId): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ─── Utility: Checked state propagation ─────────────────────────────

function computeCheckedState(
  nodes: TreeNode[],
  checkedIds: Set<TreeNodeId>,
): {
  checked: Set<TreeNodeId>;
  indeterminate: Set<TreeNodeId>;
} {
  const checked = new Set<TreeNodeId>();
  const indeterminate = new Set<TreeNodeId>();

  function process(node: TreeNode): { allChecked: boolean; anyChecked: boolean } {
    if (!node.children || node.children.length === 0) {
      const isChecked = checkedIds.has(node.id);
      if (isChecked) checked.add(node.id);
      return { allChecked: isChecked, anyChecked: isChecked };
    }

    let allChildrenChecked = true;
    let anyChildChecked = false;

    for (const child of node.children) {
      const childResult = process(child);
      if (!childResult.allChecked) allChildrenChecked = false;
      if (childResult.anyChecked) anyChildChecked = true;
    }

    if (allChildrenChecked) {
      checked.add(node.id);
    } else if (anyChildChecked) {
      indeterminate.add(node.id);
    }

    return { allChecked, anyChecked };
  }

  for (const node of nodes) {
    process(node);
  }

  return { checked, indeterminate };
}

// ─── Sub-components ─────────────────────────────────────────────────

interface ExpandIconProps {
  isExpanded: boolean;
  hasChildren: boolean;
  size: TreeViewSize;
  loading: boolean;
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
}

function ExpandIcon({
  isExpanded,
  hasChildren,
  size,
  loading,
  onClick,
  ariaLabel,
}: ExpandIconProps) {
  if (loading) {
    return (
      <span className={cn(expandButtonVariants({ size }))} aria-label="Se încarcă...">
        <Loader2
          className={cn(
            "animate-spin",
            size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5",
          )}
          aria-hidden="true"
        />
      </span>
    );
  }

  if (!hasChildren) {
    return <span className={cn(expandButtonVariants({ size }), "invisible")} aria-hidden="true" />;
  }

  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      className={expandButtonVariants({ size })}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={isExpanded}
      tabIndex={-1}
    >
      <ChevronRight
        className={cn(iconSize, "transition-transform duration-200", isExpanded && "rotate-90")}
        aria-hidden="true"
      />
    </button>
  );
}

interface TreeCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  size: TreeViewSize;
  onChange: () => void;
  ariaLabel: string;
}

function TreeCheckbox({
  checked,
  indeterminate,
  disabled,
  size,
  onChange,
  ariaLabel,
}: TreeCheckboxProps) {
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3";

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled) onChange();
    },
    [disabled, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onChange();
      }
    },
    [disabled, onChange],
  );

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={checkboxVariants({
        checked,
        indeterminate,
        size,
        disabled,
      })}
    >
      {indeterminate ? (
        <Minus className={iconSize} aria-hidden="true" />
      ) : checked ? (
        <Check className={iconSize} aria-hidden="true" />
      ) : null}
    </button>
  );
}

function DefaultNodeIcon({
  node,
  isExpanded,
  size,
}: {
  node: TreeNode;
  isExpanded: boolean;
  size: TreeViewSize;
}) {
  if (node.icon) {
    return <span className="shrink-0 inline-flex">{node.icon}</span>;
  }

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  if (node.isLeaf) {
    return <File className={cn(iconSize, "text-text-tertiary shrink-0")} aria-hidden="true" />;
  }

  return isExpanded ? (
    <FolderOpen className={cn(iconSize, "text-amber-500 shrink-0")} aria-hidden="true" />
  ) : (
    <Folder className={cn(iconSize, "text-amber-400 shrink-0")} aria-hidden="true" />
  );
}

// ─── Sortable Tree Item ─────────────────────────────────────────────

interface SortableTreeItemProps {
  flatNode: FlattenedNode;
  size: TreeViewSize;
  isExpanded: boolean;
  isLoading: boolean;
  isChecked: boolean;
  isIndeterminate: boolean;
  enableCheckboxes: boolean;
  enableDragDrop: boolean;
  showGuides: boolean;
  indentWidth: number;
  hasChildren: boolean;
  selectedId: TreeNodeId | null;
  dropTargetId: TreeNodeId | null;
  dragOverId: TreeNodeId | null;
  draggingId: TreeNodeId | null;
  onExpandToggle: (nodeId: TreeNodeId) => void;
  onCheckToggle: (nodeId: TreeNodeId) => void;
  onSelect: (nodeId: TreeNodeId, node: TreeNode) => void;
  onFocus: (nodeId: TreeNodeId, node: TreeNode) => void;
  onDragHandleProps: (props: Record<string, unknown>) => void;
  renderLabel?: (node: TreeNode) => React.ReactNode;
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
  showNodeCount: boolean;
}

function SortableTreeItem({
  flatNode,
  size,
  isExpanded,
  isLoading,
  isChecked,
  isIndeterminate,
  enableCheckboxes,
  enableDragDrop,
  showGuides,
  indentWidth,
  hasChildren,
  selectedId,
  dropTargetId,
  dragOverId,
  draggingId,
  onExpandToggle,
  onCheckToggle,
  onSelect,
  onFocus,
  onDragHandleProps,
  renderLabel,
  renderIcon,
  showNodeCount,
}: SortableTreeItemProps) {
  const { node, depth, isLastChild } = flatNode;
  const nodeId = node.id;
  const isSelected = selectedId === nodeId;
  const isDropTarget = dropTargetId === nodeId;
  const isDragOver = dragOverId === nodeId;
  const isDragging = draggingId === nodeId;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: nodeId,
    disabled: node.disableDrag || !enableDragDrop || node.disabled,
    data: { type: "tree-item", nodeId, depth, node },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: depth * indentWidth,
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!node.disabled) {
        onSelect(nodeId, node);
      }
    },
    [nodeId, node, onSelect],
  );

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!node.disabled) {
        onExpandToggle(nodeId);
      }
    },
    [nodeId, node.disabled, onExpandToggle],
  );

  const handleCheckToggle = useCallback(() => {
    if (!node.disabled) {
      onCheckToggle(nodeId);
    }
  }, [nodeId, node.disabled, onCheckToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" && hasChildren && !isExpanded) {
        e.preventDefault();
        onExpandToggle(nodeId);
      } else if (e.key === "ArrowLeft" && hasChildren && isExpanded) {
        e.preventDefault();
        onExpandToggle(nodeId);
      }
    },
    [hasChildren, isExpanded, nodeId, onExpandToggle],
  );

  const handleFocus = useCallback(() => {
    onFocus(nodeId, node);
  }, [nodeId, node, onFocus]);

  const childrenCount =
    node.children?.length ?? 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="relative list-none"
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-disabled={node.disabled || undefined}
    >
      {/* Guide lines */}
      {showGuides && depth > 0 && (
        <>
          {/* Vertical line from parent */}
          <div
            className={cn(
              "absolute left-0 top-0 border-l border-border-subtle",
              isLastChild ? "h-[50%]" : "h-full",
            )}
            style={{ left: (depth - 1) * indentWidth + indentWidth / 2 }}
            aria-hidden="true"
          />
          {/* Horizontal connector */}
          <div
            className="absolute top-[50%] border-t border-border-subtle"
            style={{
              left: (depth - 1) * indentWidth + indentWidth / 2,
              width: indentWidth / 2,
            }}
            aria-hidden="true"
          />
        </>
      )}

      <div
        className={cn(
          treeItemVariants({
            size,
            isSelected,
            isDropTarget,
            isDragOver,
            isDragging: isDragging || isSortableDragging,
            disabled: node.disabled,
          }),
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        tabIndex={0}
        role="treeitem"
        aria-level={depth + 1}
        aria-setsize={-1}
        aria-posinset={flatNode.index + 1}
        data-node-id={nodeId}
      >
        {/* Expand/collapse button */}
        <ExpandIcon
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          size={size}
          loading={isLoading}
          onClick={handleExpandClick}
          ariaLabel={isExpanded ? "Restrânge" : "Extinde"}
        />

        {/* Checkbox */}
        {enableCheckboxes && (
          <TreeCheckbox
            checked={isChecked}
            indeterminate={isIndeterminate}
            disabled={node.disabled ?? false}
            size={size}
            onChange={handleCheckToggle}
            ariaLabel={`${isChecked ? "Deselectează" : "Selectează"} ${node.label}`}
          />
        )}

        {/* Icon */}
        {renderIcon ? (
          <span className="shrink-0 inline-flex">
            {renderIcon(node, isExpanded)}
          </span>
        ) : (
          <DefaultNodeIcon node={node} isExpanded={isExpanded} size={size} />
        )}

        {/* Label */}
        <span className="flex-1 min-w-0 truncate">
          {renderLabel ? renderLabel(node) : node.label}
        </span>

        {/* Node count badge */}
        {showNodeCount && hasChildren && childrenCount > 0 && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center justify-center",
              "rounded-full bg-surface-secondary px-1.5 py-0.5",
              "text-xs text-text-tertiary font-medium",
            )}
            aria-label={`${childrenCount} elemente`}
          >
            {childrenCount}
          </span>
        )}

        {/* Drag handle */}
        {enableDragDrop && !node.disableDrag && (
          <button
            type="button"
            className={cn(dragHandleVariants({ size }), "p-0.5")}
            {...attributes}
            {...listeners}
            aria-label={`Trage ${node.label}`}
            tabIndex={-1}
            onPointerDown={(e) => {
              e.stopPropagation();
              (listeners as Record<string, unknown>).onPointerDown &&
                (listeners as { onPointerDown?: (e: React.PointerEvent) => void }).onPointerDown?.(e);
            }}
          >
            <GripVertical
              className={cn(
                size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5",
              )}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Empty State ────────────────────────────────────────────────────

function EmptyState({
  message,
  size,
}: {
  message: string;
  size: TreeViewSize;
}) {
  const sizeClasses = {
    sm: "py-6 px-2 text-xs",
    md: "py-12 px-4 text-sm",
    lg: "py-16 px-6 text-base",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "text-text-tertiary text-center",
        sizeClasses[size],
      )}
      role="status"
    >
      <svg
        className="mb-3 h-10 w-10 text-text-tertiary/40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────

function SkeletonTree({ count, size }: { count: number; size: TreeViewSize }) {
  const items = Array.from({ length: count });

  const skeletonHeight = size === "sm" ? "h-5" : size === "lg" ? "h-8" : "h-7";

  return (
    <ul className="list-none p-1" role="tree" aria-busy="true">
      {items.map((_, i) => (
        <li key={i} className="flex items-center gap-1.5 animate-pulse px-2 py-1">
          <span className={cn("w-4 shrink-0 rounded-sm bg-neutral-200 dark:bg-neutral-700", skeletonHeight)} />
          <span className={cn("w-4 shrink-0 rounded-sm bg-neutral-200 dark:bg-neutral-700", skeletonHeight)} />
          <span
            className={cn(
              "flex-1 rounded-sm bg-neutral-200 dark:bg-neutral-700",
              skeletonHeight,
              i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-2/3",
            )}
          />
        </li>
      ))}
    </ul>
  );
}

// ─── Main TreeView Component ────────────────────────────────────────

const TreeView = forwardRef<TreeViewRef, TreeViewProps>((props, ref) => {
  const {
    nodes,
    size = "md",
    enableCheckboxes = false,
    checkedIds: controlledCheckedIds,
    onCheckChange,
    enableDragDrop = false,
    enableLazyLoad = false,
    onLazyLoad,
    expandedIds: controlledExpandedIds,
    onExpandChange,
    onNodeClick,
    onNodeFocus,
    renderLabel,
    renderIcon,
    showGuides = false,
    indentWidth = 20,
    className,
    loading = false,
    emptyMessage = "Arborele este gol.",
    showNodeCount = false,
  } = props;

  // ── Internal state ─────────────────────────────────────────────
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<TreeNodeId>>(new Set());
  const [internalCheckedIds, setInternalCheckedIds] = useState<Set<TreeNodeId>>(new Set());
  const [selectedId, setSelectedId] = useState<TreeNodeId | null>(null);
  const [focusedId, setFocusedId] = useState<TreeNodeId | null>(null);
  const [loadingNodes, setLoadingNodes] = useState<Set<TreeNodeId>>(new Set());
  const [lazyLoadedData, setLazyLoadedData] = useState<Map<TreeNodeId, TreeNode[]>>(new Map());
  const [dragOverId, setDragOverId] = useState<TreeNodeId | null>(null);
  const [draggingId, setDraggingId] = useState<TreeNodeId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<TreeNodeId | null>(null);
  const [activeDragNode, setActiveDragNode] = useState<TreeNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<TreeNodeId, HTMLLIElement>>(new Map());

  // Determine expanded ids
  const expandedIds = controlledExpandedIds
    ? new Set(controlledExpandedIds)
    : internalExpandedIds;

  const checkedIds = controlledCheckedIds
    ? new Set(controlledCheckedIds)
    : internalCheckedIds;

  // ── Merge lazy loaded children into nodes ──────────────────────
  const resolvedNodes = useMemo(() => {
    if (lazyLoadedData.size === 0) return nodes;

    function injectChildren(nodeList: TreeNode[]): TreeNode[] {
      return nodeList.map((node) => {
        const extra = lazyLoadedData.get(node.id);
        if (extra) {
          return {
            ...node,
            children: injectChildren(extra),
          };
        }
        if (node.children) {
          return { ...node, children: injectChildren(node.children) };
        }
        return node;
      });
    }

    return injectChildren(nodes);
  }, [nodes, lazyLoadedData]);

  // ── Computed checked & indeterminate state ────────────────────
  const { checked: computedChecked, indeterminate: computedIndeterminate } = useMemo(
    () => computeCheckedState(resolvedNodes, checkedIds),
    [resolvedNodes, checkedIds],
  );

  // ── Flatten tree for rendering ─────────────────────────────────
  const flatNodes = useMemo(
    () => flattenTree(resolvedNodes, expandedIds),
    [resolvedNodes, expandedIds],
  );

  const sortableIds = useMemo(
    () => flatNodes.map((fn) => fn.node.id),
    [flatNodes],
  );

  // ── DnD Sensors ────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // ── Handlers ───────────────────────────────────────────────────
  const setExpandedIds = useCallback(
    (newIds: Set<TreeNodeId>) => {
      if (!controlledExpandedIds) {
        setInternalExpandedIds(newIds);
      }
      onExpandChange?.(Array.from(newIds));
    },
    [controlledExpandedIds, onExpandChange],
  );

  const setCheckedIds = useCallback(
    (newIds: Set<TreeNodeId>) => {
      if (!controlledCheckedIds) {
        setInternalCheckedIds(newIds);
      }
    },
    [controlledCheckedIds],
  );

  const handleExpandToggle = useCallback(
    async (nodeId: TreeNodeId) => {
      const node = findNodeInTree(resolvedNodes, nodeId);
      if (!node) return;

      const isCurrentlyExpanded = expandedIds.has(nodeId);

      if (!isCurrentlyExpanded && enableLazyLoad && onLazyLoad && node.hasChildren && !node.children) {
        // Lazy load
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });

        try {
          const children = await onLazyLoad(nodeId, node);
          setLazyLoadedData((prev) => {
            const next = new Map(prev);
            next.set(nodeId, children);
            return next;
          });
        } catch {
          // Silently fail; node remains unexpanded
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
          return;
        } finally {
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
        }
      }

      const newExpanded = new Set(expandedIds);
      if (isCurrentlyExpanded) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      setExpandedIds(newExpanded);
    },
    [resolvedNodes, expandedIds, enableLazyLoad, onLazyLoad, setExpandedIds],
  );

  const handleCheckToggle = useCallback(
    (nodeId: TreeNodeId) => {
      const newChecked = new Set(checkedIds);
      const currentlyChecked = checkedIds.has(nodeId);

      const node = findNodeInTree(resolvedNodes, nodeId);
      if (!node) return;

      // Collect all descendants
      const descendantIds = collectAllDescendantIds(node);

      if (currentlyChecked) {
        newChecked.delete(nodeId);
        descendantIds.forEach((id) => newChecked.delete(id));
      } else {
        newChecked.add(nodeId);
        descendantIds.forEach((id) => newChecked.add(id));
      }

      setCheckedIds(newChecked);
      onCheckChange?.({
        checked: Array.from(newChecked),
        triggeredId: nodeId,
        newState: !currentlyChecked,
      });
    },
    [resolvedNodes, checkedIds, setCheckedIds, onCheckChange],
  );

  const handleSelect = useCallback(
    (nodeId: TreeNodeId, node: TreeNode) => {
      setSelectedId(nodeId);
      onNodeClick?.(nodeId, node);
    },
    [onNodeClick],
  );

  const handleFocus = useCallback(
    (nodeId: TreeNodeId, node: TreeNode) => {
      setFocusedId(nodeId);
      onNodeFocus?.(nodeId, node);
    },
    [onNodeFocus],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as TreeNodeId;
      setDraggingId(id);
      const node = findNodeInTree(resolvedNodes, id);
      setActiveDragNode(node);
    },
    [resolvedNodes],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over?.id as TreeNodeId | undefined;
      setDragOverId(overId ?? null);
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggingId(null);
      setDragOverId(null);
      setDropTargetId(null);
      setActiveDragNode(null);

      if (!over || active.id === over.id) return;

      const activeId = active.id as TreeNodeId;
      const overId = over.id as TreeNodeId;

      // Determine position based on pointer location (simplified: "inside")
      const position: "before" | "after" | "inside" = "inside";

      onDragEnd?.({
        activeId,
        overId,
        position,
      });
    },
    [onDragEnd],
  );

  // ── Keyboard navigation ────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!flatNodes.length) return;

      const currentIndex = flatNodes.findIndex((fn) => fn.node.id === focusedId);
      let nextIndex = currentIndex;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextIndex = Math.min(currentIndex + 1, flatNodes.length - 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = Math.max(currentIndex - 1, 0);
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = flatNodes.length - 1;
          break;
        case "ArrowRight": {
          const current = flatNodes[currentIndex];
          if (current && (current.node.children?.length || current.node.hasChildren)) {
            if (!expandedIds.has(current.node.id)) {
              e.preventDefault();
              handleExpandToggle(current.node.id);
            }
          }
          return;
        }
        case "ArrowLeft": {
          const current = flatNodes[currentIndex];
          if (current && expandedIds.has(current.node.id)) {
            e.preventDefault();
            handleExpandToggle(current.node.id);
          }
          return;
        }
        case " ":
        case "Enter":
          if (enableCheckboxes && focusedId) {
            e.preventDefault();
            handleCheckToggle(focusedId);
          }
          return;
        default:
          return;
      }

      if (nextIndex !== currentIndex && nextIndex >= 0 && nextIndex < flatNodes.length) {
        const nextNode = flatNodes[nextIndex];
        setFocusedId(nextNode.node.id);
        onNodeFocus?.(nextNode.node.id, nextNode.node);
        // Scroll into view
        const el = nodeRefs.current.get(nextNode.node.id);
        el?.focus();
      }
    },
    [flatNodes, focusedId, expandedIds, enableCheckboxes, handleExpandToggle, handleCheckToggle, onNodeFocus],
  );

  // ── Imperative API ─────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      expand: (nodeId: TreeNodeId) => {
        const newExpanded = new Set(expandedIds);
        newExpanded.add(nodeId);
        setExpandedIds(newExpanded);
      },
      collapse: (nodeId: TreeNodeId) => {
        const newExpanded = new Set(expandedIds);
        newExpanded.delete(nodeId);
        setExpandedIds(newExpanded);
      },
      toggle: (nodeId: TreeNodeId) => {
        void handleExpandToggle(nodeId);
      },
      scrollTo: (nodeId: TreeNodeId) => {
        const el = nodeRefs.current.get(nodeId);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      },
      getExpandedIds: () => Array.from(expandedIds),
      getCheckedIds: () => Array.from(checkedIds),
    }),
    [expandedIds, checkedIds, setExpandedIds, handleExpandToggle],
  );

  // ── Render ─────────────────────────────────────────────────────
  const treeContent = useMemo(() => {
    if (loading) {
      return <SkeletonTree count={5} size={size} />;
    }

    if (flatNodes.length === 0) {
      return <EmptyState message={emptyMessage} size={size} />;
    }

    const treeItems = flatNodes.map((flatNode) => {
      const node = flatNode.node;
      const hasChildren = Boolean(
        (node.children && node.children.length > 0) || (node.hasChildren && enableLazyLoad),
      );
      const isExpanded = expandedIds.has(node.id);
      const isLoading = loadingNodes.has(node.id);

      return (
        <SortableTreeItem
          key={node.id}
          flatNode={flatNode}
          size={size}
          isExpanded={isExpanded}
          isLoading={isLoading}
          isChecked={computedChecked.has(node.id)}
          isIndeterminate={computedIndeterminate.has(node.id)}
          enableCheckboxes={enableCheckboxes}
          enableDragDrop={enableDragDrop}
          showGuides={showGuides}
          indentWidth={indentWidth}
          hasChildren={hasChildren}
          selectedId={selectedId}
          dropTargetId={dropTargetId}
          dragOverId={dragOverId}
          draggingId={draggingId}
          onExpandToggle={handleExpandToggle}
          onCheckToggle={handleCheckToggle}
          onSelect={handleSelect}
          onFocus={handleFocus}
          onDragHandleProps={() => {}}
          renderLabel={renderLabel}
          renderIcon={renderIcon}
          showNodeCount={showNodeCount}
        />
      );
    });

    return (
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {treeItems}
      </SortableContext>
    );
  }, [
    loading,
    size,
    flatNodes,
    emptyMessage,
    expandedIds,
    loadingNodes,
    computedChecked,
    computedIndeterminate,
    enableCheckboxes,
    enableDragDrop,
    showGuides,
    indentWidth,
    selectedId,
    dropTargetId,
    dragOverId,
    draggingId,
    handleExpandToggle,
    handleCheckToggle,
    handleSelect,
    handleFocus,
    renderLabel,
    renderIcon,
    showNodeCount,
    sortableIds,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn(treeWrapperVariants({ size }), className)}
      role="tree"
      aria-label="Arbore"
      aria-multiselectable={enableCheckboxes}
      onKeyDown={handleKeyDown}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ul className="list-none p-1" role="group">
          {treeContent}
        </ul>

        <DragOverlay>
          {activeDragNode ? (
            <div
              className={cn(
                "flex items-center gap-1.5",
                "rounded-sm",
                "bg-surface shadow-elevation-2 border border-border",
                "px-2 py-1",
                "text-sm",
              )}
            >
              {activeDragNode.icon ?? (
                activeDragNode.isLeaf ? (
                  <File className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                ) : (
                  <Folder className="h-4 w-4 text-amber-400" aria-hidden="true" />
                )
              )}
              <span className="truncate">{activeDragNode.label}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});

TreeView.displayName = "TreeView";

// ─── Helper Hook: useTreeView ───────────────────────────────────────

export interface UseTreeViewOptions {
  /** Initial nodes */
  nodes: TreeNode[];
  /** Initial expanded ids */
  initialExpanded?: TreeNodeId[];
  /** Initial checked ids */
  initialChecked?: TreeNodeId[];
}

export interface UseTreeViewReturn {
  /** Current resolved nodes (with lazy loaded children merged) */
  nodes: TreeNode[];
  /** Currently expanded ids */
  expandedIds: TreeNodeId[];
  /** Currently checked ids */
  checkedIds: TreeNodeId[];
  /** Expand a node */
  expand: (id: TreeNodeId) => void;
  /** Collapse a node */
  collapse: (id: TreeNodeId) => void;
  /** Toggle expand/collapse */
  toggleExpand: (id: TreeNodeId) => void;
  /** Check a node */
  check: (id: TreeNodeId) => void;
  /** Uncheck a node */
  uncheck: (id: TreeNodeId) => void;
  /** Toggle check state */
  toggleCheck: (id: TreeNodeId) => void;
  /** Check all nodes */
  checkAll: () => void;
  /** Uncheck all nodes */
  uncheckAll: () => void;
  /** Move a node (fromId) under a new parent (toId) at position */
  moveNode: (fromId: TreeNodeId, toId: TreeNodeId, position: "before" | "after" | "inside") => void;
}

export function useTreeView(options: UseTreeViewOptions): UseTreeViewReturn {
  const { nodes: initialNodes, initialExpanded = [], initialChecked = [] } = options;

  const [nodes, setNodes] = useState<TreeNode[]>(initialNodes);
  const [expandedIds, setExpandedIds] = useState<Set<TreeNodeId>>(new Set(initialExpanded));
  const [checkedIds, setCheckedIds] = useState<Set<TreeNodeId>>(new Set(initialChecked));

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  const expand = useCallback((id: TreeNodeId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const collapse = useCallback((id: TreeNodeId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: TreeNodeId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const check = useCallback((id: TreeNodeId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      const node = findNodeInTree(nodes, id);
      if (node) {
        collectAllDescendantIds(node).forEach((childId) => next.add(childId));
      }
      return next;
    });
  }, [nodes]);

  const uncheck = useCallback((id: TreeNodeId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      const node = findNodeInTree(nodes, id);
      if (node) {
        collectAllDescendantIds(node).forEach((childId) => next.delete(childId));
      }
      return next;
    });
  }, [nodes]);

  const toggleCheck = useCallback(
    (id: TreeNodeId) => {
      setCheckedIds((prev) => {
        if (prev.has(id)) {
          const next = new Set(prev);
          next.delete(id);
          const node = findNodeInTree(nodes, id);
          if (node) {
            collectAllDescendantIds(node).forEach((childId) => next.delete(childId));
          }
          return next;
        } else {
          const next = new Set(prev);
          next.add(id);
          const node = findNodeInTree(nodes, id);
          if (node) {
            collectAllDescendantIds(node).forEach((childId) => next.add(childId));
          }
          return next;
        }
      });
    },
    [nodes],
  );

  const checkAll = useCallback(() => {
    const allIds = collectChildIds(nodes);
    setCheckedIds(new Set(allIds));
  }, [nodes]);

  const uncheckAll = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  const moveNode = useCallback(
    (fromId: TreeNodeId, toId: TreeNodeId, position: "before" | "after" | "inside") => {
      setNodes((prevNodes) => {
        // Deep clone
        const cloned = JSON.parse(JSON.stringify(prevNodes)) as TreeNode[];

        // Find and remove source node
        let removedNode: TreeNode | null = null;

        function removeFrom(arr: TreeNode[], id: TreeNodeId): boolean {
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].id === id) {
              removedNode = arr.splice(i, 1)[0];
              return true;
            }
            if (arr[i].children) {
              if (removeFrom(arr[i].children!, id)) return true;
            }
          }
          return false;
        }

        removeFrom(cloned, fromId);

        if (!removedNode) return prevNodes;

        // Insert into target location
        function insertInto(
          arr: TreeNode[],
          targetId: TreeNodeId,
          node: TreeNode,
          pos: "before" | "after" | "inside",
        ): boolean {
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].id === targetId) {
              if (pos === "inside") {
                if (!arr[i].children) arr[i].children = [];
                arr[i].children!.push(node);
              } else if (pos === "before") {
                arr.splice(i, 0, node);
              } else {
                arr.splice(i + 1, 0, node);
              }
              return true;
            }
            if (arr[i].children) {
              if (insertInto(arr[i].children!, targetId, node, pos)) return true;
            }
          }
          return false;
        }

        insertInto(cloned, toId, removedNode, position);

        return cloned;
      });
    },
    [],
  );

  return {
    nodes,
    expandedIds: Array.from(expandedIds),
    checkedIds: Array.from(checkedIds),
    expand,
    collapse,
    toggleExpand,
    check,
    uncheck,
    toggleCheck,
    checkAll,
    uncheckAll,
    moveNode,
  };
}

// ─── Exports ────────────────────────────────────────────────────────

export {
  TreeView,
  treeWrapperVariants,
  treeItemVariants,
  expandButtonVariants,
  checkboxVariants,
  dragHandleVariants,
  findNodeInTree,
  flattenTree,
  collectAllDescendantIds,
  computeCheckedState,
};

export default TreeView;