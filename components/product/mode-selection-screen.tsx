import type { AppExperienceMode } from "@/types/product";

interface Props {
  onSelect: (mode: AppExperienceMode) => void;
}

export function ModeSelectionScreen({ onSelect }: Props) {
  return (
    <main className="wa-app-shell min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col justify-center rounded-[28px] bg-[var(--wa-bg-sidebar)] p-6 shadow-[var(--wa-shadow-md)]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--taller-green)]">Mecanico AI</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--wa-text-primary)]">Elige tu modo de trabajo</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--wa-text-secondary)]">
            Esta app ahora arranca segun tu perfil. DIY ayuda a entender mejor la falla del carro. Para los Pros
            convierte mensajes de clientes en trabajo aprobado, cotizaciones y briefs internos.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <button
            type="button"
            onClick={() => onSelect("diy")}
            className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-5 text-left shadow-sm transition hover:border-[var(--taller-green)] hover:bg-[var(--wa-control-bg)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-[var(--wa-text-primary)]">DIY</p>
                <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">Para dueños de carros y hobbyistas</p>
              </div>
              <span className="rounded-full bg-[var(--wa-control-bg-soft)] px-3 py-1 text-xs font-semibold text-[var(--wa-text-secondary)]">
                Gratis / $5
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-[var(--wa-text-primary)]">
              <p>• Guia practica para entender la falla</p>
              <p>• Chat de sintomas y pasos de revision</p>
              <p>• DIY Plus con ayuda mas profunda</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect("pro")}
            className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-5 text-left shadow-sm transition hover:border-[var(--mech-orange)] hover:bg-[var(--wa-control-bg)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-[var(--wa-text-primary)]">Para los Pros</p>
                <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">Para talleres, mecanicos y tecnicos moviles</p>
              </div>
              <span className="rounded-full bg-[var(--wa-control-bg-soft)] px-3 py-1 text-xs font-semibold text-[var(--wa-text-secondary)]">
                $25
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-[var(--wa-text-primary)]">
              <p>• Maestro Mecanico ilimitado</p>
              <p>• Cotizaciones, facturas y briefs internos</p>
              <p>• Herramientas para responder mas rapido al cliente</p>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
