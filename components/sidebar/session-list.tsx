import type { SessionSummary } from "@/types/api";

interface Props {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function SessionList({ sessions, activeSessionId, onSelect }: Props) {
  return (
    <div className="space-y-0">
      {sessions.length ? (
        sessions.map((session) => {
          const active = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelect(session.id)}
              className={`grid w-full grid-cols-[49px_1fr_auto] items-center gap-3 border-b border-[#f2f2f2] px-3 py-[10px] text-left transition ${
                active
                  ? "bg-[var(--wa-bg-panel)]"
                  : "bg-[var(--wa-bg-sidebar)] hover:bg-black/5"
              }`}
            >
              <div className="flex h-[49px] w-[49px] items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-semibold text-[var(--wa-text-secondary)]">
                MA
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--wa-text-primary)]">{session.title}</p>
                <p className="mt-1 truncate text-[12px] text-[var(--wa-text-secondary)]">Diagnostico guardado</p>
              </div>
              <p className="text-[11px] text-[var(--wa-text-meta)]">{formatUpdatedAt(session.updatedAt)}</p>
            </button>
          );
        })
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--wa-divider)] p-3 text-xs text-[var(--wa-text-secondary)]">
          Todavia no hay jales guardados en historial.
        </div>
      )}
    </div>
  );
}
