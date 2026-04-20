const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetVoters() {
  console.log('🔄 Starting reset of all voters...');
  
  try {
    // Reset all voters to PENDING status and hasVoted to false
    const result = await prisma.voter.updateMany({
      data: {
        hasVoted: false,
        votingStatus: 'PENDING'
      }
    });

    // Also delete all active tokens to clear the terminal states
    const tokenResult = await prisma.token.deleteMany({});

    console.log(`✅ Success! Reset ${result.count} voters.`);
    console.log(`✅ Cleared ${tokenResult.count} previous voting tokens.`);
    console.log('\nYou can now test the verification flow from scratch.');
  } catch (error) {
    console.error('❌ Error resetting voters:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetVoters();
