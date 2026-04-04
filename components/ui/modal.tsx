import { type PropsWithChildren } from "react";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  onClose: () => void;
  title: string;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 md:items-center">
      <div className="w-full max-w-xl rounded-xl bg-[var(--wa-bubble-in)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--wa-divider)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--wa-text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-medium text-[var(--wa-text-secondary)] hover:bg-black/5"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
