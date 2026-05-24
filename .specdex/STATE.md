# Specdex overnight build — execution ledger

Single source of truth for the autonomous loop. Each iteration:
1. Reads this file + `git log --oneline`.
2. Picks the **first plan in the order below whose `status=pending` and whose every prerequisite is `status=done`.**
3. Executes exactly that one plan, then exits.

**Ordering rule:** the list below is already in a valid topological order, but the
prerequisite check is authoritative. If the order and the prereqs ever disagree,
**trust the prereqs** (never start a plan whose prereqs aren't all `done`).

**Branch model:** single integration branch (no per-plan worktrees). Skip each
plan's "Task 0: Worktree bootstrap" — work on the current branch.

Status values: `pending` | `done` | `blocked`. Only the loop edits these.

---

## Plans (topological order)

- [x] 01 wave0-cargo-workspace        status=done     prereqs=()
- [x] 02 wave0-tauri-shell             status=done     prereqs=(01)
- [x] 03 wave0-ui-design-system        status=done     prereqs=(01,02)
- [x] 04 wave0-tauri-specta-bridge     status=done     prereqs=(01,02,03)
- [x] 05 wave0-test-harness            status=done     prereqs=(01,02,03,04)
- [x] 10 core-models                   status=done     prereqs=(01,02,03,04,05)
- [x] 11 core-db-migrations            status=done     prereqs=(10)
- [x] 14 core-document-parser-trait    status=done     prereqs=(10)
- [x] 12 core-kb-repo                  status=done     prereqs=(10,11)
- [ ] 13 core-entry-repo               status=pending  prereqs=(10,11,12)
- [ ] 15 core-ingest-pipeline          status=pending  prereqs=(10,11,12,13,14)
- [ ] 16 core-scanner-aho-corasick     status=pending  prereqs=(10,11,12,13,14,15)
- [ ] 17 core-tantivy-indexes          status=pending  prereqs=(10,11,12,13,14,15)
- [ ] 20 adapter-commands              status=pending  prereqs=(04,10,11,12,13,14,15,16,17)
- [ ] 21 frontend-router-and-state     status=pending  prereqs=(03,04,20)
- [ ] 23 frontend-documents-route      status=pending  prereqs=(03,20,21)
- [ ] 25 frontend-kb-routes            status=pending  prereqs=(03,20,21)
- [ ] 22 frontend-search-route         status=pending  prereqs=(03,17,20,21,25)
- [ ] 24 frontend-pdf-viewer           status=pending  prereqs=(03,20,21,23)
- [ ] 26 frontend-schema-editor        status=pending  prereqs=(03,20,21,25)
- [ ] 27 frontend-entry-form           status=pending  prereqs=(03,20,21,24,25)
- [ ] 28 frontend-ingest-queue         status=pending  prereqs=(03,20,21,23)
- [ ] 29 frontend-onboarding           status=pending  prereqs=(03,20,21,25)
- [ ] 30 frontend-settings             status=pending  prereqs=(03,20,21)
- [ ] 40 backup-restore                status=pending  prereqs=(10,11,12,13,14,15,16,17,20,30)
- [ ] 41 packaging-installers          status=pending  prereqs=(01,02,03,04,05,10,11,12,13,14,15,16,17,20,21,22,23,24,25,26,27,28,29,30,40)
- [ ] 42 e2e-playwright-flows          status=pending  prereqs=(05,20,21,22,23,24,25,26,27,28,29,30,40)
- [ ] 43 launch-readme-screencast      status=pending  prereqs=(41,42)

Plan files: `docs/superpowers/plans/2026-05-24-NN-<slug>.md`

---

## Notes / blockers
(The loop appends one line per blocked plan here: `NN blocked: <reason>`.)
