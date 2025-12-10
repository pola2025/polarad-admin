const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workflows = await prisma.workflow.findMany({
    where: {
      user: {
        clientName: '폴라세일즈'
      }
    },
    select: {
      id: true,
      type: true,
      status: true,
    }
  });
  console.log(JSON.stringify(workflows, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
