import { useState, useCallback, useEffect } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle, AlertTriangle, Clock, RotateCcw, Volume2, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SharedHeader } from '@/components/SharedHeader';
import { TerminalNav } from '@/components/TerminalNav';
import { AuditLog } from '@/components/AuditLog';
import { LanguageSelection } from '@/components/LanguageSelection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLanguageSelection } from '@/contexts/LanguageSelectionContext';
import { useVoterDB, type VoterRecord } from '@/contexts/VoterContext';
import { markVoterAsVotedInBackend, approveVoting } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export default function TokenCheckPage() {
  const { t, lang } = useLanguage();
  const { isLanguageSelected, setLanguageSelected } = useLanguageSelection();
  const { getActiveToken, updateVotingStatus, addAuditEntry, auditLog, voters } = useVoterDB();
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [selectedIdType, setSelectedIdType] = useState<IdType>('voter_id');
  const [foundVoter, setFoundVoter] = useState<VoterRecord | null>(null);
  const [searchResult, setSearchResult] = useState<'idle' | 'found' | 'not_found'>('idle');
  const [votingInProgress, setVotingInProgress] = useState(false);
  const [voteConfirmed, setVoteConfirmed] = useState(false);
  const [votingExpiry, setVotingExpiry] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const selectedIdLabel = selectedIdType === 'voter_id' ? (lang === 'hi' ? 'मतदाता आईडी' : 'Voter ID') : t(ID_TYPE_KEYS.find(x => x.value === selectedIdType)!.labelKey as any);

  const terminalAudit = auditLog.filter(e => e.terminal === 'tvo');

  const handleSearch = useCallback(() => {
    if (searchId.trim().length < 3) return;
    let voter: VoterRecord | undefined;

    if (selectedIdType === 'voter_id') {
      voter = getActiveToken(searchId.trim());
    } else {
      // Search by ID type and ID number
      voter = voters.find(v =>
        v.idType === selectedIdType &&
        v.idNumber.toUpperCase() === searchId.trim().toUpperCase() &&
        v.votingStatus === 'TOKEN_ACTIVE' &&
        new Date() < v.tokenExpiresAt
      );
    }

    if (voter) {
      setFoundVoter(voter);
      setSearchResult('found');
      addAuditEntry({ terminal: 'tvo', action: 'Token found', status: 'success', details: `Voter: ${voter.voterId}, Token: ${voter.token}`, voterId: voter.voterId });
    } else {
      setFoundVoter(null);
      setSearchResult('not_found');
      addAuditEntry({ terminal: 'tvo', action: 'Token lookup failed', status: 'error', details: `No active token for: ${searchId}` });
    }
  }, [searchId, selectedIdType, getActiveToken, voters, addAuditEntry]);

  // NEW: Immediate selection from list
  const handleSelectVoter = useCallback((v: VoterRecord) => {
    setSearchId(v.voterId);
    setSelectedIdType('voter_id');
    setFoundVoter(v);
    setSearchResult('found');
    addAuditEntry({ terminal: 'tvo', action: 'Token selected from list', status: 'success', details: `Voter: ${v.voterId}`, voterId: v.voterId });
  }, [addAuditEntry]);

  const handleApproveEntry = useCallback(() => {
    if (!foundVoter) return;
    updateVotingStatus(foundVoter.voterId, 'IN_PROGRESS');
    setVotingInProgress(true);
    setIsExpired(false);
    
    // Set expiry 3 minutes from now
    const expiry = Date.now() + 180 * 1000;
    setVotingExpiry(expiry);
    setTimeLeft(180);

    addAuditEntry({ terminal: 'tvo', action: 'Voter approved to enter EVM', status: 'success', details: `Status: IN_PROGRESS (3m limit)`, voterId: foundVoter.voterId });
  }, [foundVoter, updateVotingStatus, addAuditEntry]);

  useEffect(() => {
    if (!votingInProgress || !votingExpiry || voteConfirmed || isExpired) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((votingExpiry - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
        if (foundVoter) {
          updateVotingStatus(foundVoter.voterId, 'NOT_VOTED');
          addAuditEntry({ terminal: 'tvo', action: 'Token expired', status: 'warning', details: '3-minute voting window expired', voterId: foundVoter.voterId });
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [votingInProgress, votingExpiry, voteConfirmed, isExpired, foundVoter, updateVotingStatus, addAuditEntry]);

  const handleConfirmVote = useCallback(async () => {
    if (!foundVoter) return;
    setVotingExpiry(null);
    
    // PERSIST TO BACKEND
    try {
      // Use the actual Token UUID (tokenId) for the final confirmation
      if (foundVoter.tokenId) {
        await approveVoting(foundVoter.tokenId);
      } else if (foundVoter.id) {
        // Fallback for manual or legacy records
        await markVoterAsVotedInBackend(foundVoter.id);
      } else {
        await markVoterAsVotedInBackend(foundVoter.voterId);
      }
    } catch (error: any) {
      console.error('Failed to persist vote to backend:', error);
      toast.error(error.message || 'Server error saving vote.');
    }

    updateVotingStatus(foundVoter.voterId, 'VOTED');
    setVoteConfirmed(true);
    addAuditEntry({ terminal: 'tvo', action: 'Vote confirmed (EVM signal)', status: 'success', details: `Status updated to VOTED for ${foundVoter.voterId}`, voterId: foundVoter.voterId });

    // Play beep
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 200);
    } catch {}
  }, [foundVoter, updateVotingStatus, addAuditEntry]);

  const handleReset = useCallback(() => {
    setSearchId('');
    setFoundVoter(null);
    setSearchResult('idle');
    setVotingInProgress(false);
    setVoteConfirmed(false);
    setVotingExpiry(null);
    setTimeLeft(null);
    setIsExpired(false);
    setLanguageSelected(false);
    addAuditEntry({ terminal: 'tvo', action: 'TVO session reset', status: 'info' });
  }, [setLanguageSelected, addAuditEntry]);

  const toggleDark = () => { setDarkMode(d => !d); document.documentElement.classList.toggle('dark'); };
  const toggleOnline = () => setIsOnline(o => !o);

  if (!isLanguageSelected) {
    return <LanguageSelection onSelect={() => setLanguageSelected(true)} />;
  }

  const tokenTimeLeft = foundVoter ? Math.max(0, Math.floor((foundVoter.tokenExpiresAt.getTime() - Date.now()) / 1000)) : 0;
  const tokenMinutes = Math.floor(tokenTimeLeft / 60);
  const tokenSeconds = tokenTimeLeft % 60;

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader darkMode={darkMode} toggleDark={toggleDark} isOnline={isOnline} toggleOnline={toggleOnline} />
      <TerminalNav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {lang === 'hi' ? 'टोकन सत्यापन अधिकारी' : 'Token Verification Officer'}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {voteConfirmed ? (lang === 'hi' ? 'मतदान पूर्ण' : 'Vote Confirmed') 
                    : votingInProgress ? (lang === 'hi' ? 'मतदान प्रगति में' : 'Voting In Progress') 
                    : (lang === 'hi' ? 'मतदाता खोजें' : 'Search Voter')}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                TVO Terminal
              </span>
            </div>

            {voteConfirmed ? (
              <div className="text-center py-12 fade-in bg-card border border-border rounded-lg">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {lang === 'hi' ? 'मतदान सफलतापूर्वक दर्ज' : 'Vote Recorded Successfully'}
                </h2>
                <p className="text-muted-foreground mb-2">Voter: <span className="font-mono">{foundVoter?.voterId}</span></p>
                <div className="flex items-center justify-center gap-2 text-success mb-6">
                  <Volume2 className="w-5 h-5" />
                  <span className="text-sm font-medium">{lang === 'hi' ? 'EVM बीप प्राप्त' : 'EVM Beep Confirmed'}</span>
                </div>
                <Button variant="booth" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> {lang === 'hi' ? 'अगले मतदाता' : 'Next Voter'}
                </Button>
              </div>
            ) : votingInProgress ? (
              <Card className={cn("fade-in shadow-lg", isExpired ? "border-destructive/50" : "border-warning/30")}>
                <CardContent className="py-12 text-center space-y-4">
                  <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto", isExpired ? "bg-destructive/10" : "bg-warning/10")}>
                    {isExpired ? (
                      <AlertTriangle className="w-10 h-10 text-destructive" />
                    ) : (
                      <Clock className={cn("w-10 h-10 animate-pulse", timeLeft !== null && timeLeft <= 30 ? "text-destructive" : "text-warning")} />
                    )}
                  </div>
                  <h2 className={cn("text-xl font-bold", isExpired ? "text-destructive" : "text-foreground")}>
                    {isExpired 
                      ? (lang === 'hi' ? 'टोकन समाप्त है' : 'Token Expired') 
                      : (lang === 'hi' ? 'मतदान प्रगति में...' : 'Voting In Progress...')}
                  </h2>
                  <p className="text-muted-foreground">
                    Voter: <span className="font-mono font-bold">{foundVoter?.voterId}</span>
                  </p>

                  {timeLeft !== null && (
                    <div className="flex flex-col items-center gap-1 py-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {lang === 'hi' ? 'समय शेष:' : 'Time Remaining:'}
                      </span>
                      <span className={cn('text-3xl font-mono font-bold',
                        isExpired ? 'text-destructive' :
                        timeLeft <= 30 ? 'text-destructive animate-pulse' : 'text-foreground'
                      )}>
                        {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}

                  {!isExpired && (
                    <p className="text-sm text-muted-foreground">
                      {lang === 'hi' ? 'EVM सिग्नल की प्रतीक्षा...' : 'Waiting for EVM signal...'}
                    </p>
                  )}
                  
                  <div className="flex gap-3 justify-center pt-4">
                    {!isExpired && (
                      <Button variant="booth-success" onClick={handleConfirmVote} className="gap-2">
                        <Volume2 className="w-5 h-5" />
                        {lang === 'hi' ? 'EVM बीप प्राप्त — पुष्टि करें' : 'EVM Beep Received — Confirm Vote'}
                      </Button>
                    )}
                    <Button variant={isExpired ? "booth" : "booth-outline"} onClick={handleReset}>
                      {isExpired ? (lang === 'hi' ? 'अगला मतदाता' : 'Next Voter') : (lang === 'hi' ? 'रद्द करें' : 'Cancel')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="fade-in border-primary/20 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {lang === 'hi' ? 'टोकन सत्यापन' : 'Token Verification'}
                      </CardTitle>
                      <CardDescription>
                        {lang === 'hi' ? 'मतदाता आईडी से सक्रिय टोकन खोजें' : 'Search active token by Voter ID'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t('selectIdType')}</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between h-11 text-base font-medium">
                          <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" />{selectedIdLabel}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto">
                        {ID_TYPE_KEYS.map((type) => (
                          <DropdownMenuItem key={type.value} onClick={() => setSelectedIdType(type.value)}
                            className={`cursor-pointer ${selectedIdType === type.value ? 'bg-primary/10 text-primary font-medium' : ''}`}>
                            {t(type.labelKey as any)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {lang === 'hi' ? (selectedIdType === 'voter_id' ? 'मतदाता आईडी दर्ज करें' : selectedIdLabel + ' दर्ज करें') : (selectedIdType === 'voter_id' ? 'Enter Voter ID' : `Enter ${selectedIdLabel}`)}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={selectedIdType === 'voter_id' ? "e.g., VTRXXXXXX" : "Enter ID number"}
                        value={searchId}
                        onChange={(e) => { setSearchId(e.target.value.toUpperCase()); setSearchResult('idle'); }}
                        className="font-mono h-12 text-lg uppercase"
                      />
                      <Button variant="booth" onClick={handleSearch} disabled={searchId.trim().length < 3} className="shrink-0 gap-2">
                        <Search className="w-5 h-5" />
                        {lang === 'hi' ? 'खोजें' : 'Search'}
                      </Button>
                    </div>
                  </div>

                  {searchResult === 'not_found' && (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 fade-in">
                      <div className="flex items-center gap-3">
                        <XCircle className="w-6 h-6 text-destructive shrink-0" />
                        <div>
                          <p className="font-semibold text-destructive">{lang === 'hi' ? 'कोई सक्रिय टोकन नहीं मिला' : 'No Active Token Found'}</p>
                          <p className="text-sm text-muted-foreground">{lang === 'hi' ? 'इस आईडी के लिए कोई सक्रिय टोकन नहीं है' : 'No active token exists for this voter ID'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {searchResult === 'found' && foundVoter && (
                    <div className="space-y-4 fade-in">
                      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 className="w-6 h-6 text-success shrink-0" />
                          <p className="font-semibold text-success">{lang === 'hi' ? 'सक्रिय टोकन मिला!' : 'Active Token Found!'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">{lang === 'hi' ? 'मतदाता आईडी' : 'Voter ID'}</span>
                            <p className="font-mono font-bold">{foundVoter.voterId}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{lang === 'hi' ? 'टोकन' : 'Token'}</span>
                            <p className="font-mono font-bold text-primary">{foundVoter.token}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{lang === 'hi' ? 'सत्यापन प्रकार' : 'Verification'}</span>
                            <p className="font-medium">{foundVoter.verificationMode === 'digital' ? '🖥️ Digital' : '📝 Manual'}</p>
                          </div>
                        </div>
                      </div>

                      <Button variant="booth-success" className="w-full gap-2" onClick={handleApproveEntry}>
                        <ShieldCheck className="w-5 h-5" />
                        {lang === 'hi' ? 'EVM क्षेत्र में प्रवेश स्वीकृत करें' : 'Approve Entry to EVM Area'}
                      </Button>
                    </div>
                  )}

                  {/* Active tokens list */}
                  {voters.filter(v => v.votingStatus === 'TOKEN_ACTIVE').length > 0 && (
                    <div className="pt-4 border-t border-border space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {lang === 'hi' ? 'सक्रिय टोकन' : 'Active Tokens'} ({voters.filter(v => v.votingStatus === 'TOKEN_ACTIVE').length})
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {voters.filter(v => v.votingStatus === 'TOKEN_ACTIVE').map(v => (
                          <button
                            key={v.id}
                            onClick={() => handleSelectVoter(v)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors border border-transparent hover:border-primary/20 shadow-sm"
                          >
                            <div className="flex flex-col items-start">
                               <span className="font-mono text-xs font-bold">{v.voterId}</span>
                               <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{v.name}</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-primary px-2 py-1 bg-primary/5 rounded">{v.token}</span>
                            <span className="text-xs">{v.verificationMode === 'digital' ? '🖥️' : '📝'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <AuditLog entries={terminalAudit.map(e => ({ ...e, status: e.status }))} />
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t('quickActions')}</h3>
              <Button variant="booth-destructive" className="w-full gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> {lang === 'hi' ? 'रीसेट करें' : 'Reset'}
              </Button>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{t('systemInfo')}</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>{t('boothId')}</span><span className="font-mono">BH-2024-0147</span></div>
                <div className="flex justify-between"><span>{t('constituency')}</span><span>New Delhi - 01</span></div>
                <div className="flex justify-between"><span>Terminal</span><span className="font-mono text-accent">Token Verification</span></div>
                <div className="flex justify-between"><span>{t('status')}</span>
                  <span className={isOnline ? 'text-success' : 'text-destructive'}>{isOnline ? t('online') : t('offline')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
