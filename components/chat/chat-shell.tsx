"use client";

import dynamic from "next/dynamic";

const ChatLayout = dynamic(() => import("@/components/chat/chat-layout").then((mod) => mod.ChatLayout), {
  ssr: false,
  loading: () => (
    <main className="wa-app-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center justify-center bg-[var(--wa-bg-sidebar)] text-sm text-[var(--wa-text-secondary)] md:max-w-[640px] lg:max-w-[820px]">
        Cargando Mecanico AI...
      </div>
    </main>
  )
});

export function ChatShell() {
  return <ChatLayout />;
}
