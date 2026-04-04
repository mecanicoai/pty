"use client";

import { useState } from "react";

import type { UiMessage } from "@/components/chat/types";

function formatTime(value: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--wa-text-secondary)]">{title}</p>
      <ul className="mt-1 space-y-1 text-[13px] text-[var(--wa-text-primary)]">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="leading-snug">
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const textToCopy = message.diagnostic ? message.diagnostic.summary : message.text;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      {!isUser ? (
        <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow dark:bg-[#1f1f1f]">
          {"\uD83D\uDD27"}
        </div>
      ) : null}

      <div className={`${isUser ? "message-bubble-user" : "message-bubble-bot"} max-w-[75%] px-4 py-3`}>
        {!isUser ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
              aria-label="Copiar respuesta"
              title="Copiar respuesta"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        ) : null}

        {message.diagnostic ? (
          <div className="space-y-1">
            <p className="text-[16px] leading-tight">{message.diagnostic.summary}</p>
            <div className="inline-flex rounded-full bg-[var(--wa-control-bg-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--wa-text-secondary)]">
              Urgencia: {message.diagnostic.urgency}
            </div>
            <Section title="Causas probables" items={message.diagnostic.likely_causes} />
            <Section title="Causas posibles" items={message.diagnostic.possible_causes} />
            <Section title="Riesgos criticos" items={message.diagnostic.safety_critical} />
            <Section title="Siguientes pruebas" items={message.diagnostic.next_steps} />
            <Section title="Herramientas" items={message.diagnostic.tools_needed} />
            <Section title="Preguntas" items={message.diagnostic.follow_up_questions} />
          </div>
        ) : (
          <div>
            <p className="whitespace-pre-wrap break-words text-[16px] leading-tight">{message.text}</p>
            {message.attachmentNames?.length ? (
              <div className="mt-2 space-y-1">
                {message.attachmentNames.map((name) => (
                  <p key={name} className="text-[12px] text-[var(--wa-text-secondary)]">
                    Archivo: {name}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <span className="mt-1 block text-right text-[10px] opacity-60">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
