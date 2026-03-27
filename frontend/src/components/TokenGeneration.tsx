import { useState, useEffect, useCallback } from 'react';
import { Ticket, Timer, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  token: string;
  voterId: string;
  isManual: boolean;
  onProceedToVote: () => void;
}

export function TokenGeneration({ token, voterId, isManual, onProceedToVote }: Props) {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(180);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) { setExpired(true); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }, []);

  const progress = (timeLeft / 180) * 100;

  return (
    <Card className="fade-in border-success/30 shadow-lg">
      <CardHeader className="pb-4 text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
          <Ticket className="w-8 h-8 text-success" />
        </div>
        <CardTitle className="text-xl">{isManual ? t('manuallyVerifiedToken') : t('oneTimeToken')}</CardTitle>
        <CardDescription>{isManual ? t('manualTokenDesc') : t('allStagesPassed')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="inline-block px-8 py-4 bg-muted rounded-xl border-2 border-dashed border-primary/30">
            <p className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">{token}</p>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('voterId')}</p>
            <p className="text-lg font-mono font-bold text-foreground">{voterId}</p>
          </div>
          {isManual && (
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-warning/10 text-warning text-xs font-medium rounded-full">
              {t('manualVerification')}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Timer className="w-4 h-4" /> {t('tokenExpiresIn')}</span>
            <span className={cn('font-mono font-bold text-lg', timeLeft <= 30 ? 'text-destructive' : 'text-foreground')}>
              {expired ? t('expired') : formatTime(timeLeft)}
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-1000', timeLeft <= 30 ? 'bg-destructive' : 'bg-success')}
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        <Button variant="booth-success" className="w-full gap-2" onClick={onProceedToVote} disabled={expired}>
          <Vote className="w-5 h-5" />
          {expired ? t('tokenExpiredReset') : t('proceedToVote')}
        </Button>
      </CardContent>
    </Card>
  );
}
