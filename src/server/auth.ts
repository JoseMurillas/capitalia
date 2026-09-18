import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

/**
 * Authoritative session check for queries and actions. The proxy only performs
 * an optimistic redirect; every server entry point must call this.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    redirect("/login");
  }
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
  };
}
