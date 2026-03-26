/**
 * API Service to communicate with the NestJS backend
 */

const API_BASE_URL = '/api';

export interface ApiVoter {
  id: string;
  name: string;
  dob: string;
  age: number;
  address?: string;
  photoUrl?: string;
  hasVoted: boolean;
}

/**
 * Search voters from the backend
 */
export async function searchVotersFromBackend(
  name: string,
  dobOrAge: string,
  useAge: boolean = false
): Promise<ApiVoter[]> {
  try {
    const params = new URLSearchParams({
      name,
      dobOrAge,
      useAge: String(useAge),
    });

    const url = `${API_BASE_URL}/voters/search?${params}`;
    console.log('🔍 Searching voters at:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API error response:', errorText);
      throw new Error(`API error: ${response.statusText} - ${errorText}`);
    }

    const voters = await response.json();
    console.log('✅ Found voters (raw):', voters);
    
    // Ensure all voters have required fields with fallbacks
    const processedVoters = voters.map((voter: any) => ({
      ...voter,
      photoUrl: voter.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${voter.id}`,
    }));
    
    console.log('✅ Found voters (processed):', processedVoters);
    return processedVoters;
  } catch (error) {
    console.error('❌ Error searching voters:', error);
    throw error;
  }
}

/**
 * Get voter by ID
 */
export async function getVoterById(id: string): Promise<ApiVoter> {
  try {
    const response = await fetch(`${API_BASE_URL}/voters/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const voter = await response.json();
    return voter;
  } catch (error) {
    console.error('Error fetching voter:', error);
    throw error;
  }
}

/**
 * Mark voter as voted
 */
export async function markVoterAsVotedInBackend(id: string): Promise<ApiVoter> {
  try {
    const response = await fetch(`${API_BASE_URL}/voters/${id}/voted`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const voter = await response.json();
    return voter;
  } catch (error) {
    console.error('Error marking voter as voted:', error);
    throw error;
  }
}

/**
 * Get all voters
 */
export async function getAllVoters(): Promise<ApiVoter[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/voters`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const voters = await response.json();
    return voters;
  } catch (error) {
    console.error('Error fetching all voters:', error);
    throw error;
  }
}

/**
 * Get voter voting status - check if already voted
 */
export async function getVoterVotingStatus(voterId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/voters/${voterId}/voting-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching voting status:', error);
    throw error;
  }
}

// ==================== TOKEN VERIFICATION WORKFLOW ====================

export interface TokenStatus {
  status: 'TOKEN_ACTIVE' | 'IN_PROGRESS' | 'VOTED' | 'EXPIRED' | 'NOT_FOUND';
  remainingTime: number | null;
  voter?: ApiVoter;
}

/**
 * TVO verifies token - marks it as IN_PROGRESS with 3-minute timeout
 */
export async function verifyToken(tokenId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to verify token: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error verifying token:', error);
    throw error;
  }
}

/**
 * TVO approves voting - marks token and voter as VOTED
 */
export async function approveVoting(tokenId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/approve-voting`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to approve voting: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error approving voting:', error);
    throw error;
  }
}

/**
 * Get token status and remaining time (in seconds)
 */
export async function getTokenStatus(tokenId: string): Promise<TokenStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching token status:', error);
    throw error;
  }
}
/**
 * Run facial matching verification
 */
export async function faceMatch(voterId: string, liveImage: string) {
  try {
    const url = `${API_BASE_URL}/verification/face-match`;
    console.log(`📸 Initiating faceMatch for voter: ${voterId}`);
    console.log(`🌐 POST URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voterId, liveImage }),
    });

    console.log('📡 Face match response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Face match error:', errorText);
      throw new Error(`Facial matching failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Face match result:', data);
    return data;
  } catch (error) {
    console.error('Error in faceMatch:', error);
    throw error;
  }
}
