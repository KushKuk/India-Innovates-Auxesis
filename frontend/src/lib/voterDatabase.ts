import { Voter } from '@/types/verification';

// Mock voter database - simulating electoral roll
export const MOCK_VOTERS: Voter[] = [
  {
    id: 'VOT001',
    name: 'Rajesh Kumar Singh',
    dob: '1985-05-15',
    age: 39,
    address: '123 Gandhi Nagar, New Delhi',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rajesh',
    hasVoted: false,
  },
  {
    id: 'VOT002',
    name: 'Priya Sharma',
    dob: '1990-03-22',
    age: 34,
    address: '456 Ashoka Road, Mumbai',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
    hasVoted: false,
  },
  {
    id: 'VOT003',
    name: 'Amit Patel',
    dob: '1988-07-10',
    age: 36,
    address: '789 Raj Path, Bangalore',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit',
    hasVoted: true, // Already voted
  },
  {
    id: 'VOT004',
    name: 'Sneha Gupta',
    dob: '1992-11-30',
    age: 32,
    address: '321 Indira Nagar, Pune',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sneha',
    hasVoted: false,
  },
  {
    id: 'VOT005',
    name: 'Rahul Singh',
    dob: '1987-09-18',
    age: 37,
    address: '654 Model Town, Delhi',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul',
    hasVoted: false,
  },
  {
    id: 'VOT006',
    name: 'Deepika Verma',
    dob: '1995-02-14',
    age: 31,
    address: '987 Connaught Place, Delhi',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=deepika',
    hasVoted: false,
  },
  {
    id: 'VOT007',
    name: 'Arjun Kumar',
    dob: '1984-08-05',
    age: 40,
    address: '111 Park Street, Kolkata',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=arjun',
    hasVoted: false,
  },
  {
    id: 'VOT008',
    name: 'Nirupama Pillai',
    dob: '1993-06-25',
    age: 33,
    address: '222 M.G. Road, Bangalore',
    photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nirupama',
    hasVoted: false,
  },
];

/**
 * Search for voters in the database by name and date of birth
 */
export function searchVoters(
  name: string,
  dobOrAge: string, // Can be YYYY-MM-DD or age as string
  isAge: boolean = false
): Voter[] {
  const searchName = name.toLowerCase().trim();

  return MOCK_VOTERS.filter((voter) => {
    // Name match (partial/fuzzy)
    const nameMatch = voter.name.toLowerCase().includes(searchName);

    if (!nameMatch) return false;

    // DOB/Age match
    if (isAge) {
      const searchAge = parseInt(dobOrAge, 10);
      const ageMatch = Math.abs(voter.age - searchAge) <= 1; // Allow ±1 year tolerance
      return ageMatch;
    } else {
      // DOB match
      const dobMatch = voter.dob === dobOrAge;
      return dobMatch;
    }
  });
}

/**
 * Get a voter by ID
 */
export function getVoterById(id: string): Voter | undefined {
  return MOCK_VOTERS.find((voter) => voter.id === id);
}

/**
 * Mark voter as having voted
 * (In a real system, this would update the backend)
 */
export function markVoterAsVoted(voterId: string): void {
  const voter = getVoterById(voterId);
  if (voter) {
    voter.hasVoted = true;
  }
}
