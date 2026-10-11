# Changelog

## 1.5.1 — 2026-10-11

- **The runner game is now optional** and off by default. `/pet play` opens it in the band (even between turns) until `/pet play off`; `/pet play auto` brings back the old behaviour of opening it by itself 8 seconds into a turn.

## 1.5.0 — 2026-10-11

Share ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E7). The board service is updated and live.

- **A live badge** (E7-S01): `/pet card` gives Markdown for your GitHub README. The board draws your pet with what it wears, in your theme's colours, with your level, XP and streak.
- **Visits** (E7-S02): `/pet visit <github login>` brings your pet to play with a friend's for a minute; the first visit a day gives you both +5 XP. `/pet visits off` stops visits to you.
- **The diary** (E7-S03): `/pet diary` tells the day in your pet's words; `/pet diary card` copies it as an SVG picture.
- The pets' pixel art now lives in `hooks/art.ts`, shared by the plugin and the board service.

## 1.4.0 — 2026-10-11

Play ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E6).

- **A runner game while Claude works** (E6-S01): after 8 seconds of a turn, the pet's strip becomes a game. Click it, then space, ↑ or a click jumps the bugs. A run's score is XP, at most 20 a turn; your best is kept. Terminal and desktop app.
- **The coin shop** (E6-S02): `/pet shop`, `/pet buy <item>`, `/pet wear <item>|none`. A bow, a scarf, sunglasses, a top hat, a Tết lantern and a crown, drawn on every animal. Every coin you've collected so far is spendable.
- **Growing up** (E6-S03): baby until LV10, adult, a twinkling legend at LV25, wings at LV50. `/pet stats` shows the stage.
- **Reactions to your work** (E6-S04): it dances on green tests, winces on red, rides a rocket on a `git push`, puzzles over merge conflicts, and naps beside long commands. `/pet stats` shows what it's reacting to.

## 1.3.1 — 2026-10-11

- **Weather is part of `/pet`**: `/pet weather`, `/pet weather <city>`, `/pet weather here` and `/pet weather off`. The separate `/weather` command is gone.
- **`/pet help`** lists every Claude Pets command, grouped: pet, weather, boards, look and work.

## 1.3.0 — 2026-10-11

Everywhere, in your colours ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E5).

- **The pixel pet in the desktop app** (E5-S01): the band draws the same pet, sky, coins, bugs and helpers as SVG, instead of an emoji line.
- **A pet pane for VS Code** (E5-S02): VS Code has no band, so the pet gets its own pane there, with its HUD, usage, weather and BALL/PAT buttons. It opens by itself when the pet is shown; `/pet pane` opens it on any surface.
- **Your own colours** (E5-S03): four more presets (`mint`, `rose`, `mono`, `paper` for light terminals), and any accent with `/retro theme #FF8800`, or accent and background with `/retro theme #FF8800 on #101010`. The new `theme` setting sets the starting theme.
- **Banner fonts** (E5-S04): `/retro font bold|mono|double|wide|pixel`, and a `font` setting. `pixel` draws big pixel letters when the band has room. The terminal's own font stays the terminal's setting; the README says where to change it.

## 1.2.1 — 2026-10-11

- **The world board is live.** It's at `claude-pets-board.claude-pets-leaderboard.workers.dev`, with its GitHub sign-in app built in as the default, so `/pet join` works straight after install. It's still opt-in: nothing is sent until you join, `/pet leave` deletes your entry, and emptying the `leaderboardUrl` setting turns it off.

## 1.2.0 — 2026-10-11

For everyone, not just developers ([backlog](docs/backlog/BACKLOG.md): E1–E3).

- **Rows you choose** (E1): the `bandRows` setting picks the band's rows and their order. The story row only shows when something is tracked, so non-developers never see backlog prompts. Short terminals drop rows by importance and keep the pet.
- **Weather** (E2): `/weather <city>`, `/weather here` (opt-in IP lookup) and `/weather off`; °C, °F or both. The sky in the pet's strip matches the weather (sun, moon and stars, clouds, rain, snow, fog, storm, wind), and the pet reacts to it. Nothing is fetched until a place is set.
- **Profile and pet board** (E3): lifetime totals, XP per animal, `/pet board`, daily streaks and eight achievements.
- **World board** (E4): an opt-in shared leaderboard. `/pet join` (GitHub device sign-in, no scopes), `/pet board world` and `/pet leave`, backed by a Cloudflare Worker and D1 service in `server/` with plausibility checks. It's off until its settings point at a deployed service.

## 1.1.1 — 2026-10-11

- **The pet shows in short terminals**: it used to need about 9 free rows, so in macOS's default 80×24 Terminal it only appeared in fullscreen. The pet and `READY.` now get room first and the info rows (story, usage, banner, branch, epic and tests) drop out one by one as space runs short.
- **`/plan` is now `/story plan`**: Claude Code's built-in `/plan` (plan mode) owns that name, so the plugin's command was never registered.

## 1.1.0 — 2026-10-09

- **`/plan`** (now `/story plan`): each repo can point at its own plan file. `/plan` with no plan set finds plan-like markdown in the repo and asks which to use; `/plan <file>` sets it; `/plan clear` falls back to the settings.
- **No more errors** for a missing plan: the band shows `NO PLAN YET · /plan TO POINT AT YOURS`, or which file the plan is, instead of `?FILE NOT FOUND ERROR`.
- **No more false matches**: an id mentioned in a prompt, or in a branch name, is only tracked if the plan has it.
- **Per-repo story**: each repo remembers the story it was tracking.
- A plan that can't be read no longer costs a turn its XP.

## 1.0.0 — 2026-10-09

First public release of Claude Pets (plugin id `pixel-pets`).

- **The band**: a themed strip above the prompt with plan usage (5-hour and weekly windows, reset countdowns, context fill), the branch and worktree, the backlog story you're tracking, and the last test run. Themes: ice (the default), phosphor, amber and c64.
- **The pet game**: 14 pixel pets that walk the bottom of the band. They collect coins from successful tool calls, hunt bugs from errors, earn XP and level up. They turn grumpy at 70% of a plan limit, furious at 90%, and it's game over at 100%.
- **Helpers**: every subagent hatches a numbered baby pet that earns XP while it works and brings it home when the job is done.
- **Voices**: one gentle, synthesised voice per animal (17 in all), played at most once every 20 seconds, on Windows, macOS and Linux.
- **Backlog tracking from markdown**: story blocks and table rows, with the id pattern and file list as settings.
- **Guardrails**: refuses edits to files marked as generated, and asks before risky deploy, push and PROD commands.
- **Helpers in the prompt**: the tracked story's acceptance criteria ride along with prompts; `/standup64`, `/defect` and `/qa-pane`.
- **Saved progress**: XP saves add up across several open sessions.
