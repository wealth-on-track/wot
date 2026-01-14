# Professional Development Workflow
*Last Updated: January 2024*

This document outlines the professional "Git Flow" strategy we have established for the Wealth on Track project. This workflow separates daily development from the stable production site.

---

## 1. Environment Setup

We now have two distinct environments:

| Environment | Branch | URL (Example) | Database (Recommended) |
| :--- | :--- | :--- | :--- |
| **Production** | `main` | `https://wot.money` | `wot-db` (Prisma Postgres) |
| **Development** | `dev` | `https://wot-beta-git-dev-mpt.vercel.app` | `wot-db-dev` (Prisma Postgres) |

> **Critical**: Your local computer (`localhost:3000`) should ideally connect to the **Development** database to avoid accidental data loss in production.

---

## 2. Daily Development Routine (The Cycle)

### Step 0: Start Work
Always ensure you are on the `dev` branch before starting work.
```bash
git checkout dev
git pull origin dev  # Get latest changes if any
npm run dev          # Start local server
```

### Step 1: Make Changes
- Edit files, add features, fix bugs.
- Test locally on `http://localhost:3000`.

### Step 2: Commit & Save
When you are happy with a chunk of work:
```bash
git add .
git commit -m "feat: added new asset class support"
```

### Step 3: Backup / Share (Push to Dev)
To back up your work or see it on the Vercel Preview link:
```bash
git push origin dev
```
*Vercel will automatically build a preview version from this branch.*

---

## 3. "Deployment Day" (Releasing to Production)

When you are ready to make your changes live for `test1` and other users (Weekly/Monthly release):

### Step 1: Verify Dev is Stable
Ensure everything works on your local or the Vercel Preview link.

### Step 2: Merge Ritual
We merge `dev` into `main`.

```bash
# 1. Go to production branch
git checkout main

# 2. Update it (just in case)
git pull origin main

# 3. Merge Development changes
git merge dev

# 4. Push to Live
git push origin main
```

### Step 3: Go back to work
```bash
git checkout dev
```

*Vercel will detect the push to `main` and automatically trigger a **Production Deployment**.*

---

## 4. Emergency Fixes (Hotfixes)

If Production is broken and you can't wait for the next release cycle:
```bash
git checkout main
# ... make the quick fix ...
git add .
git commit -m "fix: emergency login bug"
git push origin main
# CRITICAL: Sync fix back to dev so you don't overwrite it later!
git checkout dev
git merge main
```
