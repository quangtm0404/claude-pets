# Changelog

## 1.2.0 — 2026-10-11

For everyone, not just developers ([backlog](docs/backlog/BACKLOG.md): E1–E3).

- **Rows you choose** (E1): the `bandRows` setting picks the band's rows and their order. The story row only shows when something is tracked, so non-developers never see backlog prompts. Short terminals drop rows by importance and keep the pet.
- **Weather** (E2): `/weather <city>`, `/weather here` (opt-in IP lookup) and `/weather off`; °C, °F or both. The sky in the pet's strip matches the weather (sun, moon and stars, clouds, rain, snow, fog, storm, wind), and the pet reacts to it. Nothing is fetched until a place is set.
- **Profile and pet board** (E3): lifetime totals, XP per animal, `/pet board`, daily streaks and eight achievements. A shared online leaderboard is proposed (E3-S04), not built.

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
