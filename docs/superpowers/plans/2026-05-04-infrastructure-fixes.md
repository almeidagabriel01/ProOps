# Infrastructure Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale build artifacts from the repo root and align `engines.node` with the production runtime.

**Architecture:** Three independent, low-risk changes. No tests needed — the changes are either file deletions or single-line edits verified by TypeScript.

**Tech Stack:** npm workspaces, Node.js 22, Firebase Cloud Functions V2

---

### Task 1: Delete stale `.next/` build artifact from repo root

**Files:**
- Delete: `.next/` (entire directory at repo root)

The monorepo migration left a stale Next.js build output at the root. The real output is in `apps/web/.next/`. The `.gitignore` already ignores both paths so this won't come back from CI, but the physical directory is confusing.

- [ ] **Step 1: Confirm the root `.next/` is a leftover, not a symlink**

```bash
ls -la .next/ | head -5
```

Expected: a regular directory, not a symlink.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf .next
```

- [ ] **Step 3: Confirm it's gone and `apps/web/.next/` is unaffected**

```bash
ls .next 2>&1 || echo "Deleted OK"
ls apps/web/.next/ | head -3
```

Expected first line: `Deleted OK`. Expected second: files like `server/`, `static/`, etc.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remover artefato .next/ residual da raiz pos-monorepo"
```

---

### Task 2: Align `engines.node` with production runtime

**Files:**
- Modify: `package.json` (root), line 7

The root `package.json` declares `"engines": { "node": "20" }` but Cloud Functions deploy on Node 22 (set in `apps/functions/src/deploymentConfig.ts` and all CI workflows). This mismatch can cause subtle behavioral differences during local development.

- [ ] **Step 1: Open the file and confirm the current value**

Read `package.json`. Confirm line 7 reads `"node": "20"`.

- [ ] **Step 2: Update the value**

In `package.json`, change:
```json
"engines": {
  "node": "20"
},
```
to:
```json
"engines": {
  "node": "22"
},
```

- [ ] **Step 3: Verify no other `engines` declarations are inconsistent**

```bash
grep -r '"node":' package.json apps/web/package.json apps/functions/package.json 2>/dev/null
```

Expected: all entries reference `22` (or no engines field in sub-packages, which is fine).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: alinhar engines.node para 22 (prod target)"
```

---

### Task 3: Verify monorepo migration CI paths are complete

**Files:**
- Read-only: `.github/workflows/push-checks.yml`, `test-suite.yml`, `deploy-functions.yml`, `deploy-production.yml`

The CONCERNS.md flagged PRs 3+4 of the monorepo migration as incomplete. Before creating any new work, verify the current CI files already reference the correct paths.

- [ ] **Step 1: Check push-checks.yml references**

```bash
grep -n "functions\|apps/functions\|tests/" .github/workflows/push-checks.yml
```

Expected: all function references use `apps/functions` and test references use `tests/`.

- [ ] **Step 2: Check test-suite.yml references**

```bash
grep -n "functions\|apps/functions\|tests/" .github/workflows/test-suite.yml
```

Same expectation.

- [ ] **Step 3: Check deploy workflows**

```bash
grep -n "functions\|apps/functions" .github/workflows/deploy-functions.yml .github/workflows/deploy-production.yml
```

Expected: `apps/functions` everywhere, no bare `functions/` paths.

- [ ] **Step 4: If all paths are correct, update MEMORY to reflect completion**

If the grep output shows all paths are `apps/functions` and `tests/`:

Update `.claude/projects/D--DEV-ProOps/memory/project_monorepo_migration.md` to reflect that PRs 3+4 are complete — the CI workflows already reference the correct monorepo paths.

- [ ] **Step 5: Commit (only if memory file was updated)**

```bash
git add C:/Users/Gabriel/.claude/projects/D--DEV-ProOps/memory/project_monorepo_migration.md
git commit -m "chore: confirmar conclusao migracao monorepo (PRs 3+4)"
```

---

*Infrastructure Fixes Plan — 2026-05-04*
