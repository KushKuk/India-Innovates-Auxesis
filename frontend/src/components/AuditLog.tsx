import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AuditEntry } from '@/types/verification';
import { FileText, Info, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  entries: AuditEntry[];
}

const icons = {
  info: <Info className="w-3.5 h-3.5" />,
  success: <CheckCircle className="w-3.5 h-3.5" />,
  error: <XCircle className="w-3.5 h-3.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5" />,
};

const colors = {
  info: 'text-info',
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
};

export function AuditLog({ entries }: Props) {
  const { t } = useLanguage();

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{t('auditLog')}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{entries.length} {t('entries')}</span>
      </div>
      <ScrollArea className="h-64">
        <div className="p-2 space-y-1">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">{t('noActions')}</p>
          ) : (
            [...entries].reverse().map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors">
                <span className={cn('mt-0.5', colors[entry.status])}>{icons[entry.status]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{entry.action}</p>
                  {entry.details && <p className="text-xs text-muted-foreground truncate">{entry.details}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{entry.timestamp.toLocaleTimeString()}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
