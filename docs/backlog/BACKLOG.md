# Claude Pets — backlog

Stories live here as markdown, the format Claude Pets itself reads: run `/story E2-S01` inside this repo and the band tracks it. Statuses: ⬜ To do · 🟡 In progress · ✅ Done · 💡 Proposed.

## P1 · For everyone, not just developers - ✅ Done

### E1 · A band you choose - ✅ Done

**Outcome.** The band shows what this person cares about. Developer rows are optional, and nothing nags someone who has no backlog.

<details><summary><b>E1-S01</b> - as a <b>user</b>, I want <b>to choose which rows the band shows, and in what order</b> · ✅ Done · 3 pts</summary>

So that a non-developer sees weather and their pet, not branches and backlog ids.

**Acceptance criteria**
- A `bandRows` setting lists rows by name (banner, usage, weather, git, story, tests) in the order they are drawn
- Unknown names are ignored, and an empty setting means the default
- The default needs no project setup to look complete

| Task | Kind | Status |
|---|---|---|
| Rows drawn from the setting, in its order | technical | ✅ Done |
| Order, unknown names and the default asserted | testing | ✅ Done |

</details>

<details><summary><b>E1-S02</b> - as a <b>non-developer</b>, I want <b>no backlog prompts when I have no backlog</b> · ✅ Done · 2 pts</summary>

So that the band never asks me to set up something I don't use.

**Acceptance criteria**
- With no plan, no story and no ticket, the story row is not drawn at all
- A story or ticket that is tracked still shows as before
- `/story` still explains how to set a plan when asked

| Task | Kind | Status |
|---|---|---|
| Story row only when there is something to show | technical | ✅ Done |
| No-plan band asserted free of plan hints | testing | ✅ Done |

</details>

<details><summary><b>E1-S03</b> - as a <b>user with a small terminal</b>, I want <b>the least useful rows to go first</b> · ✅ Done · 2 pts</summary>

So that a short window keeps what matters.

**Acceptance criteria**
- The pet and READY. always come first
- Then rows drop in a fixed order: banner, git, tests, story, weather, usage
- The rows that stay keep the order the setting gives them

| Task | Kind | Status |
|---|---|---|
| Row budget by importance, drawing by the chosen order | technical | ✅ Done |
| Budgets of 4, 6 and 8 rows asserted | testing | ✅ Done |

</details>

### E2 · Weather where you are - ✅ Done

**Outcome.** The band shows the local weather, and the pet's little world shows it too.

<details><summary><b>E2-S01</b> - as a <b>user</b>, I want <b>to set my place once</b> · ✅ Done · 3 pts</summary>

So that the weather is mine, and nothing about where I am is sent anywhere until I choose it.

**Acceptance criteria**
- `/weather Hanoi` finds the place (Open-Meteo geocoding) and remembers it; `/weather off` forgets it
- `/weather here` uses an IP lookup, only when asked, and says so
- A `weatherPlace` setting does the same as `/weather <place>` at startup
- With no place set, no request is made

| Task | Kind | Status |
|---|---|---|
| Geocode, store, forget; opt-in IP lookup | technical | ✅ Done |
| No request without a place; place stored and cleared | testing | ✅ Done |

</details>

<details><summary><b>E2-S02</b> - as a <b>user</b>, I want <b>the current conditions and temperature in °C, °F or both</b> · ✅ Done · 3 pts</summary>

So that I can glance at the weather without leaving the terminal.

**Acceptance criteria**
- A weather row shows an icon, the temperature, the conditions, the wind and the place
- A `temperatureUnit` setting picks °C, °F or both; wind follows (km/h or mph)
- Conditions refresh every 15 minutes, and a failed fetch keeps the last reading

| Task | Kind | Status |
|---|---|---|
| Open-Meteo current conditions, WMO codes mapped | technical | ✅ Done |
| Units, mapping and a failed fetch asserted | testing | ✅ Done |

</details>

<details><summary><b>E2-S03</b> - as a <b>user</b>, I want <b>the sky in the pet's strip to match the weather</b> · ✅ Done · 5 pts</summary>

So that the pet lives in the same weather I do.

**Acceptance criteria**
- Sun by day and moon with stars by night when it is clear
- Drifting clouds, falling rain or snow, fog, and lightning in a storm
- Wind sets which way the clouds drift; the sky never draws over the pet

| Task | Kind | Status |
|---|---|---|
| Sky layer under the pet, animated by the tick | technical | ✅ Done |
| Each sky drawn without error | testing | ✅ Done |

</details>

<details><summary><b>E2-S04</b> - as a <b>user</b>, I want <b>my pet to react to the weather</b> · ✅ Done · 2 pts</summary>

So that the weather feels part of the game.

**Acceptance criteria**
- Rain or a storm: the pet shelters and says so
- Snow: it plays; a hot, clear day: it basks
- Strong wind pushes it along

| Task | Kind | Status |
|---|---|---|
| Weather moods in the idle behaviour | technical | ✅ Done |

</details>

## P2 · Playing together - ✅ Done

### E3 · Your profile and a leaderboard - ✅ Done

**Outcome.** Progress means something over time, and every pet you raise has its own record.

<details><summary><b>E3-S01</b> - as a <b>player</b>, I want <b>a profile that remembers me</b> · ✅ Done · 3 pts</summary>

So that my lifetime progress is kept, not just my current pet's XP.

**Acceptance criteria**
- A profile keeps a name (the `playerName` setting, else git's user.name, else the OS user) and the date it started
- It keeps lifetime totals: XP, coins, bugs squashed, helpers home, green test runs, turns
- Totals add up across several open sessions, never overwriting each other

| Task | Kind | Status |
|---|---|---|
| Profile store with additive updates | technical | ✅ Done |
| Totals and concurrent sessions asserted | testing | ✅ Done |

</details>

<details><summary><b>E3-S02</b> - as a <b>player</b>, I want <b>a leaderboard of every pet I have raised</b> · ✅ Done · 3 pts</summary>

So that switching animals keeps each one's record.

**Acceptance criteria**
- XP earned is also credited to the current animal
- `/pet board` ranks my pets by XP with their level, and shows my profile under it
- The current pet is marked

| Task | Kind | Status |
|---|---|---|
| XP by animal; /pet board | technical | ✅ Done |
| Ranking and the current-pet mark asserted | testing | ✅ Done |

</details>

<details><summary><b>E3-S03</b> - as a <b>player</b>, I want <b>daily streaks and achievements</b> · ✅ Done · 3 pts</summary>

So that coming back each day, and playing well, is rewarded.

**Acceptance criteria**
- A day with at least one finished turn extends the streak; a missed day resets it, and the best is kept
- Achievements unlock once, with a notice: first coin, bug squasher, pack leader, green streak, a week's streak, LV5, LV10, zoo keeper
- `/pet board` lists the streak and the achievements earned

| Task | Kind | Status |
|---|---|---|
| Streak by local date; achievement rules | technical | ✅ Done |
| Streak rollover and one-time unlocks asserted | testing | ✅ Done |

</details>

<details><summary><b>E3-S04</b> - as a <b>player</b>, I want <b>to compare scores with friends on a shared leaderboard</b> · ✅ Done · 8 pts</summary>

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
| Build it (E4) | technical | ✅ Done |

**Decided 2026-10-11:** option 2, a hosted API on Cloudflare Workers with a D1 database. Built as E4 below.

</details>

### E4 · Shared leaderboard - ✅ Done

**Outcome.** Players who opt in see where they stand among everyone else, and nothing else about them leaves their machine.

**Live** at `https://claude-pets-board.claude-pets-leaderboard.workers.dev` since 2026-10-11.

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

<details><summary><b>E4-S02</b> - as a <b>player</b>, I want <b>to join with my GitHub account, only when I choose to</b> · ✅ Done · 5 pts</summary>

So that my place on the board is mine, and nothing is shared before I say so.

**Acceptance criteria**
- `/pet join` starts GitHub's device flow (a code to enter at github.com/login/device), asking for no scopes
- The Worker checks the token with GitHub once, then returns its own API key; the GitHub token is never stored
- `/pet leave` deletes the row and forgets the key; with no leaderboard set up, both say so and send nothing

| Task | Kind | Status |
|---|---|---|
| Device flow in the plugin; `/v1/join` in the Worker | technical | ✅ Done |
| Join, bad token and leave asserted | testing | ✅ Done (Worker and plugin) |

</details>

<details><summary><b>E4-S03</b> - as a <b>player</b>, I want <b>my score sent for me, and impossible scores refused</b> · ✅ Done · 3 pts</summary>

So that the board stays current without effort, and stays fair enough.

**Acceptance criteria**
- After a turn, a joined player's score is sent, at most once a minute
- The Worker refuses a level that doesn't match the XP, XP that drops, XP rising faster than 600 an hour, a streak growing faster than the days that passed, and unknown pets
- A refused or failed send is not retried in a loop and never interrupts the session

| Task | Kind | Status |
|---|---|---|
| Sync after turns; plausibility checks and a per-key rate limit | technical | ✅ Done |
| Each refusal asserted | testing | ✅ Done (Worker and plugin) |

</details>

<details><summary><b>E4-S04</b> - as a <b>player</b>, I want <b>to see the world board in the terminal</b> · ✅ Done · 2 pts</summary>

So that I can check my rank without leaving Claude Code.

**Acceptance criteria**
- `/pet board world` shows the top 20 and, if I'm not among them, my own rank under them
- My own row is marked

| Task | Kind | Status |
|---|---|---|
| Fetch and format the board | technical | ✅ Done |

</details>

<details><summary><b>E4-S05</b> - as the <b>owner</b>, I want <b>to deploy the service in a few commands</b> · ✅ Done · 2 pts</summary>

So that the board can go live under my Cloudflare account.

**Acceptance criteria**
- `server/README.md` lists every step: the GitHub OAuth app, the D1 database, the migration, `wrangler deploy`, and the plugin settings
- Nothing in the repo is a secret: the OAuth app's client id is public by design for the device flow

| Task | Kind | Status |
|---|---|---|
| wrangler.toml, schema migration and the deploy guide | technical | ✅ Done |
| Deploy to the owner's account | deployment | ✅ Done (live 2026-10-11) |

</details>

## P3 · Everywhere, in your colours - ✅ Done

### E5 · Pets everywhere - ✅ Done

**Outcome.** Claude Pets looks like itself in the terminal, the desktop app and VS Code, in colours and letters the person picks.

<details><summary><b>E5-S01</b> - as a <b>desktop app user</b>, I want <b>to see the pixel pet in the band, not an emoji line</b> · ✅ Done · 3 pts</summary>

So that the desktop app shows the same game as the terminal.

**Acceptance criteria**
- The band draws the pet, its sky, coins, bugs and helpers as SVG where there is no pixel grid
- The HUD (hearts, level, XP, coins, what the pet is doing) is drawn on its ground
- It animates by redrawing at most about twice a second, and only when the frame changed
- The terminal keeps its cell-drawn strip

| Task | Kind | Status |
|---|---|---|
| One frame drawn as pixels, then as cells or SVG | technical | ✅ Done |
| Desktop band and SVG size asserted | testing | ✅ Done |

</details>

<details><summary><b>E5-S02</b> - as a <b>VS Code user</b>, I want <b>to see my pet even though VS Code draws no band</b> · ✅ Done · 3 pts</summary>

So that the pet lives where I work.

**Acceptance criteria**
- A pet pane shows the pet, its HUD line, usage, weather and BALL, PAT and CLOSE buttons
- In VS Code it opens by itself when the pet is shown, and closes when the pet is hidden
- `/pet pane` opens it on any surface; in the terminal it points back at the band

| Task | Kind | Status |
|---|---|---|
| Pet pane, VS Code attach and /pet pane | technical | ✅ Done |
| Pane on vscode, desktop, mobile and terminal asserted | testing | ✅ Done |

</details>

<details><summary><b>E5-S03</b> - as a <b>user</b>, I want <b>to colour the band myself instead of picking one fixed theme</b> · ✅ Done · 3 pts</summary>

So that it fits my terminal and my taste.

**Acceptance criteria**
- Presets: ice, phosphor, amber, c64, mint, rose, mono and paper (for light backgrounds)
- `/retro theme #FF8800` takes an accent and mixes a background from it; `/retro theme #FF8800 on #101010` takes both
- The other colours are mixed from those two, so text stays readable on dark and light backgrounds
- A `theme` setting sets the starting theme; a bad colour shows the help instead

| Task | Kind | Status |
|---|---|---|
| Palette mixed from accent and background | technical | ✅ Done |
| Presets, own colours, the setting and bad input asserted | testing | ✅ Done |

</details>

<details><summary><b>E5-S04</b> - as a <b>user</b>, I want <b>to change the font</b> · ✅ Done · 2 pts</summary>

So that the banner looks the way I like.

**Acceptance criteria**
- `/retro font` offers plain, bold, mono, double, wide and pixel, and a `font` setting picks the start
- pixel draws big pixel letters in cells or SVG when the band has room, else the plain banner
- The help explains that the terminal's own font is the terminal's setting, and where to change it

| Task | Kind | Status |
|---|---|---|
| Unicode letter styles and a 3×5 pixel font | technical | ✅ Done |
| Each style and the pixel banner asserted | testing | ✅ Done |

</details>

## P4 · Play, share and seasons - 🟡 In progress

### E6 · Play - ✅ Done

**Outcome.** Waiting for Claude becomes the fun part, and coins buy something worth having.

<details><summary><b>E6-S01</b> - as a <b>player</b>, I want <b>a tiny game to play while Claude is thinking</b> · ✅ Done · 8 pts</summary>

So that a long turn is something to look forward to, not stare at.

**Acceptance criteria**
- During a long turn the band offers a runner game: the pet jumps over bugs, with the arrow keys or space
- It runs in the terminal and the desktop app (VS Code draws no band; its pet pane keeps the pet)
- Each bug cleared scores; a run's best score adds XP, at most 20 XP per turn so it can't be farmed
- The game never takes the keys from the prompt unless the person clicks it, and Esc hands them back
- When the turn ends the game closes, and the run in progress counts as it stands

| Task | Kind | Status |
|---|---|---|
| Runner game as a Client module with its own frame clock | technical | ✅ Done |
| Score to XP with a per-turn cap | technical | ✅ Done |
| Click to start, frames, jumps, the XP cap and turn end asserted | testing | ✅ Done |

</details>

<details><summary><b>E6-S02</b> - as a <b>player</b>, I want <b>to spend my coins on things for my pet to wear</b> · ✅ Done · 5 pts</summary>

So that collecting ◆ means something.

**Acceptance criteria**
- `/pet shop` lists items with prices: hats, scarves, sunglasses, a crown, a Tết lantern, and more
- `/pet buy <item>` spends coins; `/pet wear <item>` and `/pet wear none` change what it has on
- Items are drawn on the sprite in cells and in SVG, for every animal, facing either way
- Coins and owned items are saved across sessions; a coin balance is kept apart from lifetime coins

| Task | Kind | Status |
|---|---|---|
| Coin balance, shop catalogue and saves | technical | ✅ Done |
| Item overlays per animal in cells and SVG | technical | ✅ Done |
| Buying, too few coins, wearing and saving asserted | testing | ✅ Done |

</details>

<details><summary><b>E6-S03</b> - as a <b>player</b>, I want <b>my pet to grow up as it levels</b> · ✅ Done · 5 pts</summary>

So that a long-kept pet looks like one.

**Acceptance criteria**
- At LV10 the baby becomes an adult, and at LV25 and LV50 it gains a legend look (glow, then wings or a halo)
- Growing up shows a short animation and a toast, and is never undone by switching animals
- `/pet stats` shows the stage and the level of the next one

| Task | Kind | Status |
|---|---|---|
| Stage art for the roster | technical | ✅ Done |
| Stages per level and the switch rule asserted | testing | ✅ Done |

</details>

<details><summary><b>E6-S04</b> - as a <b>developer</b>, I want <b>my pet to react to what happens in my work</b> · ✅ Done · 3 pts</summary>

So that the pet feels part of the session.

**Acceptance criteria**
- A green test run makes it dance; a failing one makes it wince
- A successful `git push` sends it up on a little rocket
- A merge conflict puts a ? over its head until the conflict is resolved
- A command running over a minute sends it to sleep beside a progress dots bubble
- Each reaction is short and never covers the HUD

| Task | Kind | Status |
|---|---|---|
| Reactions from tool results | technical | ✅ Done |
| Each trigger asserted | testing | ✅ Done |

</details>

### E7 · Share - ✅ Done

**Outcome.** Your pet can be seen and visited by other people, if you want it to be.

<details><summary><b>E7-S01</b> - as a <b>player</b>, I want <b>a live badge of my pet for my GitHub profile</b> · ✅ Done · 5 pts</summary>

So that people can see my pet in my README.

**Acceptance criteria**
- The board service serves `/card/<login>.svg`: the pet, its level, streak and favourite animal, in the player's theme
- Only players who joined the board have a card, and `/pet leave` removes it
- It is cached for a few minutes, and `/pet card` prints the Markdown to paste into a README
- The SVG has no scripts and no external requests

| Task | Kind | Status |
|---|---|---|
| Card route on the Worker, with caching | technical | ✅ Done |
| `/pet card` command | technical | ✅ Done |
| Card content, a left player and the cache asserted | testing | ✅ Done |
| Redeploy the Worker | deployment | ✅ Done |

</details>

<details><summary><b>E7-S02</b> - as a <b>player</b>, I want <b>to visit a friend's pet</b> · ✅ Done · 5 pts</summary>

So that playing feels shared.

**Acceptance criteria**
- `/pet visit <github login>` brings that player's pet (animal, level, items) into my band for a minute
- The two pets greet each other, and both players get a small XP bonus once a day per pair
- Only players on the board can be visited, and a player can turn visits off

| Task | Kind | Status |
|---|---|---|
| Visit route on the Worker and the guest pet in the band | technical | ✅ Done |
| Visit, the daily bonus and visits-off asserted | testing | ✅ Done |

</details>

<details><summary><b>E7-S03</b> - as a <b>player</b>, I want <b>a diary card at the end of my day</b> · ✅ Done · 3 pts</summary>

So that I can look back on, and share, what my pet and I did.

**Acceptance criteria**
- `/pet diary` draws "Pixel's diary" for today: coins, bugs squashed, tests run, helpers sent, the story worked on, and the weather
- It comes as an SVG card that can be copied, and as plain text
- Nothing is sent anywhere unless the person shares it themselves

| Task | Kind | Status |
|---|---|---|
| Day totals and the diary card | technical | ✅ Done |
| Diary content for a sample day asserted | testing | ✅ Done |

</details>

### E8 · Life and seasons - 🟡 In progress

**Outcome.** The pet keeps you company through the day, the week and the year.

<details><summary><b>E8-S01</b> - as a <b>user</b>, I want <b>a Pomodoro focus timer my pet guards</b> · ✅ Done · 3 pts</summary>

So that I can work in focused blocks.

**Acceptance criteria**
- `/pet focus` starts Pomodoro rounds, 25 minutes of focus then a 5 minute break, until stopped; `/pet focus 45/5`, `50/10` or `45` (45/5) set other times, and every fourth break is three times as long
- The countdown is shown in the band; the pet sits on guard during focus and stretches on a break
- A soft chime and a toast mark each change, with XP for each finished round (10 for 25 minutes); `/pet focus stop` ends it early with no XP
- The timer survives a plugin reload

| Task | Kind | Status |
|---|---|---|
| Focus timer, band row and XP | technical | ✅ Done |
| Start, finish, stop and reload asserted | testing | ✅ Done |

</details>

<details><summary><b>E8-S02</b> - as a <b>user</b>, I want <b>gentle reminders to stretch and drink water</b> · ⬜ To do · 2 pts</summary>

So that long sessions don't wear me out.

**Acceptance criteria**
- After a set time of continuous work (default 60 minutes) the pet stretches and suggests a break, at most once an hour
- A `breaks` setting turns it off or changes the interval
- Reminders never interrupt a running turn

| Task | Kind | Status |
|---|---|---|
| Activity timer and the reminder | technical | ⬜ To do |
| Interval, once-an-hour and off asserted | testing | ⬜ To do |

</details>

<details><summary><b>E8-S03</b> - as a <b>user</b>, I want <b>seasons and local festivals in the band</b> · ⬜ To do · 5 pts</summary>

So that the band changes with the year.

**Acceptance criteria**
- Lanterns at Tết, mooncakes at Mid-Autumn, snow and a tree at Christmas, fireworks at New Year
- Lunar dates are worked out for the year, not hard-coded
- A `festivals` setting turns them off

| Task | Kind | Status |
|---|---|---|
| Festival calendar, lunar dates included | technical | ⬜ To do |
| Festival art in cells and SVG | technical | ⬜ To do |
| Dates for several years asserted | testing | ⬜ To do |

</details>

<details><summary><b>E8-S04</b> - as a <b>player</b>, I want <b>my pet to have a birthday</b> · ⬜ To do · 2 pts</summary>

So that the day I adopted it is celebrated.

**Acceptance criteria**
- The adoption date is the first day the pet was saved; existing saves use the earliest date they hold
- On the birthday the pet wears a party hat, the band says how old it is, and it earns a one-off XP gift

| Task | Kind | Status |
|---|---|---|
| Adoption date and the birthday look | technical | ⬜ To do |
| Birthday and the one-off gift asserted | testing | ⬜ To do |

</details>

<details><summary><b>E8-S05</b> - as a <b>user</b>, I want <b>my pet to say something now and then (opt-in)</b> · ⬜ To do · 3 pts</summary>

So that it has a personality.

**Acceptance criteria**
- Off by default; `/pet chatter on` turns it on
- At most once every 20 minutes, after a turn, the pet says a one-liner about what was happening, written by a small model
- It sees only the turn's short summary, never files or secrets, and costs a few hundred tokens at most
- Lines show in the HUD for a few seconds and are never added to the conversation

| Task | Kind | Status |
|---|---|---|
| Chatter with a small model, rate limit and opt-in | technical | ⬜ To do |
| Off by default, the rate limit and what is sent asserted | testing | ⬜ To do |

</details>

## P5 · Surprises and a new look - ✅ Done

### E9 · Blind boxes - ✅ Done

**Outcome.** Every milestone comes with a surprise worth opening.

<details><summary><b>E9-S01</b> - as a <b>player</b>, I want <b>a blind box for each level up, achievement and focus set</b> · ✅ Done · 5 pts</summary>

So that progress has a moment of surprise.

**Acceptance criteria**
- One box for each level gained, each achievement and every fourth focus round; three to start with
- `/pet box` shows how many and the odds; `/pet box open` opens one: the pet shakes it in the band, then the find pops out with a toast and a chime
- Rarities common 60%, rare 27%, epic 10%, legendary 3%; ten boxes without an epic make the next one epic; a find you have is worth coins instead

| Task | Kind | Status |
|---|---|---|
| Boxes in the wallet, the roll, the opening in the band | technical | ✅ Done |
| Odds, pity, earning and opening asserted | testing | ✅ Done |

</details>

<details><summary><b>E9-S02</b> - as a <b>player</b>, I want <b>finds I can't buy: items, skins and animals</b> · ✅ Done · 5 pts</summary>

So that boxes hold something the shop doesn't.

**Acceptance criteria**
- Box-only items (flower crown, headphones, bandana, hero cape, wizard hat, rainbow scarf, halo) can be worn but not bought
- Skins (pastel, shadow, ghost, golden, galaxy) recolour any animal: `/pet skin <name>|none`
- The dragon, unicorn and axolotl only hatch from a box; `/pet list` shows them locked until then
- `/pet collection` lists what was found; the badge shows the skin and items

| Task | Kind | Status |
|---|---|---|
| Items, skins, box animals, collection and the badge | technical | ✅ Done |
| Locked until found, then usable, asserted | testing | ✅ Done |

</details>

### E10 · A new look - ✅ Done

**Outcome.** The pets look drawn, not just blocky.

<details><summary><b>E10-S01</b> - as a <b>player</b>, I want <b>more detailed pets</b> · ✅ Done · 8 pts</summary>

So that my pet has a face and a shape I can love.

**Acceptance criteria**
- Every animal has a 12×8 grown-up sprite and its own 8×5 baby, with legs joined to the body
- The terminal shows them when the band has room and the small classic pet when it is short; `/pet size auto|big|small`
- Items sit on the head, face, neck, hand or back of any animal

| Task | Kind | Status |
|---|---|---|
| Sprites for 17 animals, anchors for items | technical | ✅ Done |
| Sizes, joined legs and the size setting asserted | testing | ✅ Done |

</details>

<details><summary><b>E10-S02</b> - as a <b>player</b>, I want <b>my pet drawn as a cartoon where the screen allows</b> · ✅ Done · 5 pts</summary>

So that it looks its best in the desktop app, VS Code and on my badge.

**Acceptance criteria**
- The sprite is traced into one rounded, outlined shape with its patches of colour, real eyes with a glint, blinks, lids when asleep, cross brows and a blush
- Used by the desktop band, the VS Code pet pane, the diary card and the badge; the sky, coins and bugs turn soft too

| Task | Kind | Status |
|---|---|---|
| Tracer, rounded paths and the cartoon pet | technical | ✅ Done |
| Shape, eyes, skins and items asserted | testing | ✅ Done |

</details>
