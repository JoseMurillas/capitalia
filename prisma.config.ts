import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` never opens a connection, so a placeholder keeps builds
// working where no database is configured (CI, fresh clones). Commands that do
// connect (migrate, studio, seed) fail loudly against the placeholder.
const PLACEHOLDER_URL = "postgresql://capitalia:capitalia@localhost:5433/capitalia?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? PLACEHOLDER_URL,
  },
});
