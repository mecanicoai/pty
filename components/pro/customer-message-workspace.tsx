"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { buildWhatsAppShareUrl, openPrintableDocument } from "@/lib/product/pro-workflows";
import type { BusinessProfile, ProWorkflowOutput } from "@/types/product";

interface Props {
  business: BusinessProfile;
  output: ProWorkflowOutput | null;
  loading: boolean;
  onBack: () => void;
  onSubmit: (input: { customerMessage: string; customerName?: string; vehicleLabel?: string; screenshot?: File | null }) => Promise<void>;
}

export function CustomerMessageWorkspace({ business, output, loading, onBack, onSubmit }: Props) {
  const [customerMessage, setCustomerMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicleLabel, setVehicleLabel] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleCopy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function shareToWhatsApp(text: string) {
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  }

  function downloadQuotePdf() {
    if (!output?.quoteDraft) {
      return;
    }

    openPrintableDocument({
      title: "Cotizacion",
      business,
      draft: {
        customerName: output.customerName || customerName,
        vehicleLabel: output.vehicleLabel || vehicleLabel,
        summary: output.clientProblemSummary,
        notes: output.quoteDraft.notes.join("\n"),
        amount: output.quoteDraft.total
      }
    });
  }

  return (
    <section className="flex min-h-screen flex-col bg-[var(--wa-bg-app)]">
      <div className="wa-header-gradient flex items-center justify-between gap-3 px-4 py-4 text-white shadow-md">
        <div>
          <p className="text-sm opacity-80">Flujo principal</p>
          <h1 className="text-xl font-semibold">Ingresar mensaje del cliente</h1>
        </div>
        <Button type="button" variant="secondary" className="border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={onBack}>
          Volver
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-[840px] flex-1 flex-col gap-4 px-4 py-4">
        <div className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nombre del cliente" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            <Input placeholder="Vehiculo (ej. 2018 Civic 1.5T)" value={vehicleLabel} onChange={(event) => setVehicleLabel(event.target.value)} />
            <Textarea
              className="sm:col-span-2"
              rows={6}
              placeholder="Pega aqui el mensaje del cliente o escribe un resumen claro de lo que reporta."
              value={customerMessage}
              onChange={(event) => setCustomerMessage(event.target.value)}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              {screenshot ? `Screenshot: ${screenshot.name}` : "Adjuntar screenshot"}
            </Button>
            <Button
              type="button"
              onClick={() => void onSubmit({ customerMessage, customerName, vehicleLabel, screenshot })}
              disabled={loading || !customerMessage.trim()}
            >
              {loading ? "Procesando..." : "Generar salida"}
            </Button>
          </div>
        </div>

        {output ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--taller-green)]">Cliente</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Resumen del problema</p>
                  <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">{output.clientProblemSummary}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Respuesta sugerida</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--wa-text-secondary)]">{output.suggestedReply}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Siguiente paso</p>
                  <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">{output.nextStepExplanation}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Cotizacion preliminar</p>
                  {output.quoteDraft ? (
                    <div className="mt-2 rounded-[18px] bg-[var(--wa-bg-app)] p-3 text-sm text-[var(--wa-text-secondary)]">
                      <p className="font-semibold text-[var(--wa-text-primary)]">{output.quoteDraft.title}</p>
                      <div className="mt-2 space-y-1">
                        {output.quoteDraft.lineItems.map((item) => (
                          <p key={item.label} className="flex justify-between gap-3">
                            <span>{item.label}</span>
                            <span>{item.amount.toFixed(2)} {business.currency}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">Todavia no hay suficiente base para una cotizacion preliminar.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => handleCopy(output.suggestedReply)}>
                    Copiar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => shareToWhatsApp(output.suggestedReply)}>
                    Compartir a WhatsApp
                  </Button>
                  <Button type="button" onClick={downloadQuotePdf} disabled={!output.quoteDraft}>
                    Descargar PDF
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-[var(--mech-orange)]">Taller</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Brief interno</p>
                  <pre className="mt-1 whitespace-pre-wrap text-sm text-[var(--wa-text-secondary)]">{output.internalJobBrief}</pre>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Categoria probable</p>
                  <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">{output.likelyIssueCategory}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Preguntas pendientes</p>
                  <div className="mt-1 space-y-1 text-sm text-[var(--wa-text-secondary)]">
                    {output.unansweredQuestions.length ? output.unansweredQuestions.map((item) => <p key={item}>• {item}</p>) : <p>Sin preguntas pendientes.</p>}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Siguiente diagnostico</p>
                  <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">{output.recommendedNextDiagnosticStep}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Notas para tecnico</p>
                  <div className="mt-1 space-y-1 text-sm text-[var(--wa-text-secondary)]">
                    {output.technicianNotes.length ? output.technicianNotes.map((item) => <p key={item}>• {item}</p>) : <p>Sin notas extra.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
