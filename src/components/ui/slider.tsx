import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export function Slider({
  className,
  ...props
}: SliderPrimitive.SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("relative z-10 flex h-10 w-full touch-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-rule/25">
        <SliderPrimitive.Range className="absolute h-full bg-rule" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-6 rounded-full border border-gild bg-paper shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rule" />
    </SliderPrimitive.Root>
  );
}