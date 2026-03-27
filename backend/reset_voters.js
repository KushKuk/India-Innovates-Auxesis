const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting full database reset for demo...');

  try {
    // 1. Clear Tokens (active sessions)
    const tokenDelete = await prisma.token.deleteMany({});
    console.log(`✅ Deleted ${tokenDelete.count} active tokens.`);

    // 2. Clear Audit Logs (recent activity)
    const auditDelete = await prisma.auditLog.deleteMany({});
    console.log(`✅ Deleted ${auditDelete.count} audit log entries.`);

    // 3. Reset Voters (voting status)
    const voterUpdate = await prisma.voter.updateMany({
      data: {
        hasVoted: false,
        votingStatus: 'PENDING'
      }
    });
    console.log(`✅ Reset ${voterUpdate.count} voters to 'PENDING/Not Voted'.`);

    console.log('\n✨ Database is now fresh and ready for the demo!');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
