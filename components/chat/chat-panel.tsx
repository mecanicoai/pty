import Image from "next/image";

import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import type { UiMessage } from "@/components/chat/types";
import type { SubscriptionPlan } from "@/lib/billing/plans";
import type { AppLanguage, ChatAttachment } from "@/types/chat";

interface Props {
  title: string;
  language: AppLanguage;
  isDarkMode: boolean;
  messages: UiMessage[];
  loading: boolean;
  disabled?: boolean;
  plan: SubscriptionPlan;
  usageLabel: string;
  onSend: (payload: { message: string; attachments: ChatAttachment[] }) => Promise<void>;
  onNewThread: () => Promise<void>;
  onOpenHistory: () => void;
  onOpenIntake: () => void;
  onRefresh: () => Promise<void>;
  onToggleLanguage: () => void;
  onToggleDarkMode: () => void;
  onOpenPlans: () => void;
  onLockedFeature: (feature: "voice" | "attachments") => void;
  onOpenMenu: () => void;
}

export function ChatPanel({
  title,
  language,
  isDarkMode,
  messages,
  loading,
  disabled = false,
  plan,
  usageLabel,
  onSend,
  onNewThread,
  onOpenHistory,
  onOpenIntake,
  onRefresh,
  onToggleLanguage,
  onToggleDarkMode,
  onOpenPlans,
  onLockedFeature,
  onOpenMenu
}: Props) {
  const labels =
    language === "es"
      ? {
          title: title || "Mecánico AI",
          statusShort: "En línea",
          statusLong: "Tu compañero en el taller",
          planBadge: plan === "free" ? "Gratis" : plan === "basic" ? "Básico" : "Pro",
          history: "Abrir historial",
          vehicle: "Datos del vehículo",
          newChat: "Nuevo chat",
          language: "Cambiar idioma",
          darkMode: isDarkMode ? "Activar tema claro" : "Activar tema oscuro",
          refresh: "Refrescar chat",
          menu: "Abrir menú"
        }
      : {
          title: title || "Mecanico AI",
          statusShort: "Online",
          statusLong: "Your shop companion",
          planBadge: plan === "free" ? "Free" : plan === "basic" ? "Basic" : "Pro",
          history: "Open history",
          vehicle: "Vehicle details",
          newChat: "New chat",
          language: "Change language",
          darkMode: isDarkMode ? "Use light mode" : "Use dark mode",
          refresh: "Refresh chat",
          menu: "Open menu"
        };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[var(--wa-bg-app)]">
      <header className="wa-header-gradient sticky top-0 z-20 flex items-center gap-2 px-3 py-3 text-white shadow-md md:gap-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[18px] bg-white text-2xl shadow-inner">
            <Image src="/mecanico-logo.png" alt="Mecanico AI" width={36} height={36} className="h-9 w-9 object-cover" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold md:text-lg">{labels.title}</div>
            <div className="flex items-center gap-1 text-[11px] opacity-90 md:text-xs">
              <div className="h-2 w-2 rounded-full bg-[#8bc34a] animate-pulse" />
              <span>{labels.statusShort}</span>
              <span className="hidden sm:inline">• {labels.statusLong}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20 md:flex"
          aria-label={labels.history}
          title={labels.history}
        >
          {"\u21BA"}
        </button>

        <button
          type="button"
          onClick={onOpenIntake}
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20 md:flex"
          aria-label={labels.vehicle}
          title={labels.vehicle}
        >
          {"\uD83D\uDE97"}
        </button>

        <button
          type="button"
          onClick={() => {
            void onNewThread();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20 md:h-9 md:w-9 md:text-xl"
          aria-label={labels.newChat}
          title={labels.newChat}
        >
          +
        </button>

        <button
          type="button"
          onClick={onToggleLanguage}
          className="flex items-center rounded-full bg-white/14 px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-white/22 md:px-3 md:text-xs"
          aria-label={labels.language}
          title={labels.language}
        >
          <span className="mr-1 text-base">{language === "es" ? "\uD83C\uDDF2\uD83C\uDDFD" : "\uD83C\uDDFA\uD83C\uDDF8"}</span>
          <span>{language === "es" ? "ES" : "EN"}</span>
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base transition hover:bg-white/20 md:h-9 md:w-9 md:text-lg"
          aria-label={labels.darkMode}
          title={labels.darkMode}
        >
          {isDarkMode ? "\u2600" : "\u263E"}
        </button>

        <button
          type="button"
          onClick={() => {
            void onRefresh();
          }}
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20 md:flex"
          aria-label={labels.refresh}
          title={labels.refresh}
        >
          {"\u27F3"}
        </button>

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20 md:h-9 md:w-9 md:text-xl"
          aria-label={labels.menu}
          title={labels.menu}
        >
          {"\u22EE"}
        </button>
      </header>

      <div className="border-b border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] px-3 py-2">
        <button
          type="button"
          onClick={onOpenPlans}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-xs font-medium text-[var(--wa-control-text)] shadow-sm transition hover:bg-[var(--wa-control-bg-soft)]"
        >
          <span className="rounded-full bg-[var(--wa-control-bg-soft)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--wa-text-secondary)]">
            {labels.planBadge}
          </span>
          <span className="truncate">{usageLabel}</span>
        </button>
      </div>

      <MessageList messages={messages} loading={loading} />

      <Composer
        onSend={onSend}
        disabled={loading || disabled}
        language={language}
        canUseVoice={plan === "pro"}
        canUseAttachments={plan === "pro"}
        onLockedFeature={onLockedFeature}
      />
    </section>
  );
}
