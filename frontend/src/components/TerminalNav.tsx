import { Monitor, UserCheck, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const terminals = [
  { path: '/verify', icon: Monitor, labelEn: 'Digital Verification', labelHi: 'डिजिटल सत्यापन' },
  { path: '/manual', icon: UserCheck, labelEn: 'Manual Verification', labelHi: 'मैनुअल सत्यापन' },
  { path: '/token-check', icon: ShieldCheck, labelEn: 'Token Verification (TVO)', labelHi: 'टोकन सत्यापन (TVO)' },
];

export function TerminalNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  return (
    <div className="bg-card border-b border-border">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-1 overflow-x-auto">
          {terminals.map(t => {
            const active = location.pathname === t.path;
            return (
              <button
                key={t.path}
                onClick={() => navigate(t.path)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <t.icon className="w-4 h-4" />
                {lang === 'hi' ? t.labelHi : t.labelEn}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
