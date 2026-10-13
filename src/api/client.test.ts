import { adminJwt, userJwt } from "../test/fixtures";
import { fakeBackend } from "../test/fakeBackend";
import { decodeClaims, get, isAdmin, onSessionLost, renew, signInWithGoogle, signOut } from "./client";

describe("client", () => {
  beforeEach(async () => {
    localStorage.clear();
    fakeBackend();
    await signOut();
  });

  it("reads the roles of the access token", () => {
    expect(isAdmin(decodeClaims(adminJwt()))).toBe(true);
    expect(isAdmin(decodeClaims(userJwt()))).toBe(false);
    expect(decodeClaims(adminJwt()).subject).toBe("google:123");
  });

  it("signs in with Google and keeps only the refresh token", async () => {
    const backend = fakeBackend();
    backend.on("POST", "/api/auth/google", { body: { jwt: adminJwt(), refreshToken: "refresh-1", expiresIn: 3600 } });
    backend.on("GET", "/api/admin/status", { body: { ok: true } });

    const claims = await signInWithGoogle("google-id-token");
    await get("/api/admin/status");

    expect(isAdmin(claims)).toBe(true);
    expect(backend.requests[0].body).toEqual({ idToken: "google-id-token" });
    expect(backend.requests[1].authorization).toMatch(/^Bearer /);
    expect(localStorage.getItem("admin.refreshToken")).toBe("refresh-1");
  });

  it("renews the session once when the backend refuses the access token", async () => {
    const backend = fakeBackend();
    backend.on("POST", "/api/auth/google", { body: { jwt: adminJwt(), refreshToken: "refresh-1" } });
    let calls = 0;
    backend.on("GET", "/api/admin/status", () => (++calls === 1 ? { status: 401 } : { body: { ok: true } }));
    backend.on("POST", "/api/token/refresh", (body) => ({
      body: { jwt: adminJwt(), refreshToken: `${(body as { refreshToken: string }).refreshToken}-next` },
    }));
    await signInWithGoogle("google-id-token");

    expect(await get("/api/admin/status")).toEqual({ ok: true });
    expect(localStorage.getItem("admin.refreshToken")).toBe("refresh-1-next");
  });

  it("ends the session when it can't be renewed", async () => {
    const backend = fakeBackend();
    localStorage.setItem("admin.refreshToken", "revoked");
    backend.on("POST", "/api/token/refresh", { status: 401, body: { detail: "Invalid refresh token" } });
    backend.on("GET", "/api/admin/status", { status: 401 });
    const lost = vi.fn();
    const stop = onSessionLost(lost);

    expect(await renew()).toBeNull();
    await expect(get("/api/admin/status")).rejects.toMatchObject({ status: 401 });

    expect(lost).toHaveBeenCalled();
    expect(localStorage.getItem("admin.refreshToken")).toBeNull();
    stop();
  });

  it("gives the problem detail of an error", async () => {
    const backend = fakeBackend();
    backend.on("POST", "/api/auth/google", { body: { jwt: adminJwt(), refreshToken: "refresh-1" } });
    backend.on("POST", "/api/gtfs", { status: 409, body: { title: "Conflict", detail: "Import running", code: "gtfs_running" } });
    await signInWithGoogle("google-id-token");

    await expect(get("/api/missing")).rejects.toMatchObject({ status: 404 });
    await expect((await import("./client")).post("/api/gtfs")).rejects.toMatchObject({
      status: 409,
      message: "Import running",
      code: "gtfs_running",
    });
  });
});
