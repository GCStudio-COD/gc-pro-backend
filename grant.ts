import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.employee.upsert({
    where: { email: 'wearegoalcreatives@gmail.com' },
    update: { role: 'SuperAdmin', passwordHash: 'dummy', status: 'Active' },
    create: {
      email: 'wearegoalcreatives@gmail.com',
      firstName: 'Goal',
      lastName: 'Creatives',
      passwordHash: 'dummy',
      role: 'SuperAdmin',
      status: 'Active'
    }
  });
  console.log('Successfully promoted wearegoalcreatives@gmail.com to SuperAdmin!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
