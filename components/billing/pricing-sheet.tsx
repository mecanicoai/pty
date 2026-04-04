import { PLAN_DEFINITIONS, type PlanUsageSnapshot, type SubscriptionPlan } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import type { AppLanguage } from "@/types/chat";

interface Props {
  open: boolean;
  language: AppLanguage;
  currentPlan: SubscriptionPlan;
  usage: PlanUsageSnapshot;
  onClose: () => void;
}

function getPlanBullets(language: AppLanguage, plan: SubscriptionPlan) {
  if (language === "en") {
    if (plan === "free") {
      return ["5 total questions", "Text chat only", "Good for trying the app"];
    }
    if (plan === "basic") {
      return ["10 questions per day", "Text chat only", "Best for light daily use"];
    }
    return ["Unlimited use", "Voice input", "Photo and document upload"];
  }

  if (plan === "free") {
    return ["5 preguntas totales", "Solo texto", "Ideal para probar la app"];
  }
  if (plan === "basic") {
    return ["10 preguntas por dia", "Solo texto", "Para uso ligero todos los dias"];
  }
  return ["Uso ilimitado", "Entrada por voz", "Subida de fotos y archivos"];
}

export function PricingSheet({ open, language, currentPlan, usage, onClose }: Props) {
  if (!open) {
    return null;
  }

  const copy =
    language === "es"
      ? {
          title: "Planes de Mecanico AI",
          subtitle: "El cobro y las compras se conectaran desde Google Play en la siguiente etapa.",
          current: "Plan actual",
          usage:
            usage.plan === "free"
              ? `${usage.totalRemaining ?? 0} preguntas gratis restantes`
              : usage.plan === "basic"
                ? `${usage.dayRemaining ?? 0} preguntas restantes hoy`
                : "Uso ilimitado activo",
          upgrade: "Proximamente en Google Play",
          close: "Cerrar"
        }
      : {
          title: "Mecanico AI plans",
          subtitle: "Purchases will be connected through Google Play in the next step.",
          current: "Current plan",
          usage:
            usage.plan === "free"
              ? `${usage.totalRemaining ?? 0} free questions left`
              : usage.plan === "basic"
                ? `${usage.dayRemaining ?? 0} questions left today`
                : "Unlimited access active",
          upgrade: "Coming soon on Google Play",
          close: "Close"
        };

  const orderedPlans: SubscriptionPlan[] = ["free", "basic", "pro"];

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-[var(--wa-bg-sidebar)] p-4 shadow-[var(--wa-shadow-md)] md:left-1/2 md:bottom-6 md:w-[520px] md:-translate-x-1/2 md:rounded-[24px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300 md:hidden" />
        <div className="mb-4">
          <p className="text-lg font-semibold text-[var(--wa-text-primary)]">{copy.title}</p>
          <p className="mt-1 text-sm text-[var(--wa-text-secondary)]">{copy.subtitle}</p>
        </div>

        <div className="mb-4 rounded-[20px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[var(--wa-text-secondary)]">{copy.current}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-[var(--wa-text-primary)]">{PLAN_DEFINITIONS[currentPlan].name}</p>
            <p className="text-sm text-[var(--wa-text-secondary)]">{copy.usage}</p>
          </div>
        </div>

        <div className="space-y-3">
          {orderedPlans.map((plan) => {
            const definition = PLAN_DEFINITIONS[plan];
            const active = currentPlan === plan;

            return (
              <div
                key={plan}
                className={`rounded-[22px] border px-4 py-4 shadow-sm ${
                  active
                    ? "border-[var(--taller-green)] bg-[var(--wa-control-bg)]"
                    : "border-[var(--wa-divider)] bg-[var(--wa-bg-app)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[var(--wa-text-primary)]">{definition.name}</p>
                    <p className="text-sm text-[var(--wa-text-secondary)]">{definition.priceLabel}</p>
                  </div>
                  {active ? (
                    <span className="rounded-full bg-[var(--taller-green)] px-3 py-1 text-xs font-semibold text-white">
                      {language === "es" ? "Actual" : "Current"}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1 text-sm text-[var(--wa-text-primary)]">
                  {getPlanBullets(language, plan).map((bullet) => (
                    <p key={bullet}>{`\u2022 ${bullet}`}</p>
                  ))}
                </div>

                {!active ? (
                  <div className="mt-4">
                    <Button type="button" variant={plan === "pro" ? "primary" : "secondary"} className="w-full">
                      {copy.upgrade}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            {copy.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
