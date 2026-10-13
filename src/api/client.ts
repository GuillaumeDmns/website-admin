// Calls to the backend with the admin's session: a short-lived access JWT kept in memory, renewed with the rotating
// refresh token (the only thing stored, so that a reload keeps the session), the way the apps do.

import { apiUrl } from "../config";

const REFRESH_TOKEN_KEY = "admin.refreshToken";

/** Renewed this long before it expires */
const EXPIRY_MARGIN_MS = 30_000;

interface Tokens {
  jwt: string;
  refreshToken?: string;
  expiresIn?: number;
}

/** What the access JWT says about its holder */
export interface Claims {
  subject: string;
  roles: string[];
  expiresAt: number;
}

/** An answer other than 2xx: its status and the problem detail's code and text when given */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let access: { token: string; claims: Claims } | null = null;
let renewal: Promise<Claims | null> | null = null;
const sessionListeners = new Set<() => void>();

/** Told when the session can't be renewed any more (signed out elsewhere, refresh token expired or revoked) */
export function onSessionLost(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/** Reads the claims of a JWT (not checked here: the backend does) */
export function decodeClaims(jwt: string): Claims {
  const payload = jwt.split(".")[1];
  if (!payload) {
    throw new Error("Not a JWT");
  }
  const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  const roles = Array.isArray(json.auth) ? json.auth : typeof json.auth === "string" ? [json.auth] : [];
  return { subject: String(json.sub ?? ""), roles, expiresAt: Number(json.exp ?? 0) * 1000 };
}

export function isAdmin(claims: Claims): boolean {
  return claims.roles.includes("ROLE_ADMIN");
}

function storedRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function keep(tokens: Tokens): Claims {
  const claims = decodeClaims(tokens.jwt);
  access = { token: tokens.jwt, claims };
  try {
    if (tokens.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  } catch {
    // Private browsing: the session ends with the page
  }
  return claims;
}

function forget() {
  access = null;
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Nothing kept
  }
}

async function send(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(apiUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

async function read<T>(response: Response): Promise<T> {
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      json?.detail ?? json?.title ?? response.statusText ?? `HTTP ${response.status}`,
      json?.code ?? null,
    );
  }
  return json as T;
}

/** Exchanges a Google ID token for a session; the claims tell whether the account is an admin */
export async function signInWithGoogle(idToken: string): Promise<Claims> {
  const tokens = await read<Tokens>(await send("POST", "/api/auth/google", { idToken }, null));
  return keep(tokens);
}

/** Renews the access token with the stored refresh token (one renewal at a time); null without a session */
export function renew(): Promise<Claims | null> {
  if (!renewal) {
    renewal = (async () => {
      const refreshToken = storedRefreshToken();
      if (!refreshToken) {
        return null;
      }
      try {
        return keep(await read<Tokens>(await send("POST", "/api/token/refresh", { refreshToken }, null)));
      } catch (error) {
        // Refused: the session is over. Unreachable: kept for the next try
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          forget();
          return null;
        }
        throw error;
      }
    })().finally(() => {
      renewal = null;
    });
  }
  return renewal;
}

export async function signOut(): Promise<void> {
  const refreshToken = storedRefreshToken();
  forget();
  if (refreshToken) {
    try {
      await send("POST", "/api/logout", { refreshToken }, null);
    } catch {
      // Expires by itself
    }
  }
}

/** The access token kept, if any (a function: TypeScript would keep a narrowing of the variable across awaits) */
function currentAccessToken(): string | null {
  return access?.token ?? null;
}

async function accessToken(): Promise<string | null> {
  if (access && access.claims.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return access.token;
  }
  await renew();
  return currentAccessToken();
}

/** A call with the session, renewed once if the backend refuses the access token */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response = await send(method, path, body, await accessToken());
  if (response.status === 401) {
    access = null;
    if (await renew()) {
      response = await send(method, path, body, currentAccessToken());
    }
    if (response.status === 401) {
      forget();
      sessionListeners.forEach((listener) => listener());
    }
  }
  return read<T>(response);
}

export const get = <T>(path: string) => request<T>("GET", path);
export const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
