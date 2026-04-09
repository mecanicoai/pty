import Image from "next/image";

import { Composer } from "@/components/chat/composer";
import { DiyHome } from "@/components/chat/diy-home";
import { MessageList } from "@/components/chat/message-list";
import type { MessageActionEvent, UiMessage } from "@/components/chat/types";
import type { SubscriptionPlan } from "@/lib/billing/plans";
import type { AppLanguage, ChatAttachment } from "@/types/chat";

interface Props {
  threadTitle: string;
  language: AppLanguage;
  isDarkMode: boolean;
  mode: "diy" | "pro";
  messages: UiMessage[];
  loading: boolean;
  showDiyHome?: boolean;
  disabled?: boolean;
  plan: SubscriptionPlan;
  usageLabel: string;
  proThreadBanner?: {
    statusLabel: string;
    detail: string;
    helper?: string;
    tone?: "neutral" | "warning" | "success";
    pipeline?: {
      currentStage: "diagnosis" | "quoted" | "scheduled" | "completed";
      paid: boolean;
      stages: Array<{
        id: "diagnosis" | "quoted" | "scheduled" | "completed";
        label: string;
        active: boolean;
        completed: boolean;
        onClick: () => void;
      }>;
      paidLabel: string;
      onTogglePaid: () => void;
    };
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
  } | null;
  proActions?: Array<{
    id: string;
    label: string;
    onClick: () => void;
  }>;
  onSend: (payload: { message: string; attachments: ChatAttachment[] }) => Promise<void>;
  onSuggestedPrompt: (prompt: string) => Promise<void>;
  onNewThread: () => Promise<void>;
  onOpenHistory: () => void;
  onOpenIntake: () => void;
  onRefresh: () => Promise<void>;
  onToggleLanguage: () => void;
  onToggleDarkMode: () => void;
  onOpenPlans: () => void;
  onLockedFeature: (feature: "voice" | "attachments") => void;
  onOpenMenu: () => void;
  onMessageAction?: (message: UiMessage, action: MessageActionEvent) => void;
}

export function ChatPanel({
  threadTitle,
  language,
  isDarkMode,
  mode,
  messages,
  loading,
  showDiyHome = false,
  disabled = false,
  plan,
  usageLabel,
  proThreadBanner,
  proActions = [],
  onSend,
  onSuggestedPrompt,
  onNewThread,
  onOpenHistory,
  onOpenIntake,
  onRefresh,
  onToggleLanguage,
  onToggleDarkMode,
  onOpenPlans,
  onLockedFeature,
  onOpenMenu,
  onMessageAction
}: Props) {
  const labels =
    language === "es"
      ? {
          statusShort: "En linea",
          statusLong: mode === "diy" ? "Guia practica para tu carro" : "Tus clientes y casos guardados",
          history: "Clientes",
          vehicle: "Datos del vehiculo",
          newChat: mode === "pro" ? "Nuevo cliente" : "Nuevo chat",
          language: "Cambiar idioma",
          darkMode: isDarkMode ? "Activar tema claro" : "Activar tema oscuro",
          refresh: "Refrescar chat",
          menu: "Abrir menu"
        }
      : {
          statusShort: "Online",
          statusLong: mode === "diy" ? "Practical car guidance" : "Saved customers and cases",
          history: "Customers",
          vehicle: "Vehicle details",
          newChat: mode === "pro" ? "New customer" : "New chat",
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
          <div className="flex min-w-0 items-center gap-1 text-[11px] opacity-90 md:text-xs">
            <div className="h-2 w-2 rounded-full bg-[#8bc34a] animate-pulse" />
            <span>{labels.statusShort}</span>
            <span className="hidden sm:inline">• {labels.statusLong}</span>
          </div>
        </div>

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

      {mode === "pro" ? (
        <div className="sticky top-[60px] z-[19] border-b border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] shadow-sm">
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="inline-flex max-w-full shrink-0 items-center rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-sm font-medium text-[var(--wa-control-text)] shadow-sm">
                <span className="truncate">{threadTitle}</span>
              </div>
              {proActions
                .filter((action) => action.id === "history" || action.id === "new-client")
                .map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={action.onClick}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                      action.id === "history"
                        ? "border border-[#d6b96a] bg-[#fff2c8] text-[#7a5800] hover:bg-[#ffe8a2]"
                        : "border border-[#9fd1b9] bg-[#dff7ec] text-[#166746] hover:bg-[#c6f0dd]"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
            </div>
          </div>

          {proActions.filter((action) => action.id !== "history" && action.id !== "new-client").length ? (
            <div className="border-t border-[var(--wa-divider)] px-3 py-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {proActions
                  .filter((action) => action.id !== "history" && action.id !== "new-client")
                  .map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.onClick}
                      className="shrink-0 rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-4 py-2 text-sm font-medium text-[var(--wa-control-text)] shadow-sm transition hover:bg-[var(--wa-control-bg-soft)]"
                    >
                      {action.label}
                    </button>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "pro" && proThreadBanner ? (
        <div className="border-b border-[var(--wa-divider)] bg-[var(--wa-bg-sidebar)] px-3 py-2">
          <div
            className={`rounded-[20px] border px-3 py-3 shadow-sm ${
              proThreadBanner.tone === "warning"
                ? "border-amber-200 bg-amber-50"
                : proThreadBanner.tone === "success"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-[var(--wa-divider)] bg-[var(--wa-bg-app)]"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wa-text-secondary)]">
              {proThreadBanner.statusLabel}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--wa-text-primary)]">{proThreadBanner.detail}</p>
            {proThreadBanner.helper ? (
              <p className="mt-1 text-xs leading-5 text-[var(--wa-text-secondary)]">{proThreadBanner.helper}</p>
            ) : null}
            {proThreadBanner.pipeline ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {proThreadBanner.pipeline.stages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={stage.onClick}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                        stage.active
                          ? "border-[var(--taller-green)] bg-[var(--taller-green)] text-white"
                          : stage.completed
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-[var(--wa-divider)] bg-[var(--wa-control-bg)] text-[var(--wa-text-secondary)] hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={proThreadBanner.pipeline.onTogglePaid}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    proThreadBanner.pipeline.paid
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-[var(--wa-divider)] bg-[var(--wa-control-bg)] text-[var(--wa-text-secondary)] hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                  }`}
                >
                  {proThreadBanner.pipeline.paidLabel}
                </button>
              </div>
            ) : null}
            {proThreadBanner.actionLabel || proThreadBanner.secondaryActionLabel ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {proThreadBanner.actionLabel && proThreadBanner.onAction ? (
                  <button
                    type="button"
                    onClick={proThreadBanner.onAction}
                    className="rounded-full bg-[var(--taller-green)] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#138655]"
                  >
                    {proThreadBanner.actionLabel}
                  </button>
                ) : null}
                {proThreadBanner.secondaryActionLabel && proThreadBanner.onSecondaryAction ? (
                  <button
                    type="button"
                    onClick={proThreadBanner.onSecondaryAction}
                    className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                  >
                    {proThreadBanner.secondaryActionLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showDiyHome ? (
        <DiyHome language={language} plan={plan} disabled={loading || disabled} onPromptSelect={onSuggestedPrompt} onOpenPlans={onOpenPlans} />
      ) : null}

      <MessageList
        messages={messages}
        loading={loading}
        emptyStateText={showDiyHome ? null : undefined}
        onMessageAction={onMessageAction}
      />

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
