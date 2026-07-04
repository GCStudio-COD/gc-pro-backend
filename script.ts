import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const projects = await p.project.findMany({ include: { tasks: true, employees: true } });
  for (const proj of projects) {
    const employeeIds = new Set(proj.employees.map(e => e.id));
    for (const task of proj.tasks) {
      if (task.assigneeId && !employeeIds.has(task.assigneeId)) {
        await p.project.update({
          where: { id: proj.id },
          data: { employees: { connect: { id: task.assigneeId } } }
        });
        employeeIds.add(task.assigneeId);
        console.log(`Added ${task.assigneeId} to project ${proj.id}`);
      }
    }
  }
}
main().catch(console.error).finally(() => p.$disconnect());
