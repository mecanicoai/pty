import { Button } from "@/components/ui/button";
import { PLAN_DEFINITIONS, type PlanUsageSnapshot, type SubscriptionPlan } from "@/lib/billing/plans";
import type { AppLanguage } from "@/types/chat";

interface Props {
  open: boolean;
  language: AppLanguage;
  currentPlan: SubscriptionPlan;
  usage: PlanUsageSnapshot;
  allowTestOverride?: boolean;
  activatingPlan?: SubscriptionPlan | null;
  onActivateTestPlan?: (plan: SubscriptionPlan) => Promise<void> | void;
  onClose: () => void;
}

function getPlanBullets(language: AppLanguage, plan: SubscriptionPlan) {
  if (language === "en") {
    if (plan === "free") {
      return ["5 total questions", "Basic help with symptoms and first checks", "Good for trying DIY mode"];
    }
    if (plan === "basic") {
      return ["10 questions per day", "Deeper DIY troubleshooting", "Built for owners and hobbyists"];
    }
    return ["Unlimited Master Mechanic chat", "Voice, photo, and file upload", "Quotes, invoices, and internal briefs"];
  }

  if (plan === "free") {
    return ["5 preguntas totales", "Ayuda basica con sintomas y primeras revisiones", "Ideal para probar DIY"];
  }
  if (plan === "basic") {
    return ["10 preguntas por dia", "Troubleshooting DIY mas profundo", "Pensado para duenos y hobbyistas"];
  }
  return ["Maestro Mecanico ilimitado", "Voz, fotos y archivos", "Cotizaciones, facturas y briefs internos"];
}

export function PricingSheet({
  open,
  language,
  currentPlan,
  usage,
  allowTestOverride = false,
  activatingPlan = null,
  onActivateTestPlan,
  onClose
}: Props) {
  if (!open) {
    return null;
  }

  const copy =
    language === "es"
      ? {
          title: "Planes de uso",
          subtitle: "DIY te ayuda a entender mejor la falla. Para los Pros te ayuda a convertir mensajes en trabajo aprobado.",
          current: "Plan actual",
          usage:
            usage.plan === "free"
              ? `${usage.totalRemaining ?? 0} preguntas gratis restantes`
              : usage.plan === "basic"
                ? `${usage.dayRemaining ?? 0} preguntas restantes hoy`
                : "Uso ilimitado activo",
          upgrade: "Disponible desde Google Play",
          close: "Cerrar"
        }
      : {
          title: "Plans",
          subtitle: "DIY helps you understand the problem. Pro helps turn customer messages into approved work.",
          current: "Current plan",
          usage:
            usage.plan === "free"
              ? `${usage.totalRemaining ?? 0} free questions left`
              : usage.plan === "basic"
                ? `${usage.dayRemaining ?? 0} questions left today`
                : "Unlimited access active",
          upgrade: "Available on Google Play",
          close: "Close"
        };

  const orderedPlans: SubscriptionPlan[] = ["free", "basic", "pro"];
  const freeLimitReached = currentPlan === "free" && (usage.totalRemaining ?? 0) <= 0;

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

        {freeLimitReached ? (
          <div className="mb-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">
              {language === "es" ? "Ya se acabaron tus 5 preguntas gratis." : "You used all 5 free questions."}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {language === "es"
                ? "Si quieres seguir con este caso, sube a DIY o a Pro para abrir mas diagnosticos y seguimiento."
                : "Upgrade to DIY or Pro to keep working this case with more diagnostics and follow-up."}
            </p>
          </div>
        ) : null}

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
                    {allowTestOverride && onActivateTestPlan ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 w-full"
                        disabled={activatingPlan === plan}
                        onClick={() => void onActivateTestPlan(plan)}
                      >
                        {language === "es"
                          ? activatingPlan === plan
                            ? "Activando..."
                            : "Activar para prueba"
                          : activatingPlan === plan
                            ? "Activating..."
                            : "Activate for testing"}
                      </Button>
                    ) : null}
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
