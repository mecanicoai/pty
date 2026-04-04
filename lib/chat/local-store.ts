import type { UiMessage } from "@/components/chat/types";
import type { AppLanguage, VehicleContext } from "@/types/chat";

export interface LocalChatSession {
  id: string;
  title: string;
  language: AppLanguage;
  vehicle: VehicleContext | null;
  messages: UiMessage[];
  updatedAt: string;
  createdAt: string;
}

const STORAGE_KEY = "mecanico-local-sessions-v1";

function createId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLocalSession(language: AppLanguage): LocalChatSession {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "Nuevo chat",
    language,
    vehicle: null,
    messages: [],
    updatedAt: now,
    createdAt: now
  };
}

export function loadLocalSessions(): LocalChatSession[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as LocalChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalSessions(sessions: LocalChatSession[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function upsertLocalSession(sessions: LocalChatSession[], session: LocalChatSession) {
  const next = [...sessions];
  const index = next.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    next[index] = session;
  } else {
    next.unshift(session);
  }
  return next.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
