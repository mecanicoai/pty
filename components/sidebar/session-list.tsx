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
  function getStatusLabel(status: SessionSummary["proStatus"]) {
    switch (status) {
      case "missing_info":
        return "Falta info";
      case "waiting_customer":
        return "Esperando";
      case "quoted":
        return "Cotizado";
      case "approved":
        return "Aprobado";
      case "in_progress":
        return "En trabajo";
      case "delivered":
        return "Entregado";
      default:
        return "Nuevo";
    }
  }

  function getStatusClass(status: SessionSummary["proStatus"]) {
    switch (status) {
      case "missing_info":
        return "bg-amber-100 text-amber-800";
      case "waiting_customer":
        return "bg-sky-100 text-sky-800";
      case "quoted":
        return "bg-emerald-100 text-emerald-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-orange-100 text-orange-800";
      case "delivered":
        return "bg-violet-100 text-violet-800";
      default:
        return "bg-stone-100 text-stone-700";
    }
  }

  function getMetaLine(session: SessionSummary) {
    if (session.mode !== "shop") {
      return "Diagnostico guardado";
    }

    const identity = [session.customerPhone, session.vehicleLabel].filter(Boolean).join(" • ");
    if (identity) {
      return identity;
    }

    return "Caso del cliente";
  }

  function getSummaryLine(session: SessionSummary) {
    if (session.mode !== "shop") {
      return null;
    }

    if (session.missingFields?.length) {
      return `Falta: ${session.missingFields.join(", ")}`;
    }

    if (session.pendingQuestionsCount) {
      return `${session.pendingQuestionsCount} preguntas pendientes`;
    }

    if (session.quoteVersion) {
      return `Cotizacion v${session.quoteVersion}${session.lastSentLabel ? ` • ${session.lastSentLabel}` : ""}`;
    }

    return session.lastSentLabel || "Caso activo";
  }

  return (
    <div className="space-y-0">
      {sessions.length ? (
        sessions.map((session) => {
          const active = session.id === activeSessionId;
          const summary = getSummaryLine(session);
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
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--wa-text-primary)]">{session.title}</p>
                  {session.mode === "shop" ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusClass(session.proStatus)}`}>
                      {getStatusLabel(session.proStatus)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[12px] text-[var(--wa-text-secondary)]">{getMetaLine(session)}</p>
                {summary ? <p className="mt-1 truncate text-[11px] text-[var(--wa-text-meta)]">{summary}</p> : null}
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
