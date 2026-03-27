import { useState, useCallback, useRef } from 'react';
import { Fingerprint, ScanFace, AlertTriangle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { faceMatch } from '@/lib/api';
import { toast } from 'sonner';
import { ScannedIDCard } from './ScannedIDCard';

const MAX_FINGERPRINT_ATTEMPTS = 5;
const MAX_FACIAL_ATTEMPTS = 5;

interface Props {
  voterId: string | null;
  voterInfo: { id: string, name: string, documentType: string } | null | undefined;
  onSuccess: () => void;
  onFail: () => void;
  onSwitchManual: () => void;
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

export function BiometricVerification({ voterId, voterInfo, onSuccess, onFail, onSwitchManual }: Props) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [fingerprintResult, setFingerprintResult] = useState<BiometricResult>({ status: 'idle', completed: false });
  const [facialResult, setFacialResult] = useState<BiometricResult>({ status: 'idle', completed: false });
  const [currentPhase, setCurrentPhase] = useState<'fingerprint' | 'facial'>('fingerprint');
  const [fingerprintAttempts, setFingerprintAttempts] = useState(0);
  const [facialAttempts, setFacialAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const alarmPlayedRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const maxAttempts = currentPhase === 'fingerprint' ? MAX_FINGERPRINT_ATTEMPTS : MAX_FACIAL_ATTEMPTS;
  const currentAttempts = currentPhase === 'fingerprint' ? fingerprintAttempts : facialAttempts;

  const triggerLockout = useCallback(() => {
    setLocked(true);
    if (!alarmPlayedRef.current) {
      alarmPlayedRef.current = true;
      playAlarmBeep();
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Switched to PNG for lossless quality to improve AI descriptor extraction
    return canvas.toDataURL('image/png');
  };

  const handleScan = async () => {
    if (locked) return;
    setScanning(true);

    if (currentPhase === 'fingerprint') {
      setFingerprintResult({ status: 'idle', completed: false });
      // Simulate fingerprint scan
      setTimeout(() => {
        setScanning(false);
        setFingerprintResult({ status: 'success', completed: true });
        setTimeout(() => setCurrentPhase('facial'), 800);
      }, 2000);
    } else {
      setFacialResult({ status: 'idle', completed: false });
      
      // Ensure camera is started
      if (!videoRef.current?.srcObject) {
        await startCamera();
        // Give it a moment to warm up
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Removed artificial 1.5s delay to make scan feel more immediate
      
      const liveImage = captureImage();
      if (!liveImage) {
        setScanning(false);
        setFacialResult({ status: 'fail', completed: false });
        toast.error('Failed to capture image');
        return;
      }

      try {
        const result = await faceMatch(voterId || 'test-voter', liveImage);
        setScanning(false);
        stopCamera();

        if (result.matchStatus === 'MATCH') {
          setFacialResult({ status: 'success', completed: true });
          setTimeout(onSuccess, 800);
        } else {
          setFacialResult({ status: 'fail', completed: false });
          const newAttempts = facialAttempts + 1;
          setFacialAttempts(newAttempts);
          if (newAttempts >= MAX_FACIAL_ATTEMPTS) {
            triggerLockout();
          }
          onFail();
        }
      } catch (err) {
        setScanning(false);
        stopCamera();
        setFacialResult({ status: 'fail', completed: false });
        toast.error('Server error during face match');
      }
    }
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
              <CardTitle className="text-lg text-destructive font-bold">{t('biometricVerification')}</CardTitle>
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
            <CardTitle className="text-lg font-bold">{t('biometricVerification')}</CardTitle>
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

        {/* Scan Area */}
        <div className="relative w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
          {currentPhase === 'fingerprint' ? (
            <div className={cn('w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300',
              scanning ? 'border-primary animate-pulse' : 'border-border')}>
              <Fingerprint className={cn('w-16 h-16', scanning ? 'text-primary' : 'text-muted-foreground/40')} />
            </div>
          ) : (
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn('w-full h-full object-cover grayscale transition-all', scanning && 'grayscale-0')}
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Overlay for face detection */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={cn('w-48 h-64 border-2 rounded-[40%] transition-all duration-500', 
                  scanning ? 'border-primary scale-110' : 'border-white/30 animate-pulse')}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6">
                    <div className="bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border">
                      {scanning ? 'Detecting Face' : 'Position Face Here'}
                    </div>
                  </div>
                </div>
              </div>

              {scanning && (
                <div className="absolute inset-x-0 top-0 h-1 bg-primary/60 scan-line z-10" />
              )}
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {scanning ? (currentPhase === 'fingerprint' ? t('scanningHoldStill') : 'Analyzing face features...') : currentResult.status === 'idle' ? `${t('pressScanBegin')} ${currentPhase === 'fingerprint' ? t('fingerprint') : t('facialScan')} ${t('capture')}` : ''}
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
          {currentPhase === 'facial' && !scanning && currentResult.status === 'idle' && (
             <Button variant="outline" className="flex-1 gap-2" onClick={startCamera}>
                <Camera className="w-4 h-4" /> Start Camera
             </Button>
          )}
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