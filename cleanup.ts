import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting cleanup...');

  // 1. Delete all time logs and tasks
  await prisma.timeLog.deleteMany();
  console.log('Deleted all TimeLogs');
  await prisma.task.deleteMany();
  console.log('Deleted all Tasks');

  // 2. Delete all notes and projects
  await prisma.note.deleteMany();
  console.log('Deleted all Notes');
  await prisma.project.deleteMany();
  console.log('Deleted all Projects');

  // 3. Find users to delete
  const usersToDelete = await prisma.employee.findMany({
    where: {
      OR: [
        { email: 'admin@example.com' },
        { firstName: 'Jane', lastName: 'Smith' },
        { email: { contains: 'jane' } }
      ]
    }
  });

  console.log(`Found ${usersToDelete.length} users to delete.`);

  for (const user of usersToDelete) {
    console.log(`Deleting user: ${user.email} (${user.firstName} ${user.lastName})`);

    // Remove relations
    await prisma.leaveRequest.deleteMany({ where: { employeeId: user.id } });
    await prisma.attendanceLog.deleteMany({ where: { employeeId: user.id } });
    await prisma.notification.deleteMany({ where: { employeeId: user.id } });
    await prisma.notification.deleteMany({ where: { creatorId: user.id } });
    await prisma.note.deleteMany({ where: { creatorId: user.id } });
    
    // Remove from meetings
    const meetingsAsOrganizer = await prisma.meeting.findMany({ where: { organizerId: user.id } });
    for (const m of meetingsAsOrganizer) {
      await prisma.meeting.delete({ where: { id: m.id } });
    }

    // Unset department head if applicable
    await prisma.department.updateMany({
      where: { headId: user.id },
      data: { headId: null }
    });

    // Finally delete the user
    await prisma.employee.delete({
      where: { id: user.id }
    });
    console.log(`Deleted user: ${user.email}`);
  }

  console.log('Cleanup complete.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
