import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";

import App from "./App";
import { signOut } from "./api/client";
import { SessionProvider } from "./auth/session";
import { routes } from "./routes";
import { fakeBackend, type FakeBackend } from "./test/fakeBackend";
import * as fixtures from "./test/fixtures";

/** The answers of a working backend */
function standardBackend(): FakeBackend {
  const backend = fakeBackend();
  backend.on("POST", "/api/token/refresh", { body: { jwt: fixtures.adminJwt(), refreshToken: "refresh-next" } });
  backend.on("POST", "/api/logout", { status: 204 });
  backend.on("GET", "/api/admin/status", { body: fixtures.status() });
  backend.on("GET", "/api/admin/stats/accounts", { body: fixtures.accounts() });
  backend.on("GET", "/api/admin/stats/favorites", { body: fixtures.favorites() });
  backend.on("GET", "/api/admin/stats/quotas", { body: fixtures.quotas() });
  backend.on("GET", "/api/admin/stats/system", { body: fixtures.system() });
  backend.on("GET", "/api/admin/stats/sites", { body: fixtures.sites() });
  backend.on("GET", "/api/admin/stats/network", { body: fixtures.network() });
  backend.on("GET", "/api/v2/traffic", { body: fixtures.traffic() });
  backend.on("GET", "/api/gtfs/imports", { body: fixtures.imports() });
  backend.on("GET", "/api/admin/stats/audience", { body: fixtures.audience() });
  backend.on("GET", "/api/admin/stats/usage", { body: fixtures.apiUsage() });
  return backend;
}

function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <SessionProvider>
      <App router={router} />
    </SessionProvider>,
  );
  return router;
}

/** Google's script, already there: the button's callback is kept to sign in */
function fakeGoogle() {
  const google = { callback: undefined as undefined | ((response: { credential: string }) => void) };
  window.google = {
    accounts: {
      id: {
        initialize: (options) => {
          google.callback = options.callback;
        },
        renderButton: () => {},
        prompt: () => {},
        disableAutoSelect: () => {},
      },
    },
  };
  return google;
}

describe("App", () => {
  beforeEach(async () => {
    localStorage.clear();
    fakeBackend();
    await signOut();
  });

  afterEach(() => {
    delete window.google;
  });

  it("asks to sign in without a session", async () => {
    standardBackend();
    fakeGoogle();

    renderApp();

    expect(await screen.findByRole("heading", { name: "Administration" })).toBeTruthy();
    expect(screen.getByText(/Réservé aux administrateurs/)).toBeTruthy();
  });

  it("turns away a Google account that isn't an admin", async () => {
    const backend = standardBackend();
    backend.on("POST", "/api/auth/google", { body: { jwt: fixtures.userJwt(), refreshToken: "user-refresh" } });
    const google = fakeGoogle();
    renderApp();
    await screen.findByRole("heading", { name: "Administration" });

    await act(async () => google.callback?.({ credential: "google-id-token" }));

    expect(await screen.findByText("Ce compte Google n'est pas administrateur.")).toBeTruthy();
    expect(backend.requests.some((request) => request.method === "POST" && request.path === "/api/logout")).toBe(true);
    expect(localStorage.getItem("admin.refreshToken")).toBeNull();
  });

  it("signs an admin in with Google and shows the overview", async () => {
    const backend = standardBackend();
    backend.on("POST", "/api/auth/google", { body: { jwt: fixtures.adminJwt(), refreshToken: "admin-refresh" } });
    const google = fakeGoogle();
    renderApp();
    await screen.findByRole("heading", { name: "Administration" });

    await act(async () => google.callback?.({ credential: "google-id-token" }));

    expect(await screen.findByRole("heading", { name: "Vue d'ensemble" })).toBeTruthy();
    expect(localStorage.getItem("admin.refreshToken")).toBe("admin-refresh");
  });

  it("gives the key figures and what needs a look", async () => {
    standardBackend();
    localStorage.setItem("admin.refreshToken", "stored");

    renderApp();

    const alerts = await screen.findByRole("region", { name: "À surveiller" });
    expect(await within(alerts).findByText(/Calculateur \(Navitia\) ne répond plus/)).toBeTruthy();
    expect(within(alerts).getByText(/Véhicules \(estimated-timetable\) : 96/)).toBeTruthy();
    const kpis = screen.getByRole("region", { name: "Chiffres clés" });
    expect(await within(kpis).findByText("42")).toBeTruthy();
    // 4 accounts and 11 guest devices today; 23 + 5 visitors of the sites
    expect(await within(kpis).findByText("15")).toBeTruthy();
    expect(within(kpis).getByText("28")).toBeTruthy();
    expect(within(kpis).getByText("2 / 2")).toBeTruthy();
  });

  it("goes from page to page", async () => {
    standardBackend();
    localStorage.setItem("admin.refreshToken", "stored");
    renderApp();
    await screen.findByRole("heading", { name: "Vue d'ensemble" });

    fireEvent.click(screen.getByRole("link", { name: "Comptes" }));
    expect(await screen.findByText("Châtelet")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Réseau" }));
    expect(await screen.findByText("Trafic interrompu entre Nanterre et La Défense")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Système" }));
    expect(await screen.findByText("Coupé", { exact: false })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Quotas PRIM" }));
    expect(await screen.findByRole("heading", { name: "Appels par jour" })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Audience" }));
    expect(await screen.findByText("linkedin.com")).toBeTruthy();
    expect(screen.getByText("Visiteurs de guillaumedamiens.com")).toBeTruthy();
    expect(screen.getByText("Android")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "API" }));
    expect(await screen.findByText("GET /api/v2/stops/{stopAreaId}/departures")).toBeTruthy();
  });

  it("runs an action once confirmed", async () => {
    const backend = standardBackend();
    backend.on("POST", "/api/admin/actions/traffic", { body: { at: "2026-10-13T10:00:00Z", count: null } });
    localStorage.setItem("admin.refreshToken", "stored");
    renderApp("/actions");
    await screen.findByRole("heading", { name: "Actions" });

    fireEvent.click(screen.getByRole("button", { name: "Recharger l'info trafic" }));
    expect(backend.requests.some((request) => request.path === "/api/admin/actions/traffic")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    expect(await screen.findAllByText(/Info trafic relue à 12:00:00/)).toHaveLength(2);
    expect(backend.requests.filter((request) => request.path === "/api/admin/actions/traffic")).toHaveLength(1);
  });

  it("tells when a GTFS import already runs", async () => {
    const backend = standardBackend();
    backend.on("POST", "/api/gtfs", { status: 409 });
    localStorage.setItem("admin.refreshToken", "stored");
    renderApp("/actions");
    await screen.findByRole("heading", { name: "Actions" });

    fireEvent.click(screen.getByRole("button", { name: "Importer le GTFS" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    expect(await screen.findAllByText("Un import est déjà en cours.", { exact: false })).not.toHaveLength(0);
  });

  it("signs out", async () => {
    const backend = standardBackend();
    localStorage.setItem("admin.refreshToken", "stored");
    fakeGoogle();
    renderApp();
    await screen.findByRole("heading", { name: "Vue d'ensemble" });

    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));

    expect(await screen.findByRole("heading", { name: "Administration" })).toBeTruthy();
    expect(backend.requests.find((request) => request.path === "/api/logout")?.body).toEqual({ refreshToken: "refresh-next" });
  });
});
