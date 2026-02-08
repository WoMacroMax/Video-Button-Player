import * as React from "react";
import { Button } from "@/components/ui/button";
import { useRepeatWhileHeld } from "@/hooks/use-repeat-while-held";
import { cn } from "@/lib/utils";

export interface MicroAdjustButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  /** Called once on press, then repeatedly while held. */
  step: () => void;
  /** Delay in ms before repeat starts (default 400). */
  initialDelay?: number;
  /** Interval in ms between repeats while held (default 80). */
  repeatInterval?: number;
}

export const MicroAdjustButton = React.forwardRef<
  HTMLButtonElement,
  MicroAdjustButtonProps
>(
  (
    {
      step,
      initialDelay,
      repeatInterval,
      className,
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel,
      ...buttonProps
    },
    ref
  ) => {
    const repeat = useRepeatWhileHeld(step, {
      initialDelay,
      repeatInterval,
    });

    return (
      <Button
        ref={ref}
        type="button"
        size="icon"
        variant="outline"
        className={cn("h-8 w-8 shrink-0", className)}
        {...buttonProps}
        onPointerDown={(e) => {
          repeat.onPointerDown(e);
          onPointerDown?.(e);
        }}
        onPointerUp={(e) => {
          repeat.onPointerUp();
          onPointerUp?.(e);
        }}
        onPointerLeave={(e) => {
          repeat.onPointerLeave();
          onPointerLeave?.(e);
        }}
        onPointerCancel={(e) => {
          repeat.onPointerCancel();
          onPointerCancel?.(e);
        }}
      />
    );
  }
);
MicroAdjustButton.displayName = "MicroAdjustButton";
