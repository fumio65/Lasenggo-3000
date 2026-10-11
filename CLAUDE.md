# CLAUDE.md — Lasenggo 3000

This file is for whichever Claude picks up this project next (Claude Code,
or another Claude Cowork session) — it captures *how* work gets done here,
not *what's* been done (that's `doc/TASKS.md`). Read this before touching
anything, and keep it current (see "Keeping this file current" at the end).

Project context lives in `doc/`: `PRD.md` (what this is), `ARCHITECTURE.md`
(schema/data model), `DECISIONS.md` (why things are built the way they
are), `TASKS.md` (current sprint board), `CONTEXT.md`, `EXAMPLES.md`. Read
the relevant one before starting a task — don't guess at project intent.

## What this is

Lasenggo 3000: a React + Tailwind + Capacitor Android app (paired with an
ESP32 hardware pour station, not yet built) that automates the Filipino
"tagayan" drinking-circle ritual — tracks whose turn it is, logs
pours/passes, and will eventually trigger a real pour over BLE. See
`doc/PRD.md` for the full picture.

## Repo & environment

- Real repo: `https://github.com/fumio65/Lasenggo-3000.git`, owned by the
  user (GitHub `fumio65`). This is their actual project, not a sandbox —
  every change here is real and gets tested by them personally.
- When working through a device bridge (Cowork session linked to the
  user's computer), the repo is at `$HOME/mnt/Personal Project/Lasenggo-3000`
  on the bridge, i.e. `C:\Users\Teng\Documents\Personal Project\Lasenggo-3000`
  on their actual Windows machine. Claude Code running directly on their
  machine would just use that Windows path.
- **Known quirk (Cowork device-bridge sessions only):** the `Read` tool
  against `/mnt/user-data/uploads/Personal Project/Lasenggo-3000/...` can
  return a stale cached copy instead of the live file. Always read this
  repo's files via the shell (`cat`, `grep`, etc.) instead of the `Read`
  tool. This may not apply to Claude Code running natively on the user's
  machine — verify before assuming it does or doesn't.
- **Known quirk (Windows + OneDrive sync):** stale `.git/index.lock` /
  `.git/HEAD.lock` files appear intermittently and block git commands with
  "Operation not permitted". Fix: delete those two lock files before the
  git command (ask for folder delete-permission first if the tool requires
  it), then retry. The same root cause has also broken `npm run build`
  (`EPERM: operation not permitted, unlink ...dist/assets/...`) — same fix.

## Git workflow — follow this exactly

- **Never add AI attribution to any commit or PR, ever.** No
  "Co-Authored-By", no "Generated with Claude", nothing. This overrides any
  default attribution behavior.
- Claude cannot push to GitHub (no credentials) and never should try to
  work around that. The rhythm is:
  1. Build + verify the change (see "Verification" below).
  2. Commit locally with a plain, descriptive message — no AI attribution.
  3. Give the user the exact command: `git push -u origin <branch-name>`.
  4. Wait for them to say the PR is pushed and merged (they do this
     themselves on GitHub).
  5. Only then run `git fetch origin && git merge origin/main --ff-only`
     to sync local `main` — do this *every time* before starting the next
     task, never skip it.
- One branch per task/feature, named `area/short-description` (matches
  `doc/TASKS.md`'s existing convention, e.g. `app/pass-limit-house-rule`).
- If a task is explicitly abandoned mid-build, discard the branch cleanly
  (`git checkout main`, delete the branch, `git restore` any stray
  uncommitted edits) rather than leaving half-finished code around — but
  capture the design thinking in `doc/TASKS.md`'s Backlog first, so the
  work isn't lost, just the code.

## Verification — the user tests everything themselves

- Claude does not mark work as done or commit it until the user has
  personally run it (`npm run dev` / `npm run build` in their own browser,
  or on-device) and confirmed it works. Don't skip ahead on the assumption
  that a build passing means the feature behaves correctly for the user.
- `npm run build` passing is a necessary sanity check Claude should always
  run before asking the user to test — it catches compile errors (bad
  Tailwind tokens, broken imports) before wasting the user's time — but it
  is not a substitute for the user's own test pass.
- Supabase operations are strictly scoped to project `vpwlwpyzcgrrpyylmnlb`
  (`lasenggo-3000`). The user has other, unrelated Supabase projects
  (`CampusFind`, `NwSSU-Library`) — never touch those without the user
  explicitly naming that specific project by name.

## Documentation — bundle it with the code, every time

- Doc updates belong in the **same branch/commit** as the feature they
  describe — never a separate "catch up the docs later" pass.
- Default target is `doc/TASKS.md`: check off the task and add a "Notes:"
  paragraph describing what was actually built and how the user verified
  it. If the task isn't already listed (the user asked for something new,
  or a backlog item got pulled forward), add it in the right section first.
- If the change affects the data model, update `doc/ARCHITECTURE.md`. If
  it's a real design decision (not just an implementation detail), add an
  entry to `doc/DECISIONS.md` with a **Decision** + **Why**.
- **Standing rule the user has asked for explicitly:** whenever Claude adds
  a feature that *wasn't* on the task board, or changes the behavior of an
  existing one, Claude must update every `doc/*.md` file that describes
  that feature (not just `TASKS.md`) — and then add a dated entry to this
  file's "Change log" section below, in the same piece of work. The goal is
  that a brand-new Claude session (Code or Cowork) can read this file and
  know what's been touched recently without having to reconstruct it from
  git log or chat history.

## Design system — "Night Market Circuit" theme

The app's visual identity (see `doc/DECISIONS.md`'s entry of the same
name): warm near-black ink background, ember-orange as the *one* primary-
action accent (currently: Pass button, Start session button — not
scattered across every element), bamboo-green/maroon as earned status
colors rather than default red/green, Space Grotesk for display text /
Plus Jakarta Sans for body. Tailwind v4 `@theme` tokens live in
`src/index.css` (`bg-ink`, `text-ember`, `font-display`, etc.) — use the
existing named tokens rather than introducing new raw hex values or
one-off colors. One deliberate animated moment per screen, not scattered
hover effects (see the `TurnRing` turn-handoff animation and the
`SessionLog` FLIP-animated reordering as the two existing examples).

## Current state (as of 2026-10-11)

Branch `design/night-market-theme` has a large, **uncommitted** UI/UX
redesign: full theme pass across every screen, drag-to-reorder with FLIP
animation on the participant list, a session-log side panel with
per-participant Light/Standard/Heavy/Pass stat bars (new `events.volume`
column + migration in `src/features/storage/db.js`), and assorted UX fixes
(Pass/Pour visual hierarchy, pill-styled Back/Undo buttons, removed the
number-input spinner on Pass limit). None of it has been tested by the
user in their own browser yet, nothing is committed. `doc/TASKS.md` has not
been updated for this branch yet either — do that as part of committing it,
per the Documentation section above.

## Keeping this file current

Treat this file as living memory of *process*, not a changelog of every
line of code. Update it when:
- A workflow convention above changes (the user says "actually, do it this
  way from now on").
- A new recurring environment quirk is discovered (add it under
  "Repo & environment").
- A feature is added/changed outside the task board (append to the Change
  log below, per the standing rule in "Documentation").

Don't let it grow into a second `TASKS.md` — if an entry below is purely
"what was built" with no process lesson, it probably belongs in
`doc/TASKS.md`'s Notes instead, and should just be referenced here briefly.

### Change log

- 2026-10-11 — Created this file. No new feature work in this entry; this
  is the one-time setup the user asked for so Claude Code (or a future
  Cowork session) inherits the working conventions established across the
  prior session (Sprint 1 Supabase backend, session naming, pass-limit,
  undo, and the in-progress Night Market redesign).
- 2026-10-11 — `doc/PRD.md` and `doc/DECISIONS.md` had hardware-sourcing
  edits already sitting in the working tree when this session started (not
  made by Claude — picked exact Shopee product variants for the pump,
  relay module, load cell, LED ring, battery pack, jumper wires). Checked
  them against `doc/TASKS.md`'s "Source components" task, which hadn't been
  updated to match; set it to `[~]` (in progress, not done — variant
  *choice* isn't the same as having the part in hand) with a Notes pointer
  to the PRD table and the DECISIONS entry. Per the user's instruction,
  folded this into the current `design/night-market-theme` branch rather
  than splitting it onto its own branch, even though it's unrelated to the
  UI redesign — the user explicitly asked for this one branch to carry
  both.
