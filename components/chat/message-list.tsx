"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import type { UiMessage } from "@/components/chat/types";

interface Props {
  messages: UiMessage[];
  loading: boolean;
}

export function MessageList({ messages, loading }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  return (
    <div ref={listRef} className="chat-scroll wa-chat-surface flex-1 overflow-y-auto px-4 pt-4">
      {messages.length ? (
        <div className="space-y-4 pb-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {loading ? <TypingIndicator /> : null}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--wa-text-secondary)]">
          Cuentame la falla y te ayudo paso a paso.
        </div>
      )}
    </div>
  );
}
