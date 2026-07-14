import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_EMAIL = 'admin@example.com';
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'ChangeMe123!';

async function main() {
  const email = process.env.ADMIN_EMAIL ?? DEFAULT_EMAIL;
  const username = process.env.ADMIN_USERNAME ?? DEFAULT_USERNAME;
  const password = process.env.ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (password === DEFAULT_PASSWORD && nodeEnv === 'production') {
    console.warn(
      '[seed] ADMIN_PASSWORD is still the default. Set ADMIN_PASSWORD before seeding production.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username,
      password: passwordHash,
      roles: { create: { role: Role.SUPER_ADMIN } },
    },
  });

  const hasAdminRole = await prisma.userRole.findFirst({
    where: { userId: user.id, role: Role.SUPER_ADMIN },
  });

  if (!hasAdminRole) {
    await prisma.userRole.create({
      data: { userId: user.id, role: Role.SUPER_ADMIN },
    });
  }

  console.log(`[seed] SUPER_ADMIN ready: ${email}`);

  // Two example items — one published, one draft — so the public list and the
  // admin list visibly differ on a fresh database. Delete these along with the
  // items feature when you start a real one.
  await prisma.item.upsert({
    where: { slug: 'hello-world' },
    update: {},
    create: {
      title: 'Hello World',
      slug: 'hello-world',
      description: 'A published example item. It shows up on the public site.',
      published: true,
    },
  });

  await prisma.item.upsert({
    where: { slug: 'work-in-progress' },
    update: {},
    create: {
      title: 'Work In Progress',
      slug: 'work-in-progress',
      description:
        'A draft. Visible in the admin console, hidden from the public site.',
      published: false,
    },
  });

  console.log('[seed] 2 example items ready (1 published, 1 draft)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
    void pool.end();
  });
