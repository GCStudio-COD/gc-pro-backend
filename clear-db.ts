import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 

async function main() { 
  await prisma.notification.deleteMany({}); 
  await prisma.timeLog.deleteMany({}); 
  await prisma.attendanceLog.deleteMany({}); 
  await prisma.leaveRequest.deleteMany({}); 
  await prisma.note.deleteMany({}); 
  await prisma.task.deleteMany({}); 
  await prisma.project.deleteMany({}); 
  await prisma.meeting.deleteMany({}); 
  await prisma.employee.updateMany({ data: { departmentId: null } }); 
  await prisma.department.deleteMany({}); 
  await prisma.employee.deleteMany({ where: { email: { not: 'admin@example.com' } } }); 
  console.log('Database cleared! Only Super Admin remains.'); 
} 

main().catch(console.error).finally(() => prisma.$disconnect());
