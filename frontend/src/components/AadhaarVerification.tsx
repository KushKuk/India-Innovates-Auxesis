import { useState, useRef, useCallback } from 'react';
import { CreditCard, ChevronDown, FileText, TriangleAlert as AlertTriangle, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';

const MAX_ID_ATTEMPTS = 3;

interface Props {
  onSuccess: (voterId: string) => void;
  onFail: () => void;
  onSwitchManual: () => void;
}

const ID_TYPE_KEYS = [
  { value: 'voter_id', labelKey: 'voterId' },
  { value: 'aadhaar', labelKey: 'aadhaarCard' },
  { value: 'pan', labelKey: 'panCard' },
  { value: 'driving_license', labelKey: 'drivingLicense' },
  { value: 'passport', labelKey: 'passport' },
  { value: 'mgnrega', labelKey: 'mgnregaCard' },
  { value: 'smart_card', labelKey: 'smartCard' },
  { value: 'health_insurance', labelKey: 'healthInsurance' },
  { value: 'service_id', labelKey: 'serviceId' },
  { value: 'pension', labelKey: 'pensionDoc' },
  { value: 'passbook', labelKey: 'passbook' },
  { value: 'transgender_certificate', labelKey: 'transgenderCertificate' },
] as const;

type IdType = typeof ID_TYPE_KEYS[number]['value'];

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

  const [selectedIdType, setSelectedIdType] = useState<IdType>('voter_id');
  const [idNumber, setIdNumber] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'fail'>('idle');
  const [failAttempts, setFailAttempts] = useState(0);
  const [locked, setLocked] = useState(false);

  const alarmPlayedRef = useRef(false);

  const selectedLabel = t(
    ID_TYPE_KEYS.find((x) => x.value === selectedIdType)!.labelKey as any
  );

  const triggerLockout = useCallback(() => {
    setLocked(true);
    if (!alarmPlayedRef.current) {
      alarmPlayedRef.current = true;
      playAlarmBeep();
    }
  }, []);

  const startHardwareScan = () => {
    if (locked) return;

    setScanning(true);
    setResult('idle');
    setIdNumber('');

    setTimeout(() => {
      // INTERNAL TEST OVERRIDE: Always succeed as VOT001 (Kushaagra Goel)
      setIdNumber('VOT001 (KUSHAAGRA GOEL)');
      setScanning(false);
      handleSuccess('VOT001');
    }, 1500);
  };

  const handleSuccess = (voterId: string) => {
    setResult('success');
    setTimeout(() => onSuccess(voterId), 800);
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
          <CardTitle className="text-destructive">{t('stage1Title')}</CardTitle>
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
        <CardTitle>{t('stage1Title')}</CardTitle>
        <CardDescription>{t('stage1Desc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* ID Type */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {selectedLabel}
              </span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ID_TYPE_KEYS.map((type) => (
              <DropdownMenuItem
                key={type.value}
                onClick={() => setSelectedIdType(type.value)}
              >
                {t(type.labelKey as any)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Scanner UI */}
        {!scanning && result === 'idle' && (
          <div className="space-y-4">
            <div className="p-5 border rounded-lg bg-muted/40 text-center space-y-3">
              <Scan className="w-10 h-10 mx-auto text-primary" />
              <p className="text-sm font-medium">
                Please scan your ID using the hardware scanner
              </p>
              <Button onClick={startHardwareScan}>
                Initiate Scan
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground italic">
                  Internal Test Mode
                </span>
              </div>
            </div>

            <div className="p-4 border border-dashed rounded-lg bg-primary/5 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase text-center">Manual ID Entry (Testing Only)</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter Voter ID (e.g. VOT001)" 
                  className="flex-1 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={!idNumber.trim()}
                  onClick={() => handleSuccess(idNumber.trim())}
                >
                  Confirm
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Use this to switch between test accounts without code changes.
              </p>
            </div>
          </div>
        )}

        {/* Scanning */}
        {scanning && (
          <div className="text-center space-y-2">
            <Scan className="w-10 h-10 mx-auto animate-pulse text-primary" />
            <p>Scanning...</p>
          </div>
        )}

        {/* Success */}
        {result === 'success' && (
          <div className="text-green-600 text-center">
            ✓ ID Verified Successfully
            <div className="font-mono mt-1">{idNumber}</div>
          </div>
        )}

        {/* Failure */}
        {result === 'fail' && (
          <div className="text-red-600 text-center space-y-2">
            ✗ Scan Failed
            <div className="text-sm">
              {failAttempts}/{MAX_ID_ATTEMPTS} attempts used
            </div>
            <Button variant="outline" onClick={startHardwareScan}>
              Retry Scan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}