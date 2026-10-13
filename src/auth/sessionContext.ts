// The session as the pages see it (SessionProvider in session.tsx keeps it)

import { createContext, use } from "react";

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut"; reason?: "forbidden" | "expired" | "error"; message?: string }
  | { status: "admin"; subject: string };

export interface Session {
  state: SessionState;
  signIn(idToken: string): Promise<void>;
  signOut(): Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) {
    throw new Error("useSession outside SessionProvider");
  }
  return session;
}
