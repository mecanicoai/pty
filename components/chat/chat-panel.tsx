import Image from "next/image";

import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import type { UiMessage } from "@/components/chat/types";
import type { AppLanguage, ChatAttachment } from "@/types/chat";

interface Props {
  title: string;
  language: AppLanguage;
  isDarkMode: boolean;
  messages: UiMessage[];
  loading: boolean;
  disabled?: boolean;
  quickReplies: string[];
  onSend: (payload: { message: string; attachments: ChatAttachment[] }) => Promise<void>;
  onNewThread: () => Promise<void>;
  onOpenHistory: () => void;
  onOpenIntake: () => void;
  onRefresh: () => Promise<void>;
  onToggleLanguage: () => void;
  onToggleDarkMode: () => void;
  onOpenMenu: () => void;
}

export function ChatPanel({
  title,
  language,
  isDarkMode,
  messages,
  loading,
  disabled = false,
  quickReplies,
  onSend,
  onNewThread,
  onOpenHistory,
  onOpenIntake,
  onRefresh,
  onToggleLanguage,
  onToggleDarkMode,
  onOpenMenu
}: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[var(--wa-bg-app)]">
      <header className="wa-header-gradient sticky top-0 z-20 flex items-center gap-3 px-4 py-3 text-white shadow-md">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[18px] bg-white text-2xl shadow-inner">
            <Image src="/mecanico-logo.png" alt="Mecanico AI" width={36} height={36} className="h-9 w-9 object-cover" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{title || "Mecanico AI"}</div>
            <div className="flex items-center gap-1 text-xs opacity-90">
              <div className="h-2 w-2 rounded-full bg-[#8bc34a] animate-pulse" />
              En linea - Tu companero en el taller
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
          aria-label="Abrir historial"
          title="Abrir historial"
        >
          {"\u21BA"}
        </button>

        <button
          type="button"
          onClick={onOpenIntake}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
          aria-label="Datos del vehiculo"
          title="Datos del vehiculo"
        >
          {"\uD83D\uDE97"}
        </button>

        <button
          type="button"
          onClick={() => {
            void onNewThread();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl transition hover:bg-white/20"
          aria-label="Nuevo chat"
          title="Nuevo chat"
        >
          +
        </button>

        <button
          type="button"
          onClick={onToggleLanguage}
          className="flex items-center rounded-full bg-white/14 px-3 py-1.5 text-xs font-medium transition hover:bg-white/22"
          aria-label="Cambiar idioma"
          title="Cambiar idioma"
        >
          <span className="mr-1 text-base">{language === "es" ? "\uD83C\uDDF2\uD83C\uDDFD" : "\uD83C\uDDFA\uD83C\uDDF8"}</span>
          <span>{language === "es" ? "ES" : "EN"}</span>
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
          aria-label={isDarkMode ? "Activar tema claro" : "Activar tema oscuro"}
          title={isDarkMode ? "Activar tema claro" : "Activar tema oscuro"}
        >
          {isDarkMode ? "\u2600" : "\u263E"}
        </button>

        <button
          type="button"
          onClick={() => {
            void onRefresh();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-white/20"
          aria-label="Refrescar chat"
          title="Refrescar chat"
        >
          {"\u27F3"}
        </button>

        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl transition hover:bg-white/20"
          aria-label="Abrir menu"
          title="Abrir menu"
        >
          {"\u22EE"}
        </button>
      </header>

      <MessageList messages={messages} loading={loading} />

      <div className="chat-scroll flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
        {quickReplies.map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => {
              if (!disabled) {
                void onSend({ message: reply, attachments: [] });
              }
            }}
            disabled={disabled}
            className="whitespace-nowrap rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-5 py-2.5 text-sm font-medium text-[var(--wa-control-text)] shadow-sm transition hover:bg-[var(--wa-control-bg-soft)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reply}
          </button>
        ))}
      </div>

      <Composer
        onSend={onSend}
        disabled={loading || disabled}
        language={language}
      />
    </section>
  );
}
