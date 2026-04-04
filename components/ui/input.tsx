import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-md border border-[var(--wa-divider)] bg-[var(--wa-bg-panel)] px-3 text-sm text-[var(--wa-text-primary)] outline-none transition focus:border-[var(--wa-header)] ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-[var(--wa-divider)] bg-[var(--wa-bg-panel)] px-3 py-2 text-sm text-[var(--wa-text-primary)] outline-none transition focus:border-[var(--wa-header)] ${props.className ?? ""}`}
    />
  );
}
