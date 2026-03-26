import { useState, useCallback } from 'react';
import { RotateCcw, Wifi, WifiOff, Shield, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/ProgressStepper';
import { AadhaarVerification } from '@/components/AadhaarVerification';
import { BiometricVerification } from '@/components/BiometricVerification';
import { VoterIdVerification } from '@/components/VoterIdVerification';
import { TokenGeneration } from '@/components/TokenGeneration';
import { ManualVerification } from '@/components/ManualVerification';
import { AuditLog } from '@/components/AuditLog';
import { LanguageSelection } from '@/components/LanguageSelection';
import { useLanguage } from '@/contexts/LanguageContext';
import type { VerificationState, AuditEntry, StageStatus } from '@/types/verification';

const generateToken = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const initialState: VerificationState = {
  mode: 'primary',
  currentStage: 0,
  stages: { aadhaar: 'active', biometric: 'pending', voterId: 'pending' },
  voterId: null,
  token: null,
  auditLog: [],
  isOnline: true,
};

export function VerificationDashboard() {
  const [state, setState] = useState<VerificationState>(initialState);
  const [darkMode, setDarkMode] = useState(false);
  const [voted, setVoted] = useState(false);
  const [languageSelected, setLanguageSelected] = useState(false);
  const { t } = useLanguage();

  const addLog = useCallback((action: string, status: AuditEntry['status'], details?: string) => {
    const entry: AuditEntry = { id: crypto.randomUUID(), timestamp: new Date(), action, status, details };
    setState(prev => ({ ...prev, auditLog: [...prev.auditLog, entry] }));
  }, []);

  const updateStage = useCallback((stage: keyof VerificationState['stages'], status: StageStatus) => {
    setState(prev => ({ ...prev, stages: { ...prev.stages, [stage]: status } }));
  }, []);

  const handleAadhaarSuccess = useCallback((voterId: string) => {
    updateStage('aadhaar', 'success');
    updateStage('biometric', 'active');
    setState(prev => ({ ...prev, currentStage: 1, voterId }));
    addLog('Aadhaar verified', 'success', `Identity confirmed via UIDAI (Voter: ${voterId})`);
  }, [updateStage, addLog]);

  const handleAadhaarFail = useCallback(() => {
    updateStage('aadhaar', 'failed');
    addLog('Aadhaar verification failed', 'error', 'Record not found in UIDAI database');
  }, [updateStage, addLog]);

  const handleBiometricSuccess = useCallback(() => {
    updateStage('biometric', 'success');
    updateStage('voterId', 'active');
    setState(prev => ({ ...prev, currentStage: 2 }));
    addLog('Biometric verified', 'success', 'Fingerprint/facial matched');
  }, [updateStage, addLog]);

  const handleBiometricFail = useCallback(() => {
    updateStage('biometric', 'failed');
    addLog('Biometric verification failed', 'error', 'No match found');
  }, [updateStage, addLog]);

  const handleVoterIdSuccess = useCallback(() => {
    updateStage('voterId', 'success');
    const token = generateToken();
    setState(prev => ({ ...prev, currentStage: 3, token }));
    addLog('Voter ID verified', 'success', 'EPIC number matched');
    addLog('Token generated', 'info', `Token: ${token}`);
  }, [updateStage, addLog]);

  const handleVoterIdFail = useCallback(() => {
    updateStage('voterId', 'failed');
    addLog('Voter ID verification failed', 'error', 'Not found in electoral roll');
  }, [updateStage, addLog]);

  const switchToManual = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'manual' }));
    addLog('Switched to manual verification', 'warning', 'Primary verification unavailable');
  }, [addLog]);

  const handleManualComplete = useCallback((token: string) => {
    setState(prev => ({ ...prev, token, currentStage: 3 }));
    addLog('Manual verification approved', 'success', 'Supervisor approved');
    addLog('Manual token generated', 'info', `Token: ${token}`);
  }, [addLog]);

  const handleProceedToVote = useCallback(() => {
    setVoted(true);
    addLog('Voter proceeded to ballot', 'success', 'Token consumed');
  }, [addLog]);

  const handleReset = useCallback(() => {
    addLog('Session reset', 'info', 'Ready for next voter');
    setState({ ...initialState, auditLog: [], isOnline: state.isOnline });
    setVoted(false);
    setLanguageSelected(false);
  }, [state.isOnline, addLog]);

  const toggleDark = () => {
    setDarkMode(d => !d);
    document.documentElement.classList.toggle('dark');
  };

  const toggleOnline = () => {
    setState(prev => {
      const online = !prev.isOnline;
      return { ...prev, isOnline: online };
    });
    addLog(state.isOnline ? 'Offline mode activated' : 'Back online', state.isOnline ? 'warning' : 'info');
  };

  if (!languageSelected) {
    return <LanguageSelection onSelect={() => setLanguageSelected(true)} />;
  }

  const currentStageLabel = state.token
    ? t('tokenGenerated')
    : state.mode === 'manual'
    ? t('manualVerification')
    : [t('aadhaarVerification'), t('biometricVerification'), t('voterIdVerification')][state.currentStage];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">{t('headerTitle')}</h1>
              <p className="text-xs text-muted-foreground">{t('headerSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleOnline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border hover:bg-muted transition-colors"
            >
              {state.isOnline ? (
                <><Wifi className="w-3.5 h-3.5 text-success" /> {t('online')}</>
              ) : (
                <><WifiOff className="w-3.5 h-3.5 text-destructive" /> {t('offline')}</>
              )}
            </button>
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('currentStage')}</p>
                <p className="text-sm font-semibold text-foreground">{voted ? t('votingComplete') : currentStageLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t('mode')}:</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  state.mode === 'manual' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                }`}>
                  {state.mode === 'manual' ? t('manual') : t('primary')}
                </span>
              </div>
            </div>

            {state.mode === 'primary' && !voted && (
              <div className="bg-card border border-border rounded-lg p-4">
                <ProgressStepper stages={state.stages} currentStage={state.currentStage} />
              </div>
            )}

            {voted ? (
              <div className="text-center py-16 fade-in">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">🗳️</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{t('voteRecorded')}</h2>
                <p className="text-muted-foreground mb-6">{t('voterMarked')}</p>
                <Button variant="booth" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> {t('resetNextVoter')}
                </Button>
              </div>
            ) : state.token ? (
              <TokenGeneration
                token={state.token}
                isManual={state.mode === 'manual'}
                onProceedToVote={handleProceedToVote}
              />
            ) : state.mode === 'manual' ? (
              <ManualVerification
                onComplete={handleManualComplete}
                onCancel={() => {
                  setState(prev => ({ ...prev, mode: 'primary' }));
                  addLog('Returned to primary verification', 'info');
                }}
              />
            ) : (
              <>
                {state.currentStage === 0 && (
                  <AadhaarVerification
                    onSuccess={handleAadhaarSuccess}
                    onFail={handleAadhaarFail}
                    onSwitchManual={switchToManual}
                  />
                )}
                {state.currentStage === 1 && (
                  <BiometricVerification
                    voterId={state.voterId}
                    onSuccess={handleBiometricSuccess}
                    onFail={handleBiometricFail}
                    onSwitchManual={switchToManual}
                  />
                )}
                {state.currentStage === 2 && (
                  <VoterIdVerification
                    onSuccess={handleVoterIdSuccess}
                    onFail={handleVoterIdFail}
                    onSwitchManual={switchToManual}
                  />
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            <AuditLog entries={state.auditLog} />
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('quickActions')}</h3>
              <Button variant="booth-destructive" className="w-full gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> {t('resetNextVoter')}
              </Button>
              {state.mode === 'primary' && !state.token && !voted && (
                <Button variant="booth-outline" className="w-full" onClick={switchToManual}>
                  {t('switchManualVerif')}
                </Button>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('systemInfo')}</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>{t('boothId')}</span><span className="font-mono">BH-2024-0147</span></div>
                <div className="flex justify-between"><span>{t('constituency')}</span><span>New Delhi - 01</span></div>
                <div className="flex justify-between"><span>{t('officer')}</span><span>ID: OFF-8832</span></div>
                <div className="flex justify-between"><span>{t('status')}</span>
                  <span className={state.isOnline ? 'text-success' : 'text-destructive'}>{state.isOnline ? t('online') : t('offline')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
