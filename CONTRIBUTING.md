# Contributing to vibe-game-tool

Thank you for your interest in contributing!  
This project uses a **GitHub Copilot coding-agent workflow** so that accepted issues are automatically implemented, reviewed, and merged with minimal friction.

---

## Table of contents

1. [How to submit an issue](#1-how-to-submit-an-issue)
2. [Maintainer triage & acceptance](#2-maintainer-triage--acceptance)
3. [Copilot implementation](#3-copilot-implementation)
4. [PR review loop](#4-pr-review-loop)
5. [Auto-merge](#5-auto-merge)
6. [Labels reference](#6-labels-reference)
7. [Branch protection setup (one-time)](#7-branch-protection-setup-one-time)

---

## 1. How to submit an issue

> **Anyone** with a GitHub account can open an issue — the repository is public.

1. Go to **Issues → New issue**.
2. Choose the **Feature Request / Bug Report** template.
3. Fill in:
   - **Issue type** (feature, bug, improvement, docs)
   - **Description** — what you want or what went wrong
   - **Acceptance criteria** — a checklist of conditions for "done"  
     *(Copilot uses this checklist as its implementation guide, so be specific.)*
   - **Files likely affected** — optional but helpful
4. Submit. The issue is automatically labelled **`status: needs-triage`**.

Your issue will sit in the triage queue until a maintainer reviews it.

---

## 2. Maintainer triage & acceptance

The maintainer reviews open issues labelled `status: needs-triage`.

| Action | How |
|--------|-----|
| **Accept** for Copilot implementation | Apply label **`status: accepted`** |
| **Reject** / won't fix | Apply label `status: wont-fix` and close the issue |
| **Ask for clarification** | Leave a comment; keep `status: needs-triage` |

> ⚠️ Only users with **Write** (or higher) access to the repository can apply labels.  
> This is the acceptance gate that prevents public issues from being sent to Copilot automatically.

When `status: accepted` is applied, the **Assign to Copilot on acceptance** GitHub Actions workflow fires automatically (see next section).

---

## 3. Copilot implementation

The workflow (`.github/workflows/copilot-auto-assign.yml`) does the following:

1. Detects that `status: accepted` was added to an issue.
2. Calls the GitHub API to assign the issue to **Copilot** (the coding agent).
3. **If assignment succeeds** → the label is changed to `status: in-progress`.
4. **If assignment fails** (Copilot coding agent not enabled on your plan/org) → a comment is posted with manual instructions:
   - Open the issue in the GitHub UI.
   - Click the **Assignees** gear icon.
   - Select **Copilot** from the list.

Once assigned, Copilot will:

- Analyse the repository and the issue's acceptance criteria.
- Create a feature branch and open a **draft PR**.
- Request your review when it considers the work ready.

> See the official guide:  
> [Using GitHub Copilot coding agent to improve a project](https://docs.github.com/en/copilot/tutorials/coding-agent/improve-a-project)

---

## 4. PR review loop

When Copilot opens a PR:

1. Review the changes in the **Files changed** tab.
2. To request changes, leave a **review comment** and tag `@copilot`:
   ```
   @copilot Please rename the function `foo` to `bar` and add a unit test.
   ```
3. Copilot will push additional commits addressing your feedback.
4. Repeat until you are satisfied, then **approve** the PR.

> Copilot responds to `@copilot` mentions in review comments and general PR comments.

---

## 5. Auto-merge

The **Enable auto-merge on Copilot PRs** workflow
(`.github/workflows/auto-merge.yml`) automatically enables squash-merge with
auto-merge on every PR opened by `copilot[bot]`.

Once auto-merge is enabled:

- The PR will merge automatically as soon as **all required status checks pass**
  and **the required number of approvals is met** (configured in branch protection).
- You can also trigger auto-merge manually by adding the **`automerge`** label to
  any PR.

> Auto-merge requires branch protection to be configured on `main`.  
> See [Branch protection setup](#7-branch-protection-setup-one-time) below.

---

## 6. Labels reference

Run the **Setup repository labels** workflow once
(`Actions → Setup repository labels → Run workflow`) to create all labels:

| Label | Colour | Meaning |
|-------|--------|---------|
| `status: needs-triage` | yellow | New issue awaiting maintainer review |
| `status: accepted` | blue | Approved for Copilot implementation |
| `status: in-progress` | gold | Copilot is actively working on this |
| `status: done` | green | Implemented and merged |
| `status: wont-fix` | white | Will not be implemented |
| `copilot: needs-manual-assign` | red | Copilot auto-assign failed; manual action required |
| `automerge` | purple | Enable auto-merge when all checks pass |

---

## 7. Branch protection setup (one-time)

Some settings cannot be configured via files in the repository — they must be
set in the GitHub UI.

### 7a. Protect the `main` branch

1. Go to **Settings → Branches → Add branch ruleset** (or Branch protection rules).
2. Set **Branch name pattern**: `main`.
3. Enable:
   - ✅ **Require a pull request before merging**
     - Set *Required approvals* to `1`
   - ✅ **Require status checks to pass before merging**  
     *(add any CI checks you have, or leave empty for now)*
   - ✅ **Do not allow bypassing the above settings**
4. Save.

### 7b. Enable auto-merge for the repository

1. Go to **Settings → General**.
2. Scroll to **Pull Requests**.
3. Enable **Allow auto-merge**.

### 7c. Enable GitHub Copilot coding agent

1. Go to your **personal/org Copilot settings** at  
   `https://github.com/settings/copilot` (personal) or  
   `https://github.com/organizations/<org>/settings/copilot` (org — replace `<org>` with your organisation name).
2. Ensure the **Copilot coding agent** (cloud agent) feature is enabled.
3. The **Assign to Copilot** option will then appear in the Assignees panel on issues.

---

## Quick-start summary

```
Public opens issue  →  auto-labelled "status: needs-triage"
         ↓
Maintainer reviews  →  applies "status: accepted"
         ↓
Workflow fires      →  assigns issue to Copilot (or comments with manual steps)
         ↓
Copilot works       →  opens PR, label changes to "status: in-progress"
         ↓
Maintainer reviews PR  →  comments "@copilot ..." for changes
         ↓
Maintainer approves PR  →  auto-merge kicks in once checks pass
         ↓
PR merged           →  label changes to "status: done"
```
