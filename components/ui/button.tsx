import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className = "", variant = "primary", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<NonNullable<Props["variant"]>, string> = {
    primary: "bg-[var(--taller-green)] text-white shadow-sm hover:bg-[#138655]",
    secondary:
      "border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] text-[var(--wa-control-text)] shadow-sm hover:bg-[var(--wa-control-bg-soft)]",
    ghost: "bg-transparent text-[var(--wa-text-primary)] hover:bg-black/5 dark:hover:bg-white/5"
  };
  return <button className={`${base} ${variants[variant]} ${className}`.trim()} {...props} />;
}
