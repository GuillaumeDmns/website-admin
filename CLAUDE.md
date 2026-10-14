# CLAUDE.md

Administration of the mobility app (admin.guillaumedamiens.com): usage statistics of the app, its backend and the sites, and operating actions (GTFS import, traffic reload…). For admins only (Google sign-in, `ROLE_ADMIN`). In French. React 19 + TypeScript + Vite + React Router, same design as website-react; every number comes from website-back's admin endpoints (`/api/admin/**`, `/api/gtfs/imports`, `/api/v2/traffic`): this site keeps no data.

## Commands

```bash
npm run dev      # localhost:4000, against the local backend (localhost:8080)
npm run lint
npm test         # Vitest (jsdom)
npm run format   # Prettier (printWidth 140)
npm run build    # tsc -b then vite build
```

`VITE_API_URL` / `VITE_GOOGLE_CLIENT_ID` (`.env.local`, not committed) override the backend (production's `https://guillaumedamiens.com` once built) and the Google OAuth client (the apps' web client, `src/config.ts`). Google only signs in from the origins of that client: `http://localhost:4000` and `https://admin.guillaumedamiens.com` must be among its authorized JavaScript origins (Google Cloud console); the backend's CORS allows `localhost` in development and `admin.guillaumedamiens.com` in production.

## Structure (`src/`)

- `api/client.ts`: the session like the apps': `POST /api/auth/google` with Google's ID token, a 1 h access JWT kept in memory, the rotating refresh token in `localStorage` (`admin.refreshToken`, the only thing stored), renewed once on a 401 (`/api/token/refresh`), `/api/logout` on sign-out. `api/types.ts`: the backend's answers.
- `auth/`: `google.ts` (Google Identity Services script, loaded on the sign-in page only), `session.tsx` (`SessionProvider`: restored at load, a non-admin account is signed out at once), `sessionContext.ts` (`useSession`).
- `App.tsx`: sign-in page or the router (`routes.tsx`: `Layout` + pages). `data.ts`: `useApi(path)` (data kept on screen while reloading or after a failure), `useRefresh`, `usePeriod` (days in the URL, `?days=90`); `refresh.tsx`: everything reloaded each minute while the page is visible (toggle kept in `localStorage`).
- `pages/`: `Overview` (alerts, key figures, quotas of the day), `AudiencePage` (`/audience`: accounts and guest devices active per day, platforms and app versions of the day, visitors and page views of the sites, top pages, referring sites; from `/api/admin/stats/audience`: distinct counts per day and metric, a day's rows added up), `Usage` ("Quotas PRIM": PRIM calls per day and feature, per API, guests), `ApiPage` (`/api`: requests per hour (2 days) or day by status, per kind of caller, per route with errors, 429 and times; `/api/admin/stats/usage`), `AccountsPage` (accounts, sign-ups, activity, favorites), `NetworkPage` (GTFS, imports, traffic, database), `SystemPage` (JVM, machine, PRIM circuit breakers, sites and certificates), `Actions` (backend actions after a confirmation, local journal), `SignIn`, `NotFound`.
- `components/`: `ui.tsx` (sections, key figures, meters, badges, `Load` for loading/error states), `charts.tsx` (bar and line charts in HTML/SVG without library, each with its data table and a CSV export; `chartMath.ts`), `Period`, `Layout`.
- `stats.ts`: series per day, labels, tones and the overview's alerts (thresholds: quotas 75/90 %, certificates 21/7 days, 6 GB free for the GTFS import); `format.ts`: French numbers, sizes, durations, Paris days.
- `styles/global.css`: website-react's tokens plus status colors and chart series. CSS Modules elsewhere.

Statistics are anonymous: the backend only sends counts (never an account's email, name or a position); don't add a page that lists accounts.

## Tests

`src/**/*.test.ts(x)`, Vitest + Testing Library on jsdom: logic (`stats`, `format`, charts, the client's session handling) and the whole app on a fake backend (`test/fakeBackend.ts`, `test/fixtures.ts` shaped like website-back's answers): sign-in gate, pages, actions, sign-out. A change comes with its tests; CI (`.github/workflows/build.yml`, check "Build", required to merge into master) runs lint, tests and the build.

## Deployment

Tag `vX.Y.Z` on master (the release: refused otherwise, `VITE_APP_VERSION`, shown at the bottom of the pages with `config.ts`'s `appVersion`, "dev" otherwise; the backend's own release is on the system page) → `.github/workflows/deploy.yml` (like website-react's): build, archive in the tag's GitHub release, downloaded by the VPS (`deploy` user) into `/var/www/guillaumedamiens-admin/releases/<name>`, `current` switched, 5 releases kept, pages checked over HTTPS. nginx site `admin.guillaumedamiens.com` in website-back's `deploy/nginx/` (Content-Security-Policy: this origin, the API and Google's sign-in only; `noindex`).

## Design

As website-react: paper background, serif headings, system sans text, one accent color, thin rules between sections; no gradients, shadows or animations, no web font. Status colors (`--ok`, `--warn`, `--bad`) only for states. Every chart has a text summary (`aria-label`) and its numbers in a table; interactive elements are buttons or links with visible focus; layouts hold at phone width without horizontal scrolling.
