import { Header } from '../components/Header';
import { AIChatBox } from '../components/AIChatBox';
import { Trash2 } from 'lucide-react';
import type { ChatMessage } from '../types';
import { useLanguage } from '../lib/language';

interface ChatScreenProps {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
}

export function ChatScreen({ messages, loading, onSend, onClear }: ChatScreenProps) {
  const { t } = useLanguage();
  return (
    <main className="flex h-full min-h-0 flex-col bg-page">
      <Header
        overline={t('AI ASSISTANT')}
        title={t('Study AI')}
        trailing={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClear}
              aria-label={t('Clear chat')}
              title={t('Clear chat')}
              className="flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-page text-muted hover:border-accent-red hover:text-accent-red"
            >
              <Trash2 size={15} aria-hidden />
            </button>
            <div className="flex items-center gap-1.5 rounded-sm border-hairline border-muted-4 px-2.5 py-[5px]">
              <span className="h-1.5 w-1.5 rounded-pill bg-success" aria-hidden />
              <span className="font-display text-[10px] font-semibold tracking-wide text-slate">{t('ONLINE')}</span>
            </div>
          </div>
        }
      />
      <AIChatBox messages={messages} loading={loading} onSend={onSend} />
    </main>
  );
}
