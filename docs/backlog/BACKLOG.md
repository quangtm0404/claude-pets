# Claude Pets — backlog

Stories live here as markdown, the format Claude Pets itself reads: run `/story E2-S01` inside this repo and the band tracks it. Statuses: ⬜ To do · 🟡 In progress · ✅ Done · 💡 Proposed.

## P1 · For everyone, not just developers - 🟡 In progress

### E1 · A band you choose - 🟡 In progress

**Outcome.** The band shows what this person cares about. Developer rows are optional, and nothing nags someone who has no backlog.

<details><summary><b>E1-S01</b> - as a <b>user</b>, I want <b>to choose which rows the band shows, and in what order</b> · 🟡 In progress · 3 pts</summary>

So that a non-developer sees weather and their pet, not branches and backlog ids.

**Acceptance criteria**
- A `bandRows` setting lists rows by name (banner, usage, weather, git, story, tests) in the order they are drawn
- Unknown names are ignored, and an empty setting means the default
- The default needs no project setup to look complete

| Task | Kind | Status |
|---|---|---|
| Rows drawn from the setting, in its order | technical | ✅ Done |
| Order, unknown names and the default asserted | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E1-S02</b> - as a <b>non-developer</b>, I want <b>no backlog prompts when I have no backlog</b> · 🟡 In progress · 2 pts</summary>

So that the band never asks me to set up something I don't use.

**Acceptance criteria**
- With no plan, no story and no ticket, the story row is not drawn at all
- A story or ticket that is tracked still shows as before
- `/story` still explains how to set a plan when asked

| Task | Kind | Status |
|---|---|---|
| Story row only when there is something to show | technical | ✅ Done |
| No-plan band asserted free of plan hints | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E1-S03</b> - as a <b>user with a small terminal</b>, I want <b>the least useful rows to go first</b> · 🟡 In progress · 2 pts</summary>

So that a short window keeps what matters.

**Acceptance criteria**
- The pet and READY. always come first
- Then rows drop in a fixed order: banner, git, tests, story, weather, usage
- The rows that stay keep the order the setting gives them

| Task | Kind | Status |
|---|---|---|
| Row budget by importance, drawing by the chosen order | technical | ✅ Done |
| Budgets of 4, 6 and 8 rows asserted | testing | 🟡 In progress (written, not yet run) |

</details>

### E2 · Weather where you are - 🟡 In progress

**Outcome.** The band shows the local weather, and the pet's little world shows it too.

<details><summary><b>E2-S01</b> - as a <b>user</b>, I want <b>to set my place once</b> · 🟡 In progress · 3 pts</summary>

So that the weather is mine, and nothing about where I am is sent anywhere until I choose it.

**Acceptance criteria**
- `/weather Hanoi` finds the place (Open-Meteo geocoding) and remembers it; `/weather off` forgets it
- `/weather here` uses an IP lookup, only when asked, and says so
- A `weatherPlace` setting does the same as `/weather <place>` at startup
- With no place set, no request is made

| Task | Kind | Status |
|---|---|---|
| Geocode, store, forget; opt-in IP lookup | technical | ✅ Done |
| No request without a place; place stored and cleared | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E2-S02</b> - as a <b>user</b>, I want <b>the current conditions and temperature in °C, °F or both</b> · 🟡 In progress · 3 pts</summary>

So that I can glance at the weather without leaving the terminal.

**Acceptance criteria**
- A weather row shows an icon, the temperature, the conditions, the wind and the place
- A `temperatureUnit` setting picks °C, °F or both; wind follows (km/h or mph)
- Conditions refresh every 15 minutes, and a failed fetch keeps the last reading

| Task | Kind | Status |
|---|---|---|
| Open-Meteo current conditions, WMO codes mapped | technical | ✅ Done |
| Units, mapping and a failed fetch asserted | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E2-S03</b> - as a <b>user</b>, I want <b>the sky in the pet's strip to match the weather</b> · 🟡 In progress · 5 pts</summary>

So that the pet lives in the same weather I do.

**Acceptance criteria**
- Sun by day and moon with stars by night when it is clear
- Drifting clouds, falling rain or snow, fog, and lightning in a storm
- Wind sets which way the clouds drift; the sky never draws over the pet

| Task | Kind | Status |
|---|---|---|
| Sky layer under the pet, animated by the tick | technical | ✅ Done |
| Each sky drawn without error | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E2-S04</b> - as a <b>user</b>, I want <b>my pet to react to the weather</b> · 🟡 In progress · 2 pts</summary>

So that the weather feels part of the game.

**Acceptance criteria**
- Rain or a storm: the pet shelters and says so
- Snow: it plays; a hot, clear day: it basks
- Strong wind pushes it along

| Task | Kind | Status |
|---|---|---|
| Weather moods in the idle behaviour | technical | ✅ Done |

</details>

## P2 · Playing together - 🟡 In progress

### E3 · Your profile and a leaderboard - 🟡 In progress

**Outcome.** Progress means something over time, and every pet you raise has its own record.

<details><summary><b>E3-S01</b> - as a <b>player</b>, I want <b>a profile that remembers me</b> · 🟡 In progress · 3 pts</summary>

So that my lifetime progress is kept, not just my current pet's XP.

**Acceptance criteria**
- A profile keeps a name (the `playerName` setting, else git's user.name, else the OS user) and the date it started
- It keeps lifetime totals: XP, coins, bugs squashed, helpers home, green test runs, turns
- Totals add up across several open sessions, never overwriting each other

| Task | Kind | Status |
|---|---|---|
| Profile store with additive updates | technical | ✅ Done |
| Totals and concurrent sessions asserted | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E3-S02</b> - as a <b>player</b>, I want <b>a leaderboard of every pet I have raised</b> · 🟡 In progress · 3 pts</summary>

So that switching animals keeps each one's record.

**Acceptance criteria**
- XP earned is also credited to the current animal
- `/pet board` ranks my pets by XP with their level, and shows my profile under it
- The current pet is marked

| Task | Kind | Status |
|---|---|---|
| XP by animal; /pet board | technical | ✅ Done |
| Ranking and the current-pet mark asserted | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E3-S03</b> - as a <b>player</b>, I want <b>daily streaks and achievements</b> · 🟡 In progress · 3 pts</summary>

So that coming back each day, and playing well, is rewarded.

**Acceptance criteria**
- A day with at least one finished turn extends the streak; a missed day resets it, and the best is kept
- Achievements unlock once, with a notice: first coin, bug squasher, pack leader, green streak, a week's streak, LV5, LV10, zoo keeper
- `/pet board` lists the streak and the achievements earned

| Task | Kind | Status |
|---|---|---|
| Streak by local date; achievement rules | technical | ✅ Done |
| Streak rollover and one-time unlocks asserted | testing | 🟡 In progress (written, not yet run) |

</details>

<details><summary><b>E3-S04</b> - as a <b>player</b>, I want <b>to compare scores with friends on a shared leaderboard</b> · 🟡 In progress · 8 pts</summary>

So that it is a game you can play together.

**Acceptance criteria**
- Strictly opt-in: nothing leaves the machine until the player turns it on, and it can be turned off and deleted
- A player is identified by a GitHub login they choose, never by email or machine
- The board shows name, level, XP, favourite pet and streak, and nothing about projects, prompts or code

**Design notes (not built).** This needs a server-side piece, and the choice is the project owner's:
1. *Gist and aggregator.* Each opted-in player's plugin writes a small public JSON gist; a scheduled GitHub Action in this repo collects the registered gists and publishes the board as a page. No server to run, but registration is a pull request and scores are self-reported.
2. *A small hosted API* (a serverless function and a key-value store) with GitHub sign-in. Live, and can check sessions, but it has to be hosted, paid for and kept secure.

Open questions: cheating (scores are computed on the player's machine), moderation of names, and whether a team or organisation board is wanted.

| Task | Kind | Status |
|---|---|---|
| Choose an approach | technical | ✅ Done |
| Build it (E4) | technical | 🟡 In progress |

**Decided 2026-10-11:** option 2, a hosted API on Cloudflare Workers with a D1 database. Built as E4 below.

</details>

### E4 · Shared leaderboard - 🟡 In progress

**Outcome.** Players who opt in see where they stand among everyone else, and nothing else about them leaves their machine.

**Architecture.** A Cloudflare Worker (`server/`) with one D1 table. A player signs in with GitHub's device flow, asking for no scopes. The Worker confirms the login once with GitHub, then issues its own API key; only a hash of that key is stored, and the GitHub token is discarded. Scores are self-reported, so the Worker checks they are possible. Nothing is sent until `/pet join`, and `/pet leave` deletes the row.

<details><summary><b>E4-S01</b> - as a <b>player</b>, I want <b>a board service that keeps only what the board shows</b> · ✅ Done · 5 pts</summary>

So that joining shares my name, level, XP, favourite pet and streak, and nothing more.

**Acceptance criteria**
- One table: GitHub id and login, a hash of the API key, XP, level, favourite pet, streak, best streak, and times
- `GET /v1/board` returns the top players by XP, with rank, and the caller's own rank when signed in
- `DELETE /v1/me` removes the caller's row entirely

| Task | Kind | Status |
|---|---|---|
| Worker, schema and endpoints | technical | ✅ Done |
| Endpoints against real SQL (node:sqlite) | testing | ✅ Done (8 tests) |

</details>

<details><summary><b>E4-S02</b> - as a <b>player</b>, I want <b>to join with my GitHub account, only when I choose to</b> · 🟡 In progress · 5 pts</summary>

So that my place on the board is mine, and nothing is shared before I say so.

**Acceptance criteria**
- `/pet join` starts GitHub's device flow (a code to enter at github.com/login/device), asking for no scopes
- The Worker checks the token with GitHub once, then returns its own API key; the GitHub token is never stored
- `/pet leave` deletes the row and forgets the key; with no leaderboard set up, both say so and send nothing

| Task | Kind | Status |
|---|---|---|
| Device flow in the plugin; `/v1/join` in the Worker | technical | ✅ Done |
| Join, bad token and leave asserted | testing | 🟡 In progress (Worker side passing; plugin side written, not yet run) |

</details>

<details><summary><b>E4-S03</b> - as a <b>player</b>, I want <b>my score sent for me, and impossible scores refused</b> · 🟡 In progress · 3 pts</summary>

So that the board stays current without effort, and stays fair enough.

**Acceptance criteria**
- After a turn, a joined player's score is sent, at most once a minute
- The Worker refuses a level that doesn't match the XP, XP that drops, XP rising faster than 600 an hour, a streak growing faster than the days that passed, and unknown pets
- A refused or failed send is not retried in a loop and never interrupts the session

| Task | Kind | Status |
|---|---|---|
| Sync after turns; plausibility checks and a per-key rate limit | technical | ✅ Done |
| Each refusal asserted | testing | 🟡 In progress (Worker side passing; plugin sync written, not yet run) |

</details>

<details><summary><b>E4-S04</b> - as a <b>player</b>, I want <b>to see the world board in the terminal</b> · 🟡 In progress · 2 pts</summary>

So that I can check my rank without leaving Claude Code.

**Acceptance criteria**
- `/pet board world` shows the top 20 and, if I'm not among them, my own rank under them
- My own row is marked

| Task | Kind | Status |
|---|---|---|
| Fetch and format the board | technical | ✅ Done (format checked; in-engine test written, not yet run) |

</details>

<details><summary><b>E4-S05</b> - as the <b>owner</b>, I want <b>to deploy the service in a few commands</b> · 🟡 In progress · 2 pts</summary>

So that the board can go live under my Cloudflare account.

**Acceptance criteria**
- `server/README.md` lists every step: the GitHub OAuth app, the D1 database, the migration, `wrangler deploy`, and the plugin settings
- Nothing in the repo is a secret: the OAuth app's client id is public by design for the device flow

| Task | Kind | Status |
|---|---|---|
| wrangler.toml, schema migration and the deploy guide | technical | ✅ Done |
| Deploy to the owner's account | deployment | ⬜ To do (owner) |

</details>
