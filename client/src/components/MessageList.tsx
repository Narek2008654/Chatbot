import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthedImage } from "@/components/AuthedImage";

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
}

interface MessageItem {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

interface MessageListProps {
  messages: MessageItem[];
  streaming?: string;
}

function MessageBubble({ role, content, attachments }: MessageItem) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {attachments && attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <AuthedImage
                key={a.id}
                id={a.id}
                alt={a.filename}
                className="max-h-48 rounded-lg object-cover"
              />
            ))}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const showStreaming = typeof streaming === "string" && streaming.length > 0;

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <div className="p-4">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={idx}
            role={msg.role}
            content={msg.content}
            attachments={msg.attachments}
          />
        ))}
        {showStreaming && (
          <MessageBubble role="assistant" content={streaming!} />
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
