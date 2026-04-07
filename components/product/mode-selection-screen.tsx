import type { SubscriptionPlan } from "@/lib/billing/plans";

interface Props {
  loading?: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
}

export function ModeSelectionScreen({ loading = false, onSelect }: Props) {
  return (
    <main className="wa-app-shell min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col justify-center rounded-[28px] bg-[var(--wa-bg-sidebar)] p-6 shadow-[var(--wa-shadow-md)]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--taller-green)]">Mecanico AI</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--wa-text-primary)]">Elige como quieres entrar</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--wa-text-secondary)]">
            Tu seleccion define el espacio y el nivel con el que entras por default. Luego lo puedes cambiar desde el menu.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => onSelect("free")}
            className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-5 text-left shadow-sm transition hover:border-[var(--taller-green)] hover:bg-[var(--wa-control-bg)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-[var(--wa-text-primary)]">Free</p>
                <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">Prueba DIY con 5 preguntas</p>
              </div>
              <span className="rounded-full bg-[var(--wa-control-bg-soft)] px-3 py-1 text-xs font-semibold text-[var(--wa-text-secondary)]">
                $0
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-[var(--wa-text-primary)]">
              <p>• Primeras revisiones y sintomas</p>
              <p>• Ideal para probar la app</p>
              <p>• Te invita a subir de nivel al acabar tus 5 preguntas</p>
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => onSelect("basic")}
            className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-5 text-left shadow-sm transition hover:border-[var(--taller-green)] hover:bg-[var(--wa-control-bg)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-[var(--wa-text-primary)]">DIY</p>
                <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">Para duenos y hobbyistas que quieren mas guia</p>
              </div>
              <span className="rounded-full bg-[var(--wa-control-bg-soft)] px-3 py-1 text-xs font-semibold text-[var(--wa-text-secondary)]">
                $5
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-[var(--wa-text-primary)]">
              <p>• 10 preguntas por dia</p>
              <p>• Troubleshooting DIY mas profundo</p>
              <p>• Mejor para aterrizar una falla paso a paso</p>
            </div>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => onSelect("pro")}
            className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-5 text-left shadow-sm transition hover:border-[var(--mech-orange)] hover:bg-[var(--wa-control-bg)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-[var(--wa-text-primary)]">Pro</p>
                <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">Para talleres, mecanicos y tecnicos moviles</p>
              </div>
              <span className="rounded-full bg-[var(--wa-control-bg-soft)] px-3 py-1 text-xs font-semibold text-[var(--wa-text-secondary)]">
                $25
              </span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-[var(--wa-text-primary)]">
              <p>• Maestro Mecanico ilimitado</p>
              <p>• Voz, fotos y archivos</p>
              <p>• Cotizaciones, facturas y briefs internos</p>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
