import type { SelectHTMLAttributes } from "react";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-md border border-[var(--wa-divider)] bg-[var(--wa-bg-panel)] px-3 text-sm text-[var(--wa-text-primary)] outline-none transition focus:border-[var(--wa-header)] ${props.className ?? ""}`}
    />
  );
}
