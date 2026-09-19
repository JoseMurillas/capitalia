import "dotenv/config";

import { prisma } from "@/lib/prisma";

import { upsertAdmin } from "./admin";

/**
 * `npm run db:admin` — creates the administrator on an empty database.
 * Tables, categories and statuses already exist after `prisma migrate deploy`;
 * nothing else is inserted.
 */
upsertAdmin()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
