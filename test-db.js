const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany();
  console.log(employees.map(e => ({ id: e.id, email: e.email, role: e.role })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
