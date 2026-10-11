# Claude Pets leaderboard service

The shared leaderboard behind `/pet join` and `/pet board world` (backlog epic E4): a Cloudflare Worker over one D1 (SQLite) table. It has no dependencies, and its only secret is in Cloudflare's hands.

| Endpoint | | |
|---|---|---|
| `POST /v1/join` | `{ githubToken }` → `{ login, apiKey }` | Checks the token with GitHub once, then discards it |
| `PUT /v1/score` | `{ xp, level, favPet, streak, bestStreak }` | Signed-in; at most once a minute; impossible scores refused |
| `GET /v1/board?limit=20` | → `{ top, me }` | Public; `me` only when signed in |
| `DELETE /v1/me` | | Removes the caller's row and visits entirely |
| `PUT /v1/me` | `{ visitsOff }` | Signed-in; turns visits off or on |
| `GET /v1/pet/:login` | → `{ login, level, favPet, wearing, isFirstToday }` | Signed-in; a visit, counted once a day per pair |
| `GET /card/:login.svg` | a badge | Public; cached 5 minutes; 404 for players not on the board |

Signed-in calls send `Authorization: Bearer <apiKey>`. Only a SHA-256 hash of the key is stored.

## What it keeps
GitHub id and login, level, XP, favourite pet, streak and best streak, what the pet wears and the theme's two colours (for the badge), whether visits are on, who visited whom on which day, and when they joined and last scored. Nothing about projects, prompts, code or machines.

## Deploy (about 10 minutes)

You need a Cloudflare account (the free plan is plenty) and Node 22.18 or later.

1. **Sign in to Cloudflare from this folder:**
   ```sh
   cd server
   npx wrangler login
   ```
2. **Create the database**, then paste the `database_id` it prints into `wrangler.toml`:
   ```sh
   npm run db:create
   ```
3. **Create the tables:**
   ```sh
   npm run db:migrate
   ```
   A board created before 1.5.0 needs its upgrade once instead: `npm run db:migrate:e7`.
4. **Deploy**, and note the URL it prints (`https://claude-pets-board.<you>.workers.dev`):
   ```sh
   npm run deploy
   ```
5. **Create the GitHub OAuth app** that players sign in through: GitHub → Settings → Developer settings → OAuth Apps → *New OAuth App*.
   - Name: `Claude Pets`; homepage: the repo URL; callback URL: the repo URL (the device flow doesn't use it).
   - Tick **Enable Device Flow**, register it, and copy the **Client ID**. No client secret is needed: the device flow doesn't use one, and the Client ID is public by design.
6. **Point the plugin at it.** For everyone who installs it, set these two defaults in `plugins/pixel-pets/.claude-plugin/plugin.json`; for just yourself, set them in `/config`:
   - `leaderboardUrl`: the Worker URL from step 4
   - `githubClientId`: the Client ID from step 5
7. **Check it:**
   ```sh
   curl https://claude-pets-board.<you>.workers.dev/v1/board
   ```
   `{"top":[],"me":null}` means it's live. Then run `/pet join` in Claude Code.

## Test
```sh
npm test
```
The tests run the Worker with Node's built-in SQLite standing in for D1 (the same SQL), and a fake GitHub.

## Anti-cheat, honestly
Scores are computed on players' machines, so they can be forged. The Worker only refuses the impossible: a level that doesn't match the XP, XP that drops, XP rising faster than 600 an hour (with a first score of up to 100,000 allowed, to carry earlier progress), a streak growing faster than the days that passed, and unknown pets. It's a friendly board, not a tournament.
