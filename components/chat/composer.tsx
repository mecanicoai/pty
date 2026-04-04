"use client";

import { useEffect, useRef, useState } from "react";

import {
  hasNativeAttachmentBridge,
  hasNativeVoiceBridge,
  nativeBridgeEvents,
  registerNativeMediaBridge,
  requestNativeAttachments,
  requestNativeVoiceInput,
  stopNativeVoiceInput
} from "@/lib/chat/native-bridge";
import type { AppLanguage, ChatAttachment } from "@/types/chat";

interface SendPayload {
  message: string;
  attachments: ChatAttachment[];
}

interface Props {
  disabled?: boolean;
  language: AppLanguage;
  canUseVoice?: boolean;
  canUseAttachments?: boolean;
  onLockedFeature?: (feature: "voice" | "attachments") => void;
  onSend: (payload: SendPayload) => Promise<void>;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const commaIndex = raw.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("No se pudo procesar el archivo."));
        return;
      }
      resolve(raw.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

export function Composer({
  disabled = false,
  language,
  canUseVoice = true,
  canUseAttachments = true,
  onLockedFeature,
  onSend
}: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [nativeAttachments, setNativeAttachments] = useState<ChatAttachment[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    registerNativeMediaBridge();

    const handleTranscript = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string }>).detail;
      setValue(detail.text);
      setLocalError(null);
    };

    const handleVoiceState = (event: Event) => {
      const detail = (event as CustomEvent<{ recording: boolean }>).detail;
      setRecording(Boolean(detail.recording));
    };

    const handleAttachments = (event: Event) => {
      const detail = (event as CustomEvent<{ attachments: ChatAttachment[] }>).detail;
      setNativeAttachments(detail.attachments.slice(0, Math.max(0, 4 - files.length)));
      setLocalError(null);
    };

    const handleBridgeError = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string }>).detail;
      setRecording(false);
      setLocalError(detail.message);
    };

    window.addEventListener(nativeBridgeEvents.voiceTranscript, handleTranscript);
    window.addEventListener(nativeBridgeEvents.voiceState, handleVoiceState);
    window.addEventListener(nativeBridgeEvents.attachments, handleAttachments);
    window.addEventListener(nativeBridgeEvents.error, handleBridgeError);

    return () => {
      window.removeEventListener(nativeBridgeEvents.voiceTranscript, handleTranscript);
      window.removeEventListener(nativeBridgeEvents.voiceState, handleVoiceState);
      window.removeEventListener(nativeBridgeEvents.attachments, handleAttachments);
      window.removeEventListener(nativeBridgeEvents.error, handleBridgeError);
    };
  }, [files.length]);

  async function buildAttachments(inputFiles: File[]): Promise<ChatAttachment[]> {
    const payload: ChatAttachment[] = [];
    for (const file of inputFiles) {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error(`El archivo ${file.name} supera 8MB.`);
      }
      const dataBase64 = await readFileAsBase64(file);
      payload.push({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        kind: file.type.startsWith("image/") ? "image" : "file",
        dataBase64
      });
    }
    return payload;
  }

  function toggleVoiceInput() {
    if (disabled || sending) {
      return;
    }

    if (!canUseVoice) {
      onLockedFeature?.("voice");
      return;
    }

    if (hasNativeVoiceBridge()) {
      setLocalError(null);
      if (recording) {
        stopNativeVoiceInput();
        setRecording(false);
        return;
      }
      setRecording(true);
      requestNativeVoiceInput(language);
      return;
    }

    const anyWindow = window as any;
    const Recognition = anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setLocalError(language === "es" ? "Tu navegador no soporta voz." : "Voice input is not supported.");
      return;
    }

    if (recording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.lang = language === "es" ? "es-MX" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setRecording(true);
    setLocalError(null);

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      setValue(String(transcript).trim());
    };

    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setRecording(false);
      recognitionRef.current = null;
      setLocalError(language === "es" ? "No se pudo capturar audio." : "Voice capture failed.");
    };

    recognition.start();
  }

  async function submit() {
    const text = value.replace(/\s+/g, " ").trim();
    if ((!text && files.length === 0 && nativeAttachments.length === 0) || disabled || sending) {
      return;
    }

    setSending(true);
    setLocalError(null);

    try {
      const browserAttachments = await buildAttachments(files);
      const attachments = [...browserAttachments, ...nativeAttachments];
      if (attachments.length > 4) {
        throw new Error("Solo puedes enviar hasta 4 archivos por mensaje.");
      }
      await onSend({
        message: text || (language === "es" ? "Aquí va la foto o documento del problema." : "Here is the photo or document."),
        attachments
      });
      setValue("");
      setFiles([]);
      setNativeAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : language === "es" ? "No se pudo enviar el mensaje." : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="wa-input-bar sticky bottom-0 z-20 border-t border-[var(--wa-divider)] px-3 py-2">
      {files.length || nativeAttachments.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1 text-xs text-[var(--wa-control-text)] shadow-sm"
            >
              <span className="max-w-[180px] truncate">{file.name}</span>
              <button
                type="button"
                className="text-[var(--wa-text-secondary)] transition hover:text-[var(--wa-text-primary)]"
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
              >
                x
              </button>
            </span>
          ))}
          {nativeAttachments.map((attachment, index) => (
            <span
              key={`${attachment.name}-native-${index}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1 text-xs text-[var(--wa-control-text)] shadow-sm"
            >
              <span className="max-w-[180px] truncate">{attachment.name}</span>
              <button
                type="button"
                className="text-[var(--wa-text-secondary)] transition hover:text-[var(--wa-text-primary)]"
                onClick={() => setNativeAttachments((prev) => prev.filter((_, i) => i !== index))}
              >
                x
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleVoiceInput}
          className={`flex h-11 w-11 items-center justify-center rounded-2xl text-2xl text-white shadow-lg transition active:scale-95 ${
            recording ? "bg-[#bf6927]" : "bg-[var(--mech-orange)] hover:bg-[#d87524]"
          }`}
          aria-label={language === "es" ? "Micrófono" : "Microphone"}
          title={language === "es" ? "Micrófono" : "Microphone"}
        >
          {"\uD83C\uDFA4"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
          onChange={(event) => {
            if (!canUseAttachments) {
              setLocalError(language === "es" ? "Las fotos y archivos solo estan en Pro." : "Attachments are only available on Pro.");
              onLockedFeature?.("attachments");
              event.target.value = "";
              return;
            }
            const selected = Array.from(event.target.files || []);
            if (selected.length) {
              setFiles((prev) => [...prev, ...selected].slice(0, Math.max(0, 4 - nativeAttachments.length)));
            }
          }}
        />

        <button
          type="button"
          onClick={() => {
            if (!canUseAttachments) {
              setLocalError(language === "es" ? "Las fotos y archivos solo estan en Pro." : "Attachments are only available on Pro.");
              onLockedFeature?.("attachments");
              return;
            }
            if (hasNativeAttachmentBridge()) {
              setLocalError(null);
              requestNativeAttachments({
                accept: "image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls",
                multiple: true,
                maxFiles: Math.max(0, 4 - files.length)
              });
              return;
            }
            fileInputRef.current?.click();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--wa-control-bg-soft)] text-2xl text-[var(--taller-green)] shadow-sm transition hover:bg-[var(--wa-control-bg)]"
          aria-label={language === "es" ? "Adjuntar" : "Attach"}
          title={language === "es" ? "Adjuntar" : "Attach"}
        >
          {"\uD83D\uDCCE"}
        </button>

        <div className="relative flex-1">
          <input
            id="message-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={language === "es" ? "¿Qué le pasa al carro, jefe?" : "What is wrong with the vehicle?"}
            className="h-[50px] w-full rounded-[999px] border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-5 text-[17px] text-[var(--wa-control-text)] outline-none ring-0 placeholder:text-[var(--wa-control-placeholder)] focus:border-[var(--taller-green)] focus:shadow-[0_0_0_3px_rgba(23,156,99,0.12)]"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            void submit();
          }}
          disabled={disabled || sending}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--taller-green)] text-2xl text-white shadow-lg transition hover:bg-[#138655] active:scale-95 disabled:opacity-60"
          aria-label={language === "es" ? "Enviar" : "Send"}
          title={language === "es" ? "Enviar" : "Send"}
        >
          {sending ? "..." : ">"}
        </button>
      </div>

      {localError ? <p className="mt-2 text-xs text-red-600">{localError}</p> : null}
    </div>
  );
}
