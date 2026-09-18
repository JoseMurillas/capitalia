import type { NextAuthConfig } from "next-auth";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Configuration shared by the proxy and the full Auth.js instance. It must stay
 * free of database imports so the proxy only decodes the JWT cookie.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      if (trigger === "update" && session?.user) {
        token.name = session.user.name ?? token.name;
        token.email = session.user.email ?? token.email;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") {
        session.user.id = token.id;
      }
      session.user.name = typeof token.name === "string" ? token.name : session.user.name;
      session.user.email = typeof token.email === "string" ? token.email : session.user.email;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
