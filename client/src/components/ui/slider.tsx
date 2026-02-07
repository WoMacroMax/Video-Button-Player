import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  variant?: "default" | "volume";
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, value, defaultValue, orientation, variant = "default", ...props }, ref) => {
  const thumbCount = value?.length ?? defaultValue?.length ?? 1;
  const isVertical = orientation === "vertical";
  const isVolume = variant === "volume";

  return (
    <SliderPrimitive.Root
      ref={ref}
      orientation={orientation}
      className={cn(
        "relative flex touch-none select-none items-center",
        isVertical ? "h-full flex-col justify-center" : "w-full",
        className
      )}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative overflow-hidden rounded-full",
          isVertical ? "w-2.5 h-full grow" : "h-2 w-full grow",
          isVolume ? "bg-white/20" : "bg-secondary"
        )}
      >
        <SliderPrimitive.Range
          className={cn(
            "absolute rounded-full",
            isVertical ? "bottom-0 w-full" : "h-full",
            isVolume ? "bg-white" : "bg-primary"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className={cn(
            "block h-5 w-5 rounded-full border-2 bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            isVolume ? "border-white shadow-md" : "border-primary"
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
