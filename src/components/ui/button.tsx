import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pressable inline-flex items-center justify-center gap-2 font-medium select-none touch-manipulation disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg",
        secondary: "bg-surface text-fg border border-border-strong",
        ghost: "bg-transparent text-fg",
        outline: "bg-transparent text-fg border border-border-strong",
        paper: "bg-paper text-paper-fg border border-rule",
      },
      size: {
        sm: "h-10 px-3 text-sm rounded-sm",
        md: "h-12 px-4 text-sm rounded-sm",
        lg: "h-14 px-5 text-base rounded-md",
        icon: "size-11 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
