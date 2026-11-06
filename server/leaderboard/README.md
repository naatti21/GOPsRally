# GOPs Rally — shared TOP 20 staging service

A small, independent Cloudflare Worker + D1 backend. No Codex required. **Not yet deployed** and not connected to the playable game. No changes to the existing game are required for this branch.

## What exists

- Public **GET** top-20 for one allowlisted development board (`rally-dev`, `forward`, `prototype`, `dev-1`). Sort fastest first, one record per authenticated pseudonymous installation. Public responses expose only anonymous `entry_id`, nickname, time, and date; never player credentials.
- Staging-only **POST** for player registration, run start, 3 ordered checkpoints and finish. Registration issues a random player ID and a long random bearer secret. Store the secret locally on the user's device (after frontend integration). Do not send it in public links.
- Names use NFC normalization, at most 10 Unicode grapheme clusters, allowing ÅÄÖ and other letters/digits/space/period/underscore/hyphen. Server rejects markup or controls.
- Staging-only test writes are gated by BOTH `STAGE=staging` and `ENABLE_TEST_WRITES=true`. No production Worker or D1 has been created.
- Timestamps and minimum plausible duration are validated by the server. **This is not cheat-proof**: a browser can forge checkpoints and fake laps by waiting long enough. Production score submissions stay disabled until a real driving/replay verification path is reviewed.
- Per-player 25 run starts per hour. This is **not** an adequate anti-Sybil/IP-level abuse limit; a real rollout needs edge-level abuse protection and an operator removal procedure. No IP addresses are stored.
- Independent DB migration and a Node SQLite test harness: no other application's Cloudflare DB or secrets are touched.

## API contract (staging)

All POST requests require `Content-Type: application/json`; `Origin` must be `https://naatti21.github.io` if supplied. Bodies max 2,048 bytes.

- `GET /api/v1/health` → `{ok,stage}`.
- `GET /api/v1/leaderboard?track_id=rally-dev&direction=forward&car_class=prototype&physics_version=dev-1` → `{board,entries:[{rank,entry_id,nickname,lap_ms,achieved_at}]}`. `achieved_at` is Unix milliseconds.
- `POST /api/v1/players` body `{}` → `{player_id,credential}`. Save token privately in local storage; it is **not** a public scoreboard identifier.
- `POST /api/v1/runs/start` body `{ "board": {"track_id":"rally-dev","direction":"forward","car_class":"prototype","physics_version":"dev-1"} }`; header `Authorization: Bearer <credential>` → `{run_id,run_secret,checkpoints,minimum_lap_ms}`.
- `POST /api/v1/runs/checkpoint` body `{run_id,run_secret,index:1}` then 2 then 3, same Bearer header. At least 3.5 seconds between checkpoints. Checkpoint sequence is enforced by atomic D1 update.
- `POST /api/v1/runs/finish` body `{run_id,run_secret,lap_ms:90000,nickname:"ÄÄKKÖNEN"}`, same auth → `{accepted,best:{entry_id,nickname,lap_ms},improved}`. Must match server elapsed time within ±8 seconds; current development board min 45 seconds, max 15 minutes. Once finished, a run cannot be reused. Run closure and best upsert use a D1 transaction (`batch`).

## Local tests

With Node.js 22.16 or newer (uses `node:sqlite`), from `server/leaderboard/`:

```sh
npm test
```

Tests run against real in-memory SQLite SQL with a minimal D1-compatible adapter, not a live Cloudflare Worker. A Wrangler/workerd integration test is still necessary before staging deployment.

## Staging setup: use the *existing* Cloudflare account

Cloudflare currently recommends `wrangler.jsonc` and separate D1 bindings (see [Workers config](https://developers.cloudflare.com/workers/wrangler/configuration/) and [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)). Do not invent or expose a database ID or copy another app's D1 ID.

1. Using the already-connected Cloudflare account, create a **new empty** D1 named `gops-rally-leaderboard-staging` (not a DB used by another app).
2. Copy `wrangler.example.jsonc` to `wrangler.jsonc` (gitignored). Replace only the placeholder `database_id` with the new database's ID. Keep Worker name `gops-rally-leaderboard-staging`.
3. Run `wrangler d1 migrations apply gops-rally-leaderboard-staging --local` for local validation. Test Worker with `wrangler dev` and no production credentials.
4. After review, apply migration to the **dedicated staging D1** with `--remote`, then deploy the Worker to staging. Use existing GitHub Actions/Cloudflare deployment credentials only after checking they are granted to this repo, and never echo secrets.
5. Replace the development board config with real approved track/physics values and add replay/anti-cheat validation before any public scoring. Later configure a separate production database and carefully approved deployment.

`wrangler.jsonc`, `.dev.vars`, and `.wrangler/` are excluded from commits. The service does not assume this repository has Cloudflare secrets (secrets in other repositories are not shared automatically).

## Scope and known limitations

This initial service is **staging only**. There is no full mobile UI yet, no actual lap validation from v0.4, no production deployment and no per-human unique identity guarantee. A player can create another identity or clear local data; eventual account recovery/transfer is optional. Gaming a published global table remains possible without authoritative replay/server physics, so production scoring remains intentionally out of scope.