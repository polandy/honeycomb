Review uncommitted or recently committed changes against the project's standards:

1. `git diff HEAD` (or `git diff origin/main...HEAD` if the working tree is clean). Read the diff
   before any file, and then only the files and doc sections the diff touches.
2. The standard is `CLAUDE.md` and the sections of `docs/03-coding-standards.md` and
   `docs/02-workflow.md` it points to. Check the diff against those files, not against a list
   restated here; a restated copy goes stale without anything turning red.
3. Beyond what `scripts/verify.sh` enforces, check by reading:
   - Does every new behaviour have a test whose name says which rule would break?
   - Do file operations go through `OCP\Files` only, and does deleting reach the trash bin?
   - Are glossary terms used (`docs/04-glossary.md`), with no new synonyms?
   - Does an architectural choice come with an ADR (CLAUDE.md rule 6)?
   - Are comments one line at most and about *why*?
   - Is a UI change backed by the signed-off mockup, and does it work without hover?
   - Is a closed `TODO.md` item removed, and are the docs it touches updated?
4. Report concisely: what needs fixing, with `file:line`. If everything is clean, say so in one
   line.
