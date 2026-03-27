import { Check, X, Fingerprint, CreditCard, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageStatus } from '@/types/verification';
import { useLanguage } from '@/contexts/LanguageContext';

interface Step {
  label: string;
  icon: React.ReactNode;
  status: StageStatus;
}

interface ProgressStepperProps {
  stages: Record<string, StageStatus>;
  currentStage: number;
}

export function ProgressStepper({ stages, currentStage }: ProgressStepperProps) {
  const { t } = useLanguage();

  const stageKeys = Object.keys(stages);
  const iconMap: Record<string, React.ReactNode> = {
    identity: <CreditCard className="w-5 h-5" />,
    aadhaar: <CreditCard className="w-5 h-5" />,
    biometric: <Fingerprint className="w-5 h-5" />,
    voterId: <ShieldCheck className="w-5 h-5" />,
  };
  const labelMap: Record<string, string> = {
    identity: t('identityVerification'),
    aadhaar: t('identityVerification'),
    biometric: t('biometric'),
    voterId: t('voterId'),
  };

  const steps: Step[] = stageKeys.map(key => ({
    label: labelMap[key] || key,
    icon: iconMap[key] || <CreditCard className="w-5 h-5" />,
    status: stages[key],
  }));

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-lg mx-auto">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1.5">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300',
              step.status === 'success' && 'bg-success border-success text-success-foreground',
              step.status === 'failed' && 'bg-destructive border-destructive text-destructive-foreground',
              step.status === 'active' && 'border-primary bg-primary/10 text-primary animate-pulse',
              step.status === 'pending' && 'border-muted-foreground/30 text-muted-foreground/50'
            )}>
              {step.status === 'success' ? <Check className="w-5 h-5" /> : step.status === 'failed' ? <X className="w-5 h-5" /> : step.icon}
            </div>
            <span className={cn(
              'text-xs font-medium',
              step.status === 'active' && 'text-primary font-semibold',
              step.status === 'success' && 'text-success',
              step.status === 'failed' && 'text-destructive',
              step.status === 'pending' && 'text-muted-foreground'
            )}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              'h-0.5 w-full min-w-8 -mt-5',
              steps[i + 1].status !== 'pending' || step.status === 'success' ? 'bg-success' : 'bg-border'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}
