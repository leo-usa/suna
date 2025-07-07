# Upstream Merge & Sync Plan

## 1. Create a Backup of Current State

Before making any changes, create a backup branch from your current `main`:

```sh
git checkout main
git pull
git checkout -b my-backup-before-upstream-merge
```

This ensures you can always get back to your current state if needed.

---

## 2. Test Upstream Directly

Test the latest upstream code without affecting your work:

```sh
git fetch upstream
git checkout -b test-upstream upstream/main
```

- Run backend and frontend locally.
- Test if the upstream version works as expected.
- Note any issues or differences.

---

## 3. Review Differences

- Use a GUI tool (e.g., VSCode, GitHub Desktop, gitk) or `git diff` to compare:
  - `upstream/main` vs. `my-backup-before-upstream-merge`
- Pay special attention to:
  - **Backend:** Plan to adopt upstream as the base, then re-apply your changes.
  - **Frontend:** Review carefully, since many new features and i18n work were added locally.

---

## 4. Merge Upstream into Main (Safe, Reviewable Way)

**Option A: Merge (recommended for easier conflict resolution)**

```sh
git checkout main
git pull
git merge upstream/main
```
- Resolve conflicts as they come up.
- For backend, prefer upstream’s version, then re-apply your changes as needed.
- For frontend, review each conflict and decide case-by-case.

**Option B: Rebase (linear history, but can be harder with many conflicts)**

```sh
git checkout main
git pull
git rebase upstream/main
```
- Only do this if you are comfortable with rebasing and conflict resolution.

---

## 5. Test and Commit

- After merging/rebasing, thoroughly test both backend and frontend.
- Fix any issues, then commit and push your changes to your fork.

---

## 6. (Optional) Cherry-pick or Patch

If you want to selectively apply changes (especially for frontend):
- Cherry-pick specific commits from your backup branch onto the new `main`:
  ```sh
  git cherry-pick <commit>
  ```
- Or, use `git diff`/`patch` to manually apply only the changes you want.

---

## Summary Table

| Step                | Command/Action                                      | Purpose                                  |
|---------------------|-----------------------------------------------------|------------------------------------------|
| Backup              | `git checkout -b my-backup-before-upstream-merge`   | Safe restore point                       |
| Test upstream       | `git checkout -b test-upstream upstream/main`       | See if upstream works                    |
| Review              | Use diff tools                                      | Plan merge strategy                      |
| Merge/rebase        | `git merge upstream/main` or `git rebase ...`       | Integrate upstream                       |
| Test & commit       | Manual testing, then commit                         | Ensure stability                         |
| Cherry-pick/patch   | `git cherry-pick ...` or `git apply ...`            | Selective changes (if needed)            |

---

## Best Practices
- Always keep a backup branch until you’re 100% confident in the merge.
- Test upstream in isolation before merging.
- For backend, adopt upstream and re-apply your changes.
- For frontend, review and merge carefully, especially for i18n and new features. 