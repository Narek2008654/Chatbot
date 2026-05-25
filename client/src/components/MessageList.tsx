import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthedImage } from "@/components/AuthedImage";
import { cn } from "@/lib/utils";

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
  /** True between send and the first streamed token — shows the composing dots. */
  loading?: boolean;
}

/** Small inked monogram that marks the assistant's voice, like a letterhead. */
function AssistantMark() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-7 shrink-0 select-none items-center justify-center rounded-[9px] bg-primary font-display text-sm font-semibold italic leading-none text-primary-foreground shadow-sm"
    >
      a
    </span>
  );
}

function MessageBubble({
  role,
  content,
  attachments,
  streaming,
}: MessageItem & { streaming?: boolean }) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex animate-message-in gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {!isUser && <AssistantMark />}

      <div
        className={cn(
          "max-w-[78%] px-4 py-3 text-sm shadow-sm",
          isUser
            ? "rounded-[18px] rounded-tr-md bg-primary text-primary-foreground"
            : "rounded-[18px] rounded-tl-md border border-border/70 bg-card text-card-foreground",
        )}
      >
        {attachments && attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <AuthedImage
                key={a.id}
                id={a.id}
                alt={a.filename}
                className="max-h-48 rounded-xl object-cover ring-1 ring-black/5"
              />
            ))}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        ) : (
          <div className={cn("message-prose", streaming && "stream-caret")}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

/** "Composing a reply" placeholder shown before the first token arrives. */
function ComposingBubble() {
  return (
    <div className="flex animate-message-in gap-3">
      <AssistantMark />
      <div className="rounded-[18px] rounded-tl-md border border-border/70 bg-card px-4 py-3.5 shadow-sm">
        <span className="thinking-dots" aria-label="Composing a reply">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

export function MessageList({ messages, streaming, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, loading]);

  const showStreaming = typeof streaming === "string" && streaming.length > 0;
  const showComposing = !!loading && !showStreaming;

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={idx}
            role={msg.role}
            content={msg.content}
            attachments={msg.attachments}
          />
        ))}
        {showStreaming && (
          <MessageBubble role="assistant" content={streaming!} streaming />
        )}
        {showComposing && <ComposingBubble />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
