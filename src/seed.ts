import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const employeeId = '11111111-1111-1111-1111-111111111111';
const project1Id = '22222222-2222-2222-2222-222222222221';
const project2Id = '22222222-2222-2222-2222-222222222222';

const mockTasks = [
  { id: '33333333-3333-3333-3333-333333333101', title: 'Frontend Development', projectId: project1Id },
  { id: '33333333-3333-3333-3333-333333333102', title: 'UI/UX Design', projectId: project1Id },
  { id: '33333333-3333-3333-3333-333333333103', title: 'Backend APIs', projectId: project1Id },
  { id: '33333333-3333-3333-3333-333333333201', title: 'API Integration', projectId: project2Id },
  { id: '33333333-3333-3333-3333-333333333202', title: 'Push Notifications', projectId: project2Id },
  { id: '33333333-3333-3333-3333-333333333203', title: 'App Store Deployment', projectId: project2Id },
];

async function main() {
  console.log('Seeding database...');

  // Create Employee
  await prisma.employee.upsert({
    where: { id: employeeId },
    update: {},
    create: {
      id: employeeId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      passwordHash: 'dummy', // Just for easy local login
      role: 'SuperAdmin', // John Doe is SuperAdmin
      status: 'Active'
    }
  });

  const adminId = '11111111-1111-1111-1111-111111111112';
  await prisma.employee.upsert({
    where: { id: adminId },
    update: {},
    create: {
      id: adminId,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'admin@example.com',
      passwordHash: 'dummy',
      role: 'admin', // Regular admin
      status: 'Active'
    }
  });

  const pmId = '11111111-1111-1111-1111-111111111113';
  await prisma.employee.upsert({
    where: { id: pmId },
    update: {},
    create: {
      id: pmId,
      firstName: 'Bob',
      lastName: 'Manager',
      email: 'pm@example.com',
      passwordHash: 'dummy',
      role: 'project-manager',
      status: 'Active'
    }
  });

  // Create Project 1
  await prisma.project.upsert({
    where: { id: project1Id },
    update: {},
    create: {
      id: project1Id,
      name: 'Website Redesign',
      description: 'Redesigning the corporate website.',
      startDate: new Date(),
      endDate: new Date(),
      status: 'In Progress'
    }
  });

  // Create Project 2
  await prisma.project.upsert({
    where: { id: project2Id },
    update: {},
    create: {
      id: project2Id,
      name: 'Mobile App',
      description: 'Developing the iOS and Android app.',
      startDate: new Date(),
      endDate: new Date(),
      status: 'In Progress'
    }
  });

  // Create Tasks
  for (const t of mockTasks) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        title: t.title,
        description: `Description for ${t.title}`,
        projectId: t.projectId,
        assigneeId: employeeId,
        dueDate: new Date(),
        status: 'To Do'
      }
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
