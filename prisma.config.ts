import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` never opens a connection, so a placeholder keeps builds
// working where no database is configured (CI, fresh clones). Commands that do
// connect (migrate, studio, seed) fail loudly against the placeholder.
const PLACEHOLDER_URL = "postgresql://capitalia:capitalia@localhost:5433/capitalia?schema=public";

// Serverless providers (Neon, Supabase, Prisma Postgres) hand out a pooled URL
// for the app and a direct one for migrations. Neon's Vercel integration names
// the direct one DATABASE_URL_UNPOOLED; DIRECT_URL is the generic convention.
const directUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? PLACEHOLDER_URL,
    ...(directUrl ? { directUrl } : {}),
  },
});
