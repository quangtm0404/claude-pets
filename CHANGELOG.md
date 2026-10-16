# Changelog

## 1.10.0 — 2026-10-15

Found, and easy to tune ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E11-S03, E14, E15-S01, E15-S02, E16-S01, E17).

- **`/pet settings`** (E14-S01): every setting on one screen, a button per choice: pet, size, motion, theme, font, sound, break reminders, festivals, chatter and the runner.
- **`/pet perf`** (E15-S02): how much the pet is drawing, per minute, so you can see what `/pet motion` saves on your computer.
- **`/pet festivals preview halloween`** (E14-S02): see any festival for 30 seconds, on any day. No keepsake: that still comes on the day.
- **Lighter on a slow computer.** A pet sitting still is drawn less often, the desktop app and VS Code get at most two pictures a second with no blinking cursor in them, and the terminal strip is only redrawn when it changed. `/pet motion low` (about a frame a second) or `off` (still until something happens) go further.
- **Fixed: two pets in VS Code.** VS Code now draws the band, so the pet pane no longer opens there by itself; `/pet pane` still opens it.
- **`/pet backup` and `/pet restore <code>`** (E16-S01): move your pet to another computer with one line of text; `/pet restore undo` takes it back. The leaderboard key and weather place stay behind.
- **`/pet week`** (E17-S01): the last seven days, XP by day as bars, with commits, test runs and focus rounds; on Monday a toast brings last week. The diary now keeps 28 days.
- **Daily goals** (E17-S02): `/pet goal commits 3` (or green, focus, xp). The status line shows `GOAL 1/2`; meet them all for +20 XP and a blind box, once a day.
- No band redraw every 10 seconds in a folder that isn't a git repository.
- Commands typed while `/pet settings` is open now update it too.
- Shorter command descriptions with argument hints, so the typeahead shows what `/pet`, `/retro`, `/story`, `/ticket` and `/guard` take.
- `docs/LISTING.md`: the plugin directory submission, ready to paste (E15-S01).

## 1.9.0 — 2026-10-14

Built to last, and more to celebrate ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E11, E12-S01, E13).

- **Achievements for real work** (E13-S01): CLEAN SHEET (10 green test runs in a row), COMEBACK (failing tests turned green 5 times), SHIPPER (10 commits), DEEP FOCUS (10 focus rounds). `/pet board` shows the counts.
- **Festival keepsakes** (E13-S02): the first time you see each festival your pet gets something to keep: a lucky envelope, a star lantern, a Santa hat, a sparkler, heart glasses or a pumpkin hat. Not for sale, not in boxes.
- **More festivals, and days of your own** (E13-S03): Valentine's Day and Halloween; `/pet festivals add 11-20 Teachers' Day` puts confetti in the band that day every year.
- **CI** (E11-S01): every push is validated, tested and type-checked, and the board service's tests run.
- **The mod in modules** (E11-S02): themes, weather, the pet's scene and the profile have their own files. No change in behaviour.
- **A demo in the README** (E12-S01), drawn by the mod itself.
- The board service shows keepsakes on badges once it is redeployed; until then a badge keeps the last look it had.

## 1.8.0 — 2026-10-14

Life and seasons, the rest of it ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E8-S02 to S05), and a checklist for your finds.

- **Break reminders** (E8-S02): after an hour of continuous work your pet stretches when the turn ends and suggests a break and some water. At most once an hour, never during a turn, not while a focus timer runs. `/pet breaks <minutes>|off` and a `breaks` setting.
- **Festivals** (E8-S03): lanterns at Tết, the moon and mooncakes at Mid-Autumn, a tree in the snow at Christmas, fireworks at New Year, in the terminal and as soft shapes on the desktop. Tết and Mid-Autumn are worked out from the lunar calendar (Vietnam's, UTC+7) for each year. `/pet festivals [on|off]` and a `festivals` setting.
- **A birthday** (E8-S04): the adoption day (for saves from before, the earliest date they hold) comes round each year with a party hat, the band saying how old your pet is, and a one-off +50 XP. `/pet birthday`; `/pet stats` shows the adoption date.
- **Chatter** (E8-S05, off by default): `/pet chatter on`, and at most once every 20 minutes after a turn your pet says a line in the band, written by Haiku from a summary of counts. No file, path, command, prompt or answer text is sent; the line never goes into the conversation.
- **`/pet collection`** is now a checklist: every find by rarity, ✓ found or 🔒 not yet, with how many of the 15 you have.

## 1.7.0 — 2026-10-11

Surprises and a new look ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E9, E10). The board service is updated too.

- **Blind boxes** (E9): one for each level up, each achievement and every 4 focus rounds, and 3 to start. `/pet box open`: the pet shakes it in the band and the find pops out. Common, rare, epic and legendary finds: box-only items (flower crown, headphones, bandana, hero cape, wizard hat, rainbow scarf, halo), skins (pastel, shadow, ghost, golden, galaxy) and three box-only animals (dragon, unicorn, axolotl). Duplicates become coins; ten boxes without an epic make the next one epic. `/pet collection`, `/pet skin`.
- **A new look** (E10): every animal redrawn at 12×8 pixels with its own baby. The terminal shows them when the band has room (`/pet size auto|big|small`); the desktop app, VS Code, the diary card and badges trace them into smooth, outlined cartoons with eyes that blink.
- Badges show skins and box finds.

## 1.6.0 — 2026-10-11

Life and seasons begins ([backlog](https://github.com/quangtm0404/claude-pets/blob/main/docs/backlog/BACKLOG.md): E8-S01).

- **A Pomodoro focus timer** your pet guards: `/pet focus` runs 25/5 rounds until `/pet focus stop`; `/pet focus 45/5` (or any focus/break) sets your own. The countdown shows in the band, the pet stands guard and stretches on breaks, and each finished round chimes and earns XP. Every fourth break is long. It survives a plugin reload.
- The diary counts focus rounds.

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
