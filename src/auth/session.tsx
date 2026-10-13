// The admin's session for the whole page: restored from the stored refresh token, opened with Google, closed on sign
// out or when the backend refuses it. Only admins (ROLE_ADMIN) get past the sign-in page.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, isAdmin, onSessionLost, renew, signInWithGoogle, signOut as endSession } from "../api/client";
import { forgetGoogleAccount } from "./google";
import { SessionContext, type SessionState } from "./sessionContext";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let current = true;
    renew()
      .then((claims) => {
        if (!current) return;
        setState(claims && isAdmin(claims) ? { status: "admin", subject: claims.subject } : { status: "signedOut" });
      })
      .catch(() => current && setState({ status: "signedOut", reason: "error", message: "Le serveur ne répond pas." }));
    const stop = onSessionLost(() => setState({ status: "signedOut", reason: "expired" }));
    return () => {
      current = false;
      stop();
    };
  }, []);

  const signIn = useCallback(async (idToken: string) => {
    try {
      const claims = await signInWithGoogle(idToken);
      if (isAdmin(claims)) {
        setState({ status: "admin", subject: claims.subject });
      } else {
        await endSession();
        forgetGoogleAccount();
        setState({ status: "signedOut", reason: "forbidden" });
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Le serveur ne répond pas.";
      setState({ status: "signedOut", reason: "error", message });
    }
  }, []);

  const signOut = useCallback(async () => {
    await endSession();
    forgetGoogleAccount();
    setState({ status: "signedOut" });
  }, []);

  const session = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext value={session}>{children}</SessionContext>;
}
