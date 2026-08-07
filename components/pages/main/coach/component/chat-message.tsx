interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessageBubble({ role, content }: ChatMessageProps) {
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
      </div>
    </div>
  );
}
