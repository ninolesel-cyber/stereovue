import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type RibbonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "lg";
  active?: boolean;
};

export function Ribbon({ className, size = "sm", active, type = "button", ...props }: RibbonProps) {
  return (
    <button
      type={type}
      className={cn("ribbon pressable", size === "lg" && "ribbon-lg", active && "ribbon-on", className)}
      {...props}
    />
  );
}
