"use client";

import * as React from "react";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 480;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 320;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 900;

interface DraggableResizablePanelProps {
  children: React.ReactNode;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultX?: number;
  defaultY?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
}

export function DraggableResizablePanel({
  children,
  onClose,
  title,
  description,
  defaultWidth = DEFAULT_WIDTH,
  defaultHeight = DEFAULT_HEIGHT,
  defaultX = 24,
  defaultY = 24,
  minWidth = MIN_WIDTH,
  minHeight = MIN_HEIGHT,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
  className,
}: DraggableResizablePanelProps) {
  const [x, setX] = React.useState(defaultX);
  const [y, setY] = React.useState(defaultY);
  const [width, setWidth] = React.useState(defaultWidth);
  const [height, setHeight] = React.useState(defaultHeight);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const dragStart = React.useRef({ x: 0, y: 0, left: 0, top: 0 });
  const resizeStart = React.useRef({ x: 0, y: 0, width: 0, height: 0 });

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const handleDragStart = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, left: x, top: y };
  }, [x, y]);

  const handleResizeStart = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, width, height };
  }, [width, height]);

  React.useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setX(clamp(dragStart.current.left + dx, 0, window.innerWidth - width));
      setY(Math.max(0, dragStart.current.top + dy));
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, width]);

  React.useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: PointerEvent) => {
      const dw = e.clientX - resizeStart.current.x;
      const dh = e.clientY - resizeStart.current.y;
      setWidth(clamp(resizeStart.current.width + dw, minWidth, maxWidth));
      setHeight(clamp(resizeStart.current.height + dh, minHeight, maxHeight));
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isResizing, minWidth, minHeight, maxWidth, maxHeight]);

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col rounded-lg border bg-background shadow-lg overflow-hidden",
        className
      )}
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
      data-testid="settings-panel"
    >
      <div
        onPointerDown={handleDragStart}
        className="flex items-start justify-between gap-2 pr-2 pt-2 pb-1 cursor-grab active:cursor-grabbing select-none flex-shrink-0 border-b bg-muted/30"
        data-testid="settings-panel-drag-handle"
        aria-label="Drag to move panel"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 pl-4">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground leading-tight">{title}</h2>
            {description != null && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-sm p-1.5 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
          data-testid="button-settings-close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">{children}</div>
      <div
        role="presentation"
        onPointerDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize border-l border-t border-muted-foreground/30 rounded-tl"
        data-testid="settings-panel-resize-handle"
        aria-hidden
      />
    </div>
  );
}
