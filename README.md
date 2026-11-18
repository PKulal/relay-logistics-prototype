# Logisco prototype — starter kit

Planning files for building the Logisco clickable prototype with Claude Code. No code yet; Claude Code builds it from these files.

## What’s inside

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project rules Claude Code reads at the start of every session |
| `docs/00-source-workflow.md` | Client’s workflow document (Model B), converted from Word, with its figures |
| `docs/01-customer-portal.md` … `04-erp-control-tower.md` | Our four screen-level specs (same content as the Word versions) |
| `docs/data-model.md` | Store entities and business engines |
| `docs/seed-data.md` | Every demo name, ID and number (hero shipment LGS-DEL-000781) |
| `docs/design-system.md` | Colours from the logo, fonts, layout, components |
| `docs/build-plan.md` | Phased checklist by screen ID |
| `.claude/commands/build-screen.md` | Custom command: `/build-screen CP-12 CP-13` |
| `public/brand/logisco-logo.png` | Logo |

## How to start

1. Unzip into an empty folder and run `git init`, then commit.
2. Open the folder in a terminal and run `claude`.
3. First prompt (plan mode):
   > Read CLAUDE.md, docs/build-plan.md, docs/design-system.md and docs/data-model.md. Do Phase 0 of the build plan: scaffold the project with the stack in CLAUDE.md, set up the colour tokens and fonts, and make typecheck, test and dev work. Show me the plan first.
4. Then Phase 1 in a few sessions (store and seed data → engines with tests → launcher and app shells → demo toolbar).
5. From Phase 2 on, use `/build-screen` with screen IDs, one small group at a time, in build-plan order.
6. Commit after every item. If a session goes wrong, `git reset` and retry with a smaller ask.
