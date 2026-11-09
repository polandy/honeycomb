---
name: todo
description: Add, finish or list items on the open-work list (`TODO.md` in the repo root). Use when the owner says "/todo <text>", "put it on the todo list", "note that for later", or asks what is open.
---

# /todo — the open-work list

`TODO.md` in the repository root holds open work. It holds open items only; a finished item is
deleted, and Git keeps the history. Its `## Milestones` section is ordered (the order of
`docs/plan.md`); `## Later` collects everything else. An open question belongs in `docs/plan.md`
(Open questions) or in a `needs-owner` issue, a decision in an ADR.

## Add

1. Take the item from the arguments, or from the conversation if the owner says "that". Never ask
   a clarifying question; record a vague item as stated.
2. Grep `TODO.md` for its key words. If a matching line exists, update that line instead.
3. Append one line at the end of `## Later`, unless the owner names a milestone:

   `- [ ] <short imperative title> — <one sentence: why or where, ADR/question id if known> (YYYY-MM-DD)`

   - Today's date, absolute. English, also when the owner wrote in another language.
   - Add an ADR or question id only if the owner named it or one `grep` finds it; do not research.
   - A larger item may have indented sub-bullets, nothing more.
4. Reply with the line as written. Do nothing else: no implementation, no Git commands.

## Variations

- `/todo done <words>`: find the matching line and delete it.
- `/todo list`: print the open items, nothing else.
