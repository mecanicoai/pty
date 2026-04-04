import type { AppLanguage, ChatAttachment } from "@/types/chat";

const EVENTS = {
  voiceTranscript: "mecanico-native-voice-transcript",
  voiceState: "mecanico-native-voice-state",
  attachments: "mecanico-native-attachments",
  error: "mecanico-native-error"
} as const;

declare global {
  interface Window {
    MecanicoAndroid?: {
      startVoiceInput?: (language: AppLanguage) => void;
      stopVoiceInput?: () => void;
      pickAttachments?: (accept: string, multiple: boolean, maxFiles: number) => void;
    };
  }
}

function normalizeTranscript(payload: unknown) {
  if (typeof payload === "string") {
    return payload.trim();
  }
  if (payload && typeof payload === "object" && typeof (payload as { text?: unknown }).text === "string") {
    return String((payload as { text: string }).text).trim();
  }
  return "";
}

function normalizeAttachments(payload: unknown): ChatAttachment[] {
  const parsed =
    typeof payload === "string"
      ? (() => {
          try {
            return JSON.parse(payload) as unknown;
          } catch {
            return [];
          }
        })()
      : payload;

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { attachments?: unknown[] }).attachments)
      ? (parsed as { attachments: unknown[] }).attachments
      : [];

  return list.filter((item): item is ChatAttachment => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const next = item as Record<string, unknown>;
    return (
      typeof next.name === "string" &&
      typeof next.mimeType === "string" &&
      (next.kind === "image" || next.kind === "file") &&
      typeof next.dataBase64 === "string"
    );
  });
}

function normalizeError(payload: unknown) {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string") {
    return String((payload as { message: string }).message);
  }
  return "No se pudo completar la accion nativa.";
}

function emit<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function registerNativeMediaBridge() {
  window.MecanicoWebApp = {
    ...(window.MecanicoWebApp ?? {}),
    receiveVoiceTranscript: (payload: string | { text?: string }) => {
      const text = normalizeTranscript(payload);
      if (text) {
        emit(EVENTS.voiceTranscript, { text });
      }
      emit(EVENTS.voiceState, { recording: false });
    },
    setVoiceRecording: (recording: boolean) => {
      emit(EVENTS.voiceState, { recording: Boolean(recording) });
    },
    receiveAttachments: (payload: string | unknown[] | { attachments?: unknown[] }) => {
      emit(EVENTS.attachments, { attachments: normalizeAttachments(payload) });
    },
    receiveBridgeError: (payload: string | { message?: string }) => {
      emit(EVENTS.error, { message: normalizeError(payload) });
      emit(EVENTS.voiceState, { recording: false });
    }
  };
}

export function hasNativeVoiceBridge() {
  return typeof window !== "undefined" && typeof window.MecanicoAndroid?.startVoiceInput === "function";
}

export function hasNativeAttachmentBridge() {
  return typeof window !== "undefined" && typeof window.MecanicoAndroid?.pickAttachments === "function";
}

export function requestNativeVoiceInput(language: AppLanguage) {
  window.MecanicoAndroid?.startVoiceInput?.(language);
}

export function stopNativeVoiceInput() {
  window.MecanicoAndroid?.stopVoiceInput?.();
}

export function requestNativeAttachments(input: { accept: string; multiple: boolean; maxFiles: number }) {
  window.MecanicoAndroid?.pickAttachments?.(input.accept, input.multiple, input.maxFiles);
}

export const nativeBridgeEvents = EVENTS;
