import { useState, useRef, useCallback } from 'react';
import { CreditCard, ChevronDown, FileText, TriangleAlert as AlertTriangle, Scan, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { Html5Qrcode } from 'html5-qrcode';
import { scanQr } from '@/lib/api';
import { toast } from 'sonner';
import { ScannedIDCard } from './ScannedIDCard';

const MAX_ID_ATTEMPTS = 3;

interface Props {
  onSuccess: (voterId: string, voterInfo: { id: string, name: string, documentType: string, documentNumber: string }) => void;
  onFail: () => void;
  onSwitchManual: () => void;
}


function playAlarmBeep() {
  try {
    const ctx = new AudioContext();
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
  } catch {}
}

export function AadhaarVerification({ onSuccess, onFail, onSwitchManual }: Props) {
  const { t } = useLanguage();

  const [scannedVoter, setScannedVoter] = useState<{ id: string, name: string, documentType: string, documentNumber: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [failAttempts, setFailAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessing = useRef(false);


  const alarmPlayedRef = useRef(false);


  const triggerLockout = useCallback(() => {
    setLocked(true);
    if (!alarmPlayedRef.current) {
      alarmPlayedRef.current = true;
      playAlarmBeep();
    }
  }, []);


  const startIdScan = async () => {
    if (locked) return;

    setScanning(true);
    setResult('idle');

    try {
      // Create a container for the scanner if it doesn't exist
      const scannerContainerId = 'qr-reader';
      
      // We need to wait for the element to be in the DOM
      // Since we just setScanning(true), we'll wait for the next tick
      setTimeout(async () => {
        const scanner = new Html5Qrcode(scannerContainerId);
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 30, // Higher FPS for capture
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * 0.85); // Larger box for dense codes
              return { width: qrboxSize, height: qrboxSize };
            },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            if (isProcessing.current) return;
            isProcessing.current = true;

            // Success! We found a QR code
            console.log('QR Decoded:', decodedText);
            
            try {
              // Call backend to decode and verify Base64 TYPE|ID
              const voter = await scanQr(decodedText);
              
              // BLOCK if already voted
              if (voter.hasVoted) {
                if (qrScannerRef.current) {
                  await qrScannerRef.current.stop();
                  qrScannerRef.current = null;
                }
                setScanning(false);
                playAlarmBeep();
                toast.error('Identity Fraud Prevention: This voter has already cast their vote.', {
                  duration: 5000,
                  style: { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' }
                });
                onFail();
                return;
              }

              // If we reached here, voter was found and hasn't voted
              if (qrScannerRef.current) {
                await qrScannerRef.current.stop();
                qrScannerRef.current = null;
              }
              
              setScannedVoter({
                id: voter.id,
                name: voter.name,
                documentType: (voter as any).documentType || 'ID',
                documentNumber: (voter as any).documentNumber || voter.id
              });
              setScanning(false);
              setResult('success');
              
              // Hold for 2 seconds then proceed
              setTimeout(() => onSuccess(voter.id, {
                id: voter.id,
                name: voter.name,
                documentType: (voter as any).documentType || 'ID',
                documentNumber: (voter as any).documentNumber || voter.id
              }), 2000);
            } catch (err: any) {
              console.error('Scan verification failed:', err);
              // Only reset lock if it failed (so we can try again)
              isProcessing.current = false;
              toast.error(err.message || 'Invalid ID card or record not found');
            }
          },
          (errorMessage) => {
            // Scan failed (usually just no QR in frame)
          }
        );
      }, 100);

    } catch (err) {
      console.error('Failed to start scanner:', err);
      setScanning(false);
      toast.error('Failed to start camera scanner');
    }
  };


  const handleFailure = () => {
    setResult('fail');

    const attempts = failAttempts + 1;
    setFailAttempts(attempts);

    if (attempts >= MAX_ID_ATTEMPTS) {
      triggerLockout();
    }

    onFail();
  };

  if (locked) {
    return (
      <Card className="fade-in border-destructive/40 shadow-lg">
        <CardHeader>
          <CardTitle className="text-destructive font-bold text-xl">{t('identityVerification')}</CardTitle>
          <CardDescription>{t('stage1Desc')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto animate-pulse" />
          <p className="text-destructive font-semibold">{t('idAttemptsExhausted')}</p>
          <Button variant="destructive" onClick={onSwitchManual}>
            {t('proceedToManualDesk')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fade-in border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="font-bold text-xl">{t('identityVerification')}</CardTitle>
        <CardDescription>{t('stage1Desc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Initial UI */}
        {!scanning && result === 'idle' && (
          <div className="space-y-4">
            <div className="p-5 border rounded-lg bg-muted/40 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-primary" />
              <p className="text-sm font-medium">
                Please position your ID card in front of the camera
              </p>
              <Button onClick={startIdScan} className="w-full gap-2 py-6 text-lg font-semibold shadow-md">
                <Scan className="w-5 h-5" /> Start Camera Scan
              </Button>
            </div>
            
          </div>
        )}

        {/* Scanning with Video Preview */}
        {scanning && (
          <div className="space-y-4">
             <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary bg-black">
                <div id="qr-reader" className="w-full h-full" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   <div className="w-80 h-80 border-2 border-primary/50 rounded-lg flex items-center justify-center">
                      <div className="scan-line absolute inset-x-0 h-1 bg-primary/60 z-10" />
                      <p className="text-primary text-[10px] uppercase font-bold bg-black/40 px-2 py-1 rounded">Align QR Code Here</p>
                   </div>
                </div>
             </div>
             <div className="text-center space-y-2">
                <p className="text-sm font-semibold animate-pulse text-primary">Scanning for ID QR Code...</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mx-auto"
                  onClick={async () => {
                    if (qrScannerRef.current) {
                      await qrScannerRef.current.stop();
                      qrScannerRef.current = null;
                    }
                    setScanning(false);
                  }}
                >
                  Cancel Scan
                </Button>
             </div>
          </div>
        )}

        {/* Success */}
        {result === 'success' && scannedVoter && (
          <ScannedIDCard voter={scannedVoter} />
        )}

        {/* Failure */}
        {result === 'fail' && (
          <div className="text-red-600 text-center space-y-2">
            ✗ Scan Failed
            <div className="text-sm">
              {failAttempts}/{MAX_ID_ATTEMPTS} attempts used
            </div>
            <Button variant="outline" onClick={startIdScan}>
              Retry Scan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}