import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

const BCRYPT_ROUNDS = 12;

/**
 * Creates the administrator, or updates their name and password if the email
 * already exists. Reads SEED_ADMIN_* from the environment; never touches
 * business data, so it is safe to run against production.
 */
export async function upsertAdmin() {
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@capitalia.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123*";
  const passwordHash = await hash(password, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { name, email, passwordHash },
  });
  console.log(`Admin listo: ${email}`);
}
