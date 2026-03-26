import { Sun, Moon, Wifi, WifiOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ECILogo } from './ECILogo';

interface Props {
  darkMode: boolean;
  toggleDark: () => void;
  isOnline: boolean;
  toggleOnline: () => void;
}

export function SharedHeader({ darkMode, toggleDark, isOnline, toggleOnline }: Props) {
  const { t } = useLanguage();

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center">
            <ECILogo size={36} />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">{t('headerTitle')}</h1>
            <p className="text-xs text-muted-foreground">{t('headerSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleOnline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border hover:bg-muted transition-colors"
          >
            {isOnline ? (
              <><Wifi className="w-3.5 h-3.5 text-success" /> {t('online')}</>
            ) : (
              <><WifiOff className="w-3.5 h-3.5 text-destructive" /> {t('offline')}</>
            )}
          </button>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
