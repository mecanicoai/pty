import { Button } from "@/components/ui/button";
import type { BusinessProfile, ProWorkspaceView } from "@/types/product";

interface Props {
  business: BusinessProfile;
  proEnabled: boolean;
  onSelect: (view: ProWorkspaceView) => void;
  onEditBusiness: () => void;
  onOpenPlans: () => void;
  onSwitchMode: () => void;
}

const ACTIONS: Array<{ id: ProWorkspaceView; title: string; description: string }> = [
  {
    id: "client_message",
    title: "Ingresar mensaje del cliente",
    description: "Pega el mensaje del cliente y conviertelo en respuesta, cotizacion y brief."
  },
  {
    id: "chat",
    title: "Chatear con el Maestro Mecanico",
    description: "Consulta tecnica continua para casos reales de taller."
  },
  {
    id: "quote",
    title: "Crear cotizacion",
    description: "Genera una cotizacion usando tus datos de negocio."
  },
  {
    id: "invoice",
    title: "Crear factura",
    description: "Arma una factura lista para compartir con el cliente."
  },
  {
    id: "brief",
    title: "Crear brief interno",
    description: "Resume el trabajo para el tecnico antes de tocar el vehiculo."
  }
];

export function ProHome({ business, proEnabled, onSelect, onEditBusiness, onOpenPlans, onSwitchMode }: Props) {
  return (
    <section className="flex min-h-screen flex-col bg-[var(--wa-bg-app)]">
      <div className="wa-header-gradient px-4 py-6 text-white shadow-md">
        <p className="text-xs uppercase tracking-[0.2em] opacity-80">Para los Pros</p>
        <h1 className="mt-2 text-2xl font-semibold">{business.business_name}</h1>
        <p className="mt-1 text-sm opacity-90">{business.mechanic_name}</p>
      </div>

      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-4 px-4 py-5">
        <div className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--wa-text-primary)]">Flujo del taller</p>
              <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">
                Convierte mensajes de cliente en respuesta, cotizacion, seguimiento y trabajo aprobado.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={onSwitchMode}>
                Cambiar modo
              </Button>
              <Button type="button" variant="secondary" onClick={onEditBusiness}>
                Editar negocio
              </Button>
            </div>
          </div>
        </div>

        {!proEnabled ? (
          <div className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-4 shadow-sm">
            <p className="text-base font-semibold text-[var(--wa-text-primary)]">Desbloquea Para los Pros</p>
            <p className="mt-2 text-sm leading-6 text-[var(--wa-text-secondary)]">
              El modo Pro incluye Maestro Mecanico ilimitado, cotizaciones, facturas, briefs internos y flujo de cliente.
            </p>
            <Button type="button" className="mt-4" onClick={onOpenPlans}>
              Ver plan de $25
            </Button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => (proEnabled ? onSelect(action.id) : onOpenPlans())}
              className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] p-5 text-left shadow-sm transition hover:border-[var(--taller-green)] hover:bg-[var(--wa-control-bg)]"
            >
              <p className="text-lg font-semibold text-[var(--wa-text-primary)]">{action.title}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--wa-text-secondary)]">{action.description}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
