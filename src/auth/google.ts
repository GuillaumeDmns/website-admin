// Google Identity Services ("Sign in with Google"): its script, loaded on the sign-in page only, gives an ID token
// that the backend checks (POST /api/auth/google).

interface CredentialResponse {
  credential: string;
}

interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    use_fedcm_for_prompt?: boolean;
    context?: "signin" | "signup" | "use";
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large";
      text?: "signin_with";
      shape?: "rectangular";
      locale?: string;
    },
  ): void;
  prompt(): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

const SCRIPT = "https://accounts.google.com/gsi/client";

let loading: Promise<GoogleIdentity> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (!loading) {
    loading = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      script.onload = () =>
        window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in unavailable"));
      script.onerror = () => reject(new Error("Google sign-in unavailable"));
      document.head.append(script);
    }).catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/** After signing out: no automatic sign-in with the same account on the next visit */
export function forgetGoogleAccount() {
  window.google?.accounts?.id?.disableAutoSelect();
}
