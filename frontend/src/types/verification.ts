export type VerificationStage = 'aadhaar' | 'biometric' | 'voterId' | 'token';
export type StageStatus = 'pending' | 'active' | 'success' | 'failed';
export type VerificationMode = 'primary' | 'manual';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  status: 'info' | 'success' | 'error' | 'warning';
  details?: string;
}

export interface Voter {
  id: string;
  voterId: string;
  name: string;
  dob: string; // YYYY-MM-DD
  age: number;
  address: string;
  photoUrl: string;
  hasVoted: boolean;
  documents?: {
    documentNumber: string;
    documentType: {
      name: string;
    };
  }[];
}

export interface ManualVerificationState {
  currentStep: number;
  searchResults: Voter[];
  selectedVoter: Voter | null;
  photoMatched: boolean;
  idVerified: boolean;
  idType: string | null;
  detailsVerified: boolean;
  verificationReason: string | null;
  officerId: string;
  supervisorApproved: boolean;
  token: string | null;
  auditLog: AuditEntry[];
}

export interface VerificationState {
  mode: VerificationMode;
  currentStage: number;
  stages: {
    aadhaar: StageStatus;
    biometric: StageStatus;
    voterId: StageStatus;
  };
  voterId: string | null;
  token: string | null;
  auditLog: AuditEntry[];
  isOnline: boolean;
  scannedVoter?: {
    id: string;
    name: string;
    documentType: string;
    documentNumber: string;
  } | null;
}
