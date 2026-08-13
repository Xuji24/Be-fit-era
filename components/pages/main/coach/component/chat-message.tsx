interface ChatMessageSource {
  slug: string;
  title: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: ChatMessageSource[];
}

export default function ChatMessageBubble({ role, content, sources }: ChatMessageProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm font-merriweather-sans leading-snug ${
          isUser
            ? "bg-[#FF5733] text-white rounded-br-md"
            : "bg-[#F5F5F0] dark:bg-[#2A2A2E] text-[#1A1A1A] dark:text-white rounded-bl-md"
        }`}
      >
        {content}
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/10 text-[11px] text-[#1A1A1A]/40 dark:text-white/40">
            Sources: {sources.map((s) => s.title).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}
