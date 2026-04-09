"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import type { MessageActionEvent, UiMessage } from "@/components/chat/types";

interface Props {
  messages: UiMessage[];
  loading: boolean;
  emptyStateText?: string | null;
  onMessageAction?: (message: UiMessage, action: MessageActionEvent) => void;
}

export function MessageList({
  messages,
  loading,
  emptyStateText = "Describe la falla y te ayudo a ubicar que revisar primero.",
  onMessageAction
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current || !endRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({
        block: "end",
        behavior: loading ? "auto" : "smooth"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading]);

  return (
    <div ref={listRef} className="chat-scroll wa-chat-surface flex-1 overflow-y-auto px-4 pt-4">
      {messages.length ? (
        <div className="space-y-4 pb-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onAction={onMessageAction} />
          ))}
          {loading ? <TypingIndicator /> : null}
          <div ref={endRef} className="h-px w-full" />
        </div>
      ) : emptyStateText ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--wa-text-secondary)]">
          {emptyStateText}
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}
