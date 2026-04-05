import { Button } from "@/components/ui/button";
import type { SubscriptionPlan } from "@/lib/billing/plans";
import type { AppLanguage } from "@/types/chat";

interface Props {
  language: AppLanguage;
  plan: SubscriptionPlan;
  disabled?: boolean;
  onPromptSelect: (prompt: string) => Promise<void> | void;
  onOpenPlans: () => void;
}

function getSuggestedPrompts(language: AppLanguage) {
  if (language === "en") {
    return [
      "My car will not start",
      "It shakes when I accelerate",
      "What should I check first",
      "Explain this code"
    ];
  }

  return ["Mi carro no prende", "Tiembla al acelerar", "Que revisar primero", "Explica este codigo"];
}

export function DiyHome({ language, plan, disabled = false, onPromptSelect, onOpenPlans }: Props) {
  const copy =
    language === "es"
      ? {
          eyebrow: plan === "basic" ? "DIY Plus activo" : "Empieza por aqui",
          title: "Entiende mejor la falla antes de gastar",
          description:
            plan === "basic"
              ? "Trae el sintoma, ruido o codigo y te ayudo a bajarlo a una revision mas ordenada para hacer DIY con mas criterio."
              : "Trae el sintoma, ruido o codigo y te ayudo a ubicar que revisar primero, que datos faltan y cuando conviene llevarlo al taller.",
          promptLabel: "Pruebas rapidas",
          upgradeTitle: "Sube a DIY Plus",
          upgradeBody: "Recibe mas margen de uso y una guia mas profunda para aterrizar la falla paso a paso.",
          upgradeAction: "Ver DIY Plus",
          activeTitle: "Ya tienes DIY Plus",
          activeBody: "Aprovecha tus preguntas del dia para revisar la falla con mas detalle y mejor orden."
        }
      : {
          eyebrow: plan === "basic" ? "DIY Plus active" : "Start here",
          title: "Understand the problem before spending money",
          description:
            plan === "basic"
              ? "Bring the symptom, noise, or code and I will help turn it into a more structured DIY check."
              : "Bring the symptom, noise, or code and I will help you decide what to inspect first, what details are missing, and when it should go to a shop.",
          promptLabel: "Quick starts",
          upgradeTitle: "Upgrade to DIY Plus",
          upgradeBody: "Get more usage and deeper troubleshooting guidance when the first checks are not enough.",
          upgradeAction: "See DIY Plus",
          activeTitle: "DIY Plus is active",
          activeBody: "Use your daily questions to narrow the problem down with more detail."
        };

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <section className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] px-4 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mech-orange)]">{copy.eyebrow}</p>
        <h2 className="mt-3 text-[26px] font-semibold leading-tight text-[var(--wa-text-primary)]">{copy.title}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--wa-text-secondary)]">{copy.description}</p>
      </section>

      <section className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--wa-text-secondary)]">{copy.promptLabel}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {getSuggestedPrompts(language).map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={disabled}
              onClick={() => void onPromptSelect(prompt)}
              className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-4 py-2 text-sm font-medium text-[var(--wa-control-text)] shadow-sm transition hover:bg-[var(--wa-control-bg-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] px-4 py-4 shadow-sm">
        <p className="text-base font-semibold text-[var(--wa-text-primary)]">
          {plan === "free" ? copy.upgradeTitle : copy.activeTitle}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--wa-text-secondary)]">
          {plan === "free" ? copy.upgradeBody : copy.activeBody}
        </p>
        {plan === "free" ? (
          <Button type="button" className="mt-4 w-full sm:w-auto" onClick={onOpenPlans}>
            {copy.upgradeAction}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
