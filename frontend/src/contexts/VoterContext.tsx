import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type VotingStatus = 'NOT_VOTED' | 'TOKEN_ACTIVE' | 'IN_PROGRESS' | 'VOTED';

export interface VoterRecord {
  id: string;
  name: string;
  voterId: string;
  idType: string;
  idNumber: string;
  token: string;
  tokenGeneratedAt: Date;
  tokenExpiresAt: Date;
  verificationMode: 'digital' | 'manual';
  votingStatus: VotingStatus;
  hasVoted: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  terminal: 'digital' | 'manual' | 'tvo';
  action: string;
  status: 'info' | 'success' | 'error' | 'warning';
  details?: string;
  voterId?: string;
}

interface VoterContextType {
  voters: VoterRecord[];
  auditLog: AuditEntry[];
  addVoter: (voter: Omit<VoterRecord, 'id'>) => void;
  getActiveToken: (voterId: string) => VoterRecord | undefined;
  updateVotingStatus: (voterId: string, status: VotingStatus) => void;
  addAuditEntry: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void;
  resetVoterToken: (voterId: string) => void;
}

const VoterContext = createContext<VoterContextType | null>(null);

export function VoterProvider({ children }: { children: ReactNode }) {
  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const addAuditEntry = useCallback((entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    setAuditLog(prev => [...prev, { ...entry, id: crypto.randomUUID(), timestamp: new Date() }]);
  }, []);

  const addVoter = useCallback((voter: Omit<VoterRecord, 'id'>) => {
    setVoters(prev => {
      // Remove any existing record for this voter (re-verification)
      const filtered = prev.filter(v => v.voterId !== voter.voterId);
      return [...filtered, { ...voter, id: crypto.randomUUID() }];
    });
  }, []);

  const getActiveToken = useCallback((voterId: string) => {
    return voters.find(v => 
      v.voterId.toUpperCase() === voterId.toUpperCase() && 
      v.votingStatus === 'TOKEN_ACTIVE' &&
      new Date() < v.tokenExpiresAt
    );
  }, [voters]);

  const updateVotingStatus = useCallback((voterId: string, status: VotingStatus) => {
    setVoters(prev => prev.map(v => 
      v.voterId.toUpperCase() === voterId.toUpperCase() 
        ? { ...v, votingStatus: status, hasVoted: status === 'VOTED' } 
        : v
    ));
  }, []);

  const resetVoterToken = useCallback((voterId: string) => {
    setVoters(prev => prev.map(v => 
      v.voterId.toUpperCase() === voterId.toUpperCase() 
        ? { ...v, votingStatus: 'NOT_VOTED' as VotingStatus } 
        : v
    ));
  }, []);

  return (
    <VoterContext.Provider value={{ voters, auditLog, addVoter, getActiveToken, updateVotingStatus, addAuditEntry, resetVoterToken }}>
      {children}
    </VoterContext.Provider>
  );
}

export function useVoterDB() {
  const ctx = useContext(VoterContext);
  if (!ctx) throw new Error('useVoterDB must be used within VoterProvider');
  return ctx;
}
