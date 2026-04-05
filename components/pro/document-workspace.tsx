"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { buildWhatsAppShareUrl, openPrintableDocument } from "@/lib/product/pro-workflows";
import type { BusinessProfile, ProDocumentDraft } from "@/types/product";

interface Props {
  title: string;
  business: BusinessProfile;
  initialDraft: ProDocumentDraft;
  showAmount?: boolean;
  onBack: () => void;
}

export function DocumentWorkspace({ title, business, initialDraft, showAmount = true, onBack }: Props) {
  const [draft, setDraft] = useState<ProDocumentDraft>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  function copyDocument() {
    const text = [title, business.business_name, `Cliente: ${draft.customerName || "Pendiente"}`, `Vehiculo: ${draft.vehicleLabel || "Pendiente"}`, `Resumen: ${draft.summary}`, draft.notes].join("\n\n");
    void navigator.clipboard.writeText(text);
  }

  function shareDocument() {
    const text = [title, business.business_name, `Cliente: ${draft.customerName || "Pendiente"}`, `Vehiculo: ${draft.vehicleLabel || "Pendiente"}`, `Resumen: ${draft.summary}`, draft.notes].join("\n\n");
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  }

  return (
    <section className="flex min-h-screen flex-col bg-[var(--wa-bg-app)]">
      <div className="wa-header-gradient flex items-center justify-between gap-3 px-4 py-4 text-white shadow-md">
        <div>
          <p className="text-sm opacity-80">{business.business_name}</p>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        <Button type="button" variant="secondary" className="border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={onBack}>
          Volver
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-[840px] flex-1 flex-col gap-4 px-4 py-4 lg:flex-row">
        <div className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-4 shadow-sm lg:w-[360px]">
          <div className="space-y-3">
            <Input placeholder="Cliente" value={draft.customerName} onChange={(event) => setDraft((prev) => ({ ...prev, customerName: event.target.value }))} />
            <Input placeholder="Vehiculo" value={draft.vehicleLabel} onChange={(event) => setDraft((prev) => ({ ...prev, vehicleLabel: event.target.value }))} />
            <Input placeholder="Resumen" value={draft.summary} onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))} />
            {showAmount ? (
              <Input
                placeholder={`Monto en ${business.currency}`}
                value={draft.amount || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, amount: Number(event.target.value) || 0 }))}
              />
            ) : null}
            <Textarea rows={8} placeholder="Notas" value={draft.notes} onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={copyDocument}>
              Copiar
            </Button>
            <Button type="button" variant="secondary" onClick={shareDocument}>
              WhatsApp
            </Button>
            <Button type="button" onClick={() => openPrintableDocument({ title, business, draft })}>
              Descargar PDF
            </Button>
          </div>
        </div>

        <div className="flex-1 rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-5 shadow-sm">
          <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Vista previa</p>
          <div className="mt-4 rounded-[20px] bg-[var(--wa-bg-app)] p-5">
            <p className="text-xl font-semibold text-[var(--wa-text-primary)]">{title}</p>
            <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">{business.business_name}</p>
            <p className="text-sm text-[var(--wa-text-secondary)]">{business.mechanic_name}</p>
            <div className="mt-5 space-y-3 text-sm text-[var(--wa-text-primary)]">
              <p><strong>Cliente:</strong> {draft.customerName || "Pendiente"}</p>
              <p><strong>Vehiculo:</strong> {draft.vehicleLabel || "Pendiente"}</p>
              <p><strong>Resumen:</strong> {draft.summary}</p>
              {showAmount ? <p><strong>Total:</strong> {draft.amount.toFixed(2)} {business.currency}</p> : null}
              <pre className="whitespace-pre-wrap leading-6 text-[var(--wa-text-secondary)]">{draft.notes}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
