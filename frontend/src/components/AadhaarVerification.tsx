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
  onSuccess: () => void;
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
      const success = Math.random() > 0.3;

      const scannedId = success
        ? 'ID' + Math.random().toString(36).substring(2, 9).toUpperCase()
        : '0' + Math.random().toString(36).substring(2, 8).toUpperCase();

      setIdNumber(scannedId);
      setScanning(false);

      if (scannedId.startsWith('0')) {
        handleFailure();
      } else {
        handleSuccess();
      }
    }, 2000);
  };

  const handleSuccess = () => {
    setResult('success');
    setTimeout(onSuccess, 800);
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
          <div className="p-5 border rounded-lg bg-muted/40 text-center space-y-3">
            <Scan className="w-10 h-10 mx-auto text-primary" />
            <p className="text-sm font-medium">
              Please scan your ID using the hardware scanner
            </p>
            <Button onClick={startHardwareScan}>
              Initiate Scan
            </Button>
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