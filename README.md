# website-admin

Administration of guillaumedamiens.com's mobility app: anonymous usage statistics (accounts, PRIM quotas and calls, favorites), state of the backend (GTFS, traffic, JVM, database, circuit breakers, sites and TLS certificates) and operating actions (GTFS import, traffic reload, search index…), for admins signed in with Google.

```bash
npm install
npm run dev   # http://localhost:4000, with website-back running on localhost:8080
```

Requires Node 22+. See `CLAUDE.md` for the structure, the Google origins to allow and the deployment.
