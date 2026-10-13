import { useEffect, useRef, useState } from "react";

import { loadGoogleIdentity } from "../auth/google";
import { useSession, type SessionState } from "../auth/sessionContext";
import { googleClientId } from "../config";
import styles from "./SignIn.module.css";

const reasons: Record<string, string> = {
  forbidden: "Ce compte Google n'est pas administrateur.",
  expired: "La session a pris fin : reconnectez-vous.",
};

/** The only page without a session: Google's button, for admins only */
export default function SignIn({ state }: { state: Extract<SessionState, { status: "signedOut" }> }) {
  const { signIn } = useSession();
  const button = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let current = true;
    loadGoogleIdentity()
      .then((google) => {
        if (!current || !button.current) return;
        google.initialize({ client_id: googleClientId, callback: (response) => void signIn(response.credential), context: "signin" });
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        google.renderButton(button.current, {
          theme: dark ? "filled_black" : "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          locale: "fr",
        });
      })
      .catch(() => current && setUnavailable(true));
    return () => {
      current = false;
    };
  }, [signIn]);

  const message = state.reason === "error" ? state.message : state.reason ? reasons[state.reason] : undefined;
  return (
    <main className={styles.page}>
      <title>Connexion · Administration</title>
      <h1>Administration</h1>
      <p className={styles.lead}>
        Utilisation de l'application, du serveur et des sites, et actions d'exploitation. Réservé aux administrateurs.
      </p>
      {message && (
        <p className={styles.message} role="alert">
          {message}
        </p>
      )}
      <div ref={button} className={styles.button} />
      {unavailable && <p className={styles.message}>La connexion Google ne se charge pas (bloqueur de contenu ?).</p>}
    </main>
  );
}
