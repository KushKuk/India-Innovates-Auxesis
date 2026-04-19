import { useState, useRef } from 'react';
import { ShieldCheck, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { Html5Qrcode } from 'html5-qrcode';
import { scanQr } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  voterId: string | null;
  onSuccess: () => void;
  onFail: () => void;
  onSwitchManual: () => void;
}

export function VoterIdVerification({ voterId: expectedVoterId, onSuccess, onFail, onSwitchManual }: Props) {
  const { t } = useLanguage();
  const [voterId, setVoterId] = useState('');
  const [isScanned, setIsScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessing = useRef(false);



  const handleScanVoterId = async () => {
    setVerifying(true);
    setResult('idle');

    try {
      const scannerContainerId = 'voter-id-reader';
      
      setTimeout(async () => {
        const scanner = new Html5Qrcode(scannerContainerId);
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { 
            fps: 30, 
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * 0.85);
              return { width: qrboxSize, height: qrboxSize };
            },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            if (isProcessing.current) return;
            isProcessing.current = true;

            console.log('Voter ID QR Decoded:', decodedText);
            
            try {
              // Call backend to verify QR
              const detectedVoter = await scanQr(decodedText);
              
              // Verify if the scanned ID belongs to the voter we are currently processing
              if (detectedVoter.id === expectedVoterId) {
                if (qrScannerRef.current) {
                  await qrScannerRef.current.stop();
                  qrScannerRef.current = null;
                }
                
                setVoterId(detectedVoter.id);
                setIsScanned(true);
                setVerifying(false);
                toast.success('Voter ID Matched Successfully');
              } else {
                toast.error(`Mismatch! This card belongs to ${detectedVoter.name}, not the current voter.`);
                // Reset lock so they can try again with the correct card
                isProcessing.current = false;
              }
            } catch (err: any) {
              console.error('Voter ID scan failed:', err);
              // Reset lock on error
              isProcessing.current = false;
              toast.error(err.message || 'Invalid Voter ID card');
            }
          },
          () => {}
        );
      }, 100);

    } catch (err) {
      console.error('Failed to start scanner:', err);
      setVerifying(false);
      toast.error('Failed to start camera scanner');
    }
  };

  const handleVerify = () => {
    if (!voterId || voterId.length < 10 || !isScanned) return;
    setVerifying(true);
    setResult('idle');
    setTimeout(() => {
      setVerifying(false);
      if (voterId.toUpperCase().startsWith('ERR')) { setResult('fail'); onFail(); }
      else { setResult('success'); setTimeout(onSuccess, 800); }
    }, 1800);
  };

  return (
    <Card className="fade-in border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('stage3Title')}</CardTitle>
            <CardDescription>{t('stage3Desc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-info/10 border border-info/20 text-info text-sm">
          <p className="font-semibold mb-1">Scan Voter ID Required</p>
          <p className="text-xs">Please scan the voter ID using the scanner below to proceed.</p>
        </div>

        {/* Camera Interface */}
        {verifying && (
          <div className="fade-in relative rounded-lg overflow-hidden border-2 border-primary bg-black">
             <div className="relative aspect-video">
                <div id="voter-id-reader" className="w-full h-full" />
                
                {/* Scanning Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   {/* Scanning Line */}
                   <div className="scan-line absolute inset-x-0 h-1 bg-primary/60 z-10" />
                   
                   {/* Center Target */}
                   <div className="w-80 h-80 border-2 border-primary/50 rounded-lg flex items-center justify-center">
                     <div className="text-center">
                       <Scan className="w-8 h-8 text-primary/70 mx-auto mb-2 animate-pulse" />
                       <p className="text-primary/70 text-xs font-semibold">Align Voter ID QR Here</p>
                     </div>
                   </div>
                </div>
             </div>

            {/* Status Text */}
            <div className="bg-black/50 px-4 py-2 text-center border-t border-primary/30 flex justify-between items-center">
              <p className="text-primary text-xs font-semibold">Position Voter ID in frame</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px]"
                onClick={async () => {
                  if (qrScannerRef.current) {
                    await qrScannerRef.current.stop();
                    qrScannerRef.current = null;
                  }
                  setVerifying(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!verifying && !isScanned && (
          <div className="space-y-4">
            <Button
              variant="booth"
              className="w-full gap-2"
              onClick={handleScanVoterId}
              disabled={verifying || result === 'success' || isScanned}
            >
              <span className="flex items-center gap-2">
                <Scan className="w-4 h-4" /> Scan Voter ID
              </span>
            </Button>

            <div className="p-4 border border-dashed rounded-lg bg-primary/5 space-y-3">
               <p className="text-xs font-semibold text-primary uppercase text-center">Manual ID Entry (Testing Only)</p>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   placeholder="Enter Voter ID (VOT001)" 
                   className="flex-1 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                   value={voterId}
                   onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                 />
                 <Button 
                   variant="outline" 
                   size="sm"
                   disabled={!voterId.trim()}
                   onClick={() => setIsScanned(true)}
                 >
                   Confirm
                 </Button>
               </div>
            </div>
          </div>
        )}

        {!verifying && isScanned && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-semibold text-center">
            ✓ Voter ID Scanned Successfully
          </div>
        )}

        {isScanned && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Scanned Voter ID</label>
            <Input
              placeholder="Scanned ID will appear here"
              value={voterId}
              onChange={(e) => setVoterId(e.target.value.toUpperCase())}
              className="text-center text-lg tracking-widest font-mono h-12 uppercase"
              disabled={verifying || result === 'success'}
              readOnly
            />
          </div>
        )}

        {result === 'fail' && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium fade-in border border-destructive/20">{t('voterIdNotFound')}</div>
        )}
        {result === 'success' && (
          <div className="p-3 rounded-lg bg-success/10 text-success text-sm font-medium fade-in border border-success/20">{t('voterIdMatched')}</div>
        )}

        <Button
          variant="booth"
          className="w-full"
          onClick={handleVerify}
          disabled={voterId.length < 10 || verifying || result === 'success' || !isScanned}
        >
          {verifying ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              {t('verifying')}
            </span>
          ) : t('verifyVoterId')}
        </Button>

        <div className="pt-2 border-t border-border">
          <button onClick={onSwitchManual} className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-2">
            {t('switchManual')}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
