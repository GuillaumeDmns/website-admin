// Where the API is and which Google client signs in. Overridden by VITE_API_URL / VITE_GOOGLE_CLIENT_ID (.env.local).

/** The backend (website-back): the local one in development, production's once built */
export const apiUrl: string =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8080" : "https://guillaumedamiens.com");

/** OAuth web client of the apps (website-app's AppConfig.googleWebClientId): public, accepted by the backend */
export const googleClientId: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "98249637445-ok2b6a7v9eckahd9mdcmbqqcthfo2rjp.apps.googleusercontent.com";

/** Data reloaded this often while the page is shown and auto refresh is on */
export const refreshInterval = 60_000;
