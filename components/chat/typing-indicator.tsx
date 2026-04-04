export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow dark:bg-[#1f1f1f]">
        {"\uD83D\uDD27"}
      </div>
      <div className="message-bubble-bot flex max-w-[75%] items-center gap-2 px-4 py-3">
        <span className="typing-dots">
          <span />
          <span />
          <span />
        </span>
        <span className="text-xs text-[var(--wa-text-secondary)]">Mecanico AI esta escribiendo...</span>
      </div>
    </div>
  );
}
