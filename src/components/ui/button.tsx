import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost";

const base =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-60 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  default: "bg-zinc-900 text-white hover:bg-zinc-800 px-3 py-2",
  outline:
    "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 px-3 py-2",
  ghost: "text-zinc-700 hover:bg-zinc-100 px-2 py-1.5",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";

