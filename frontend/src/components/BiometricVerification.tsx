import { useState, useCallback, useRef } from 'react';
import { Fingerprint, ScanFace, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const MAX_FINGERPRINT_ATTEMPTS = 5;
const MAX_FACIAL_ATTEMPTS = 5;

interface Props {
  onSuccess: () => void;
  onFail: () => void;
  // onSwitchManual: () => void;
}

interface BiometricResult {
  status: 'idle' | 'success' | 'fail';
  completed: boolean;
}

function playAlarmBeep() {
  try {
    const ctx = new AudioContext();
    // Play 3 short warning beeps
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.15);
    });
  } catch {
    // Audio not supported
  }
}

export function BiometricVerification({ onSuccess, onFail}: Props) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [fingerprintResult, setFingerprintResult] = useState<BiometricResult>({ status: 'idle', completed: false });
  const [facialResult, setFacialResult] = useState<BiometricResult>({ status: 'idle', completed: false });
  const [currentPhase, setCurrentPhase] = useState<'fingerprint' | 'facial'>('fingerprint');
  const [fingerprintAttempts, setFingerprintAttempts] = useState(0);
  const [facialAttempts, setFacialAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const alarmPlayedRef = useRef(false);

  const maxAttempts = currentPhase === 'fingerprint' ? MAX_FINGERPRINT_ATTEMPTS : MAX_FACIAL_ATTEMPTS;
  const currentAttempts = currentPhase === 'fingerprint' ? fingerprintAttempts : facialAttempts;

  const triggerLockout = useCallback(() => {
    setLocked(true);
    if (!alarmPlayedRef.current) {
      alarmPlayedRef.current = true;
      playAlarmBeep();
    }
  }, []);

  const handleScan = () => {
    if (locked) return;
    setScanning(true);
    const setCurrentResult = currentPhase === 'fingerprint' ? setFingerprintResult : setFacialResult;

    setCurrentResult({ status: 'idle', completed: false });

    setTimeout(() => {
      setScanning(false);
      const success = (currentPhase === 'facial') ? 1 : 0;
      if (success) {
        setCurrentResult({ status: 'success', completed: true });

        if (currentPhase === 'fingerprint') {
          setTimeout(() => {
            setCurrentPhase('facial');
          }, 800);
        } else {
          setTimeout(onSuccess, 800);
        }
      } else {
        setCurrentResult({ status: 'fail', completed: false });
        
        if (currentPhase === 'fingerprint') {
          const newAttempts = fingerprintAttempts + 1;
          setFingerprintAttempts(newAttempts);
          if (newAttempts >= MAX_FINGERPRINT_ATTEMPTS) {
            triggerLockout();
          }
        } else {
          const newAttempts = facialAttempts + 1;
          setFacialAttempts(newAttempts);
          if (newAttempts >= MAX_FACIAL_ATTEMPTS) {
            triggerLockout();
          }
        }
        onFail();
      }
    }, 3000);
  };

  const isAllBiometricsComplete = fingerprintResult.completed && facialResult.completed;
  const currentResult = currentPhase === 'fingerprint' ? fingerprintResult : facialResult;

  if (locked) {
    const exhaustedKey = currentPhase === 'fingerprint' ? 'fingerprintAttemptsExhausted' : 'facialAttemptsExhausted';
    return (
      <Card className="fade-in border-destructive/40 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg text-destructive">{t('stage2Title')}</CardTitle>
              <CardDescription>{t('stage2Desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-6 rounded-xl bg-destructive/10 border-2 border-destructive/30 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto animate-pulse">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-destructive font-semibold text-lg">{t(exhaustedKey as any)}</p>
            <Button variant="booth-destructive" className="gap-2" onClick={onSwitchManual}>
              {t('proceedToManualDesk')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fade-in border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('stage2Title')}</CardTitle>
            <CardDescription>{t('stage2Desc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Biometric Progress Steps */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className={cn('p-3 rounded-lg border-2 transition-all',
              fingerprintResult.completed ? 'border-success bg-success/10' :
              currentPhase === 'fingerprint' ? 'border-primary bg-primary/10' : 'border-border')}>
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint className="w-4 h-4" />
                <span className="text-sm font-semibold">{t('fingerprint')}</span>
                {fingerprintResult.completed && <span className="text-success ml-auto">✓</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {fingerprintResult.completed ? t('biometricSuccess') : currentPhase === 'fingerprint' ? t('currentPhase') : t('pending')}
              </p>
            </div>
          </div>
          <div className="flex-1">
            <div className={cn('p-3 rounded-lg border-2 transition-all',
              facialResult.completed ? 'border-success bg-success/10' :
              currentPhase === 'facial' ? 'border-primary bg-primary/10' : 'border-border')}>
              <div className="flex items-center gap-2 mb-1">
                <ScanFace className="w-4 h-4" />
                <span className="text-sm font-semibold">{t('facialScan')}</span>
                {facialResult.completed && <span className="text-success ml-auto">✓</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {facialResult.completed ? t('biometricSuccess') : currentPhase === 'facial' ? t('currentPhase') : t('pending')}
              </p>
            </div>
          </div>
        </div>

        {/* Attempt counter */}
        {currentResult.status === 'fail' && currentAttempts > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-warning font-medium">
              {currentAttempts}/{maxAttempts}
            </span>
            <span className="text-muted-foreground">— {maxAttempts - currentAttempts} {t('attemptsRemaining')}</span>
          </div>
        )}

        <div className="relative w-32 h-32 mx-auto">
          <div className={cn('w-full h-full rounded-full border-4 flex items-center justify-center transition-all duration-300',
            scanning && 'border-primary', currentResult.status === 'success' && 'border-success bg-success/10',
            currentResult.status === 'fail' && 'border-destructive bg-destructive/10', currentResult.status === 'idle' && !scanning && 'border-border')}>
            {currentPhase === 'fingerprint' ? (
              <Fingerprint className={cn('w-16 h-16 transition-colors', scanning ? 'text-primary' : 'text-muted-foreground/40')} />
            ) : (
              <ScanFace className={cn('w-16 h-16 transition-colors', scanning ? 'text-primary' : 'text-muted-foreground/40')} />
            )}
          </div>
          {scanning && (
            <>
              <div className="absolute inset-0 rounded-full border-4 border-primary/50 pulse-ring" />
              <div className="absolute inset-0 overflow-hidden rounded-full"><div className="w-full h-1 bg-primary/60 scan-line" /></div>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {scanning ? t('scanningHoldStill') : currentResult.status === 'idle' ? `${t('pressScanBegin')} ${currentPhase === 'fingerprint' ? t('fingerprint') : t('facialScan')} ${t('capture')}` : ''}
        </p>

        {currentResult.status === 'fail' && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium fade-in border border-destructive/20">{t('biometricFailed')}</div>
        )}
        {currentResult.status === 'success' && currentPhase === 'fingerprint' && (
          <div className="p-3 rounded-lg bg-success/10 text-success text-sm font-medium fade-in border border-success/20">{t('fingerprint')} {t('biometricSuccess')} - {t('proceedingFacial')}</div>
        )}
        {isAllBiometricsComplete && (
          <div className="p-3 rounded-lg bg-success/10 text-success text-sm font-medium fade-in border border-success/20">{t('allBiometricsSuccess')}</div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="booth" className="flex-1" onClick={handleScan} disabled={scanning || isAllBiometricsComplete}>
            {scanning ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {t('scanning')}
              </span>
            ) : currentResult.status === 'fail' ? t('retryScan') : t('verifyBiometric')}
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}