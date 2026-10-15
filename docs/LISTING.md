# Listing Claude Pets

Text for the [plugin directory submission form](https://clau.de/plugin-directory-submission) and for posts, ready to paste. Submitting is the owner's to do: it goes out under their name.

## The form

| Field | Answer |
|---|---|
| Name | Claude Pets (`pixel-pets`) |
| Repository | https://github.com/quangtm0404/claude-pets |
| Install | `/plugin marketplace add quangtm0404/claude-pets` then `/plugin install pixel-pets@pixel-pets` |
| Licence | MIT |
| Works in | Terminal, the desktop app, VS Code |
| Category | Productivity / fun |

**One line.** A pixel pet that lives above your prompt: it walks, hunts bugs, celebrates green tests and festivals, and shows your plan usage, weather and backlog story in a retro band.

**Description.**
Claude Pets puts a small pixel pet in a retro band above the Claude Code prompt. The pet reacts to your real work: it dances when tests go green, winces when they fail, rides a rocket on a push, naps through long commands, and sends a helper pet out with each subagent. The band also shows your 5-hour and weekly plan usage, the weather, your branch and the backlog story you're on.

There's a game in it, kept gentle: XP, levels, coins, items to wear, blind boxes, achievements for real work (10 green test runs in a row, 10 commits), a Pomodoro timer the pet guards, break reminders, festivals with keepsakes, and an opt-in leaderboard with shareable badges. `/pet settings` puts every option on one screen, and `/pet motion low` keeps it light on a slow computer.

**What it touches.** Reads: your backlog markdown, `git` status, the Bash/test output Claude already shows you. Sends: nothing by default. Weather (Open-Meteo) only when you set a place; the leaderboard only after `/pet join`, with the fields listed in the README's Privacy section. Chatter (a small model writing a line now and then) is off unless you turn it on, and gets only a count summary, never your code or prompts.

**Screenshot / demo.** `docs/img/demo.gif` (raw: https://raw.githubusercontent.com/quangtm0404/claude-pets/main/docs/img/demo.gif)

## A short post

> I made a pixel pet for Claude Code 🐱 It lives above the prompt, hunts bugs, dances when tests go green, carves pumpkins at Halloween, and shows plan usage + weather in a retro band. Terminal, desktop app and VS Code.
> `/plugin marketplace add quangtm0404/claude-pets` → `/plugin install pixel-pets@pixel-pets`
> https://github.com/quangtm0404/claude-pets

## Checklist before submitting

- [ ] v1.10.0 pushed and released, CI green on main
- [ ] README demo GIF shows on GitHub
- [ ] Install from a clean machine with the two commands above
