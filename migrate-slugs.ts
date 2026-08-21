import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const generateSlug = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-');      // Replace multiple - with single -
};

const getUniqueSpaceSlug = async (baseSlug: string) => {
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.space.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
};

const getUniqueBoardSlug = async (baseSlug: string) => {
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.board.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
};

async function main() {
  console.log('Migrating slugs for Spaces...');
  const spaces = await prisma.space.findMany();
  for (const space of spaces) {
    if (!space.slug || (space.slug.length === 36 && space.slug.includes('-'))) {
        // It's probably a UUID default.
        const baseSlug = generateSlug(space.name) || 'space';
        const slug = await getUniqueSpaceSlug(baseSlug);
        await prisma.space.update({
            where: { id: space.id },
            data: { slug }
        });
        console.log(`Updated Space: ${space.name} -> ${slug}`);
    }
  }

  console.log('Migrating slugs for Boards...');
  const boards = await prisma.board.findMany();
  for (const board of boards) {
    if (!board.slug || (board.slug.length === 36 && board.slug.includes('-'))) {
        // It's probably a UUID default.
        const baseSlug = generateSlug(board.name) || 'board';
        const slug = await getUniqueBoardSlug(baseSlug);
        await prisma.board.update({
            where: { id: board.id },
            data: { slug }
        });
        console.log(`Updated Board: ${board.name} -> ${slug}`);
    }
  }
  
  console.log('Migration complete!');
}

main()
  .catch(e => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
