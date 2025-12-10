const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Qnwkchqnwk2@', 10);

  const admin = await prisma.admin.update({
    where: { email: 'admin@polarad.co.kr' },
    data: { password: hashedPassword },
  });

  console.log('Password reset for:', admin.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
