# Changelog

## 1.1.0 — 2026-10-09

- **`/plan`**: each repo can point at its own plan file. `/plan` with no plan set finds plan-like markdown in the repo and asks which to use; `/plan <file>` sets it; `/plan clear` falls back to the settings.
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
