import { useEffect, useRef, useState } from 'react';
import { QUICK_PROMPTS } from '../mockData';
import type { ChatMessage } from '../types';
import { useLanguage } from '../lib/language';

interface AIChatBoxProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function AIAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-primary bg-primary">
      <span className="font-display text-[10px] font-extrabold tracking-[0.02em] text-primary-contrast">AI</span>
    </div>
  );
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isAI = message.role === 'ai';
  const { t } = useLanguage();

  return (
    <article className={`flex flex-col gap-1 ${isAI ? 'items-start' : 'items-end'}`}>
      {isAI ? (
        <div className="mb-0.5 flex items-center gap-2">
          <AIAvatar />
          <span className="font-display text-[9px] font-bold tracking-wider text-muted">
            {t('Study AI')} · {message.time}
          </span>
        </div>
      ) : null}

      <div className="max-w-[82%] rounded-sm border border-border bg-page px-3.5 py-3 text-charcoal">
        <p className="m-0 whitespace-pre-line font-body text-[13px] leading-[1.65]">
          {message.text}
        </p>
      </div>

      {!isAI ? <span className="font-body text-[9px] text-muted-3">{message.time}</span> : null}
    </article>
  );
}

export function AIChatBox({ messages, onSend, loading }: AIChatBoxProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  function submit(text: string): void {
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setInput('');
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section
        ref={messagesContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
        aria-live="polite"
      >
        <div className="flex min-h-full flex-col gap-3.5">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {loading ? (
            <div className="flex items-start gap-2.5">
              <AIAvatar />
              <div className="flex items-center gap-1 rounded-sm border-hairline border-border px-3.5 py-3">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-[5px] w-[5px] rounded-pill bg-muted-4 animate-chat-pulse"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  />
                ))}
                <span className="sr-only">{t('Assistant is typing')}</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-row px-6 pb-2 pt-3">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={t(prompt)}
            type="button"
            onClick={() => submit(prompt)}
            className="whitespace-nowrap rounded-sm border-hairline border-border bg-transparent px-3 py-1.5 font-body text-[11px] font-normal text-slate"
          >
            {t(prompt)}
          </button>
        ))}
      </div>

      <form
        className="flex shrink-0 items-end gap-2.5 border-t border-ui px-6 py-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
      >
        <label className="sr-only" htmlFor="chat-input">
          {t('Message')}
        </label>
        <div className="flex flex-1 items-center rounded-sm border border-border px-3.5 py-2.5">
          <textarea
            id="chat-input"
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            placeholder={t('Ask anything about your studies...')}
            className="max-h-24 flex-1 resize-none bg-transparent font-body text-[13px] leading-normal text-charcoal outline-none"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-sm bg-primary px-[18px] py-2.5 font-display text-[11px] font-bold tracking-wide text-primary-contrast hover:opacity-90"
        >
          {t('SEND')}
        </button>
      </form>
    </div>
  );
}
