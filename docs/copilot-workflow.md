# Copilot coding-agent workflow

This document gives a deeper look at how the GitHub Copilot coding-agent
integration works in this repository, including troubleshooting tips and
advanced configuration.

---

## Architecture overview

```
 ┌──────────────┐     opens issue      ┌─────────────────────────────────┐
 │  Public user │ ──────────────────▶  │  GitHub Issues                  │
 └──────────────┘                      │  label: status: needs-triage    │
                                       └────────────┬────────────────────┘
                                                    │ maintainer applies
                                                    │ "status: accepted"
                                                    ▼
                                       ┌─────────────────────────────────┐
                                       │  GH Actions: copilot-auto-      │
                                       │  assign.yml                     │
                                       └────────────┬────────────────────┘
                                                    │
                              ┌─────────────────────┼──────────────────────┐
                              │ API success          │ API failure           │
                              ▼                      ▼                       │
                   ┌──────────────────┐  ┌──────────────────────────┐       │
                   │ Copilot assigned │  │ Comment posted with       │       │
                   │ label: in-prog.  │  │ manual steps; label:      │       │
                   └────────┬─────────┘  │ copilot: needs-manual-.. │       │
                            │            └──────────────────────────┘       │
                            ▼                                                │
                   ┌──────────────────┐                                      │
                   │ Copilot works on │                                      │
                   │ the issue and    │                                      │
                   │ opens a PR       │                                      │
                   └────────┬─────────┘                                      │
                            │                                                │
                            ▼                                                │
                   ┌──────────────────┐                                      │
                   │ GH Actions:      │                                      │
                   │ auto-merge.yml   │                                      │
                   │ enables squash   │                                      │
                   │ auto-merge       │                                      │
                   └────────┬─────────┘                                      │
                            │                                                │
                            ▼                                                │
                   ┌──────────────────┐                                      │
                   │ Maintainer       │                                      │
                   │ reviews PR;      │                                      │
                   │ @copilot for     │                                      │
                   │ changes          │                                      │
                   └────────┬─────────┘                                      │
                            │ approved + checks pass                         │
                            ▼                                                │
                   ┌──────────────────┐                                      │
                   │  PR auto-merged  │◀─────────────────────────────────────┘
                   └──────────────────┘
```

---

## Workflow files

### `.github/workflows/copilot-auto-assign.yml`

| Property | Value |
|----------|-------|
| Trigger | `issues` → `labeled` |
| Condition | `github.event.label.name == 'status: accepted'` AND event is not a PR AND sender is a human |
| Permissions | `issues: write` |

**What it does**

1. POSTs to `/repos/{owner}/{repo}/issues/{number}/assignees` with `["copilot"]`.
2. Checks the HTTP response:
   - **200 / 201** → success path: swaps label to `status: in-progress`.
   - **anything else** → failure path: posts a fallback comment and adds  
     `copilot: needs-manual-assign`.

**Why `sender.type == 'User'`?**  
This guards against bots applying the `status: accepted` label (e.g., another
automation) and accidentally triggering the Copilot assignment.  
If you *want* a bot to be able to trigger the flow, remove or loosen this condition.

---

### `.github/workflows/auto-merge.yml`

| Property | Value |
|----------|-------|
| Trigger | `pull_request` → `opened`, `reopened`, `ready_for_review` |
| Condition | PR author is `copilot[bot]` OR PR has label `automerge` |
| Permissions | `pull-requests: write`, `contents: write` |

**What it does**

Runs `gh pr merge --auto --squash` which enables GitHub's native auto-merge.
The PR will only be merged when:

- all required status checks pass, **and**
- the required number of approvals is reached.

The workflow itself does **not** merge the PR — it only *enables* auto-merge.
GitHub handles the actual merge according to branch-protection rules.

If `gh pr merge --auto` fails (e.g., branch protection is not set up yet), the
step exits with code 0 (skipped gracefully) so the workflow does not fail noisily.

---

### `.github/workflows/setup-labels.yml`

A one-time (or on-demand) workflow you can run manually:

```
Actions → Setup repository labels → Run workflow
```

It creates / updates all the lifecycle labels defined in
[Labels reference](../CONTRIBUTING.md#6-labels-reference).

---

## Troubleshooting

### Copilot doesn't appear in the assignees list

- Verify that the **GitHub Copilot coding agent** feature is enabled in your
  plan settings.
- Visit `https://github.com/settings/copilot` (personal) or the org-level
  Copilot settings page.
- Ensure the repository is eligible (public repositories + free personal plans
  may have different entitlements — check the [pricing page](https://github.com/features/copilot)).

### The workflow posted a fallback comment

The API returned a non-200 status when trying to assign `copilot`. The most
common reasons:

1. Copilot coding agent not enabled for this repo / account.
2. The `GITHUB_TOKEN` does not have sufficient scope (should not happen with
   `issues: write`, but check the workflow logs).
3. GitHub API outage or rate-limiting (transient — re-apply the label to retry).

### Auto-merge is not kicking in

1. Confirm **Allow auto-merge** is enabled:  
   **Settings → General → Pull Requests → Allow auto-merge**.
2. Confirm branch protection is set on `main` with required checks / approvals.
3. Check that the PR is not in **draft** state — auto-merge will queue but only
   trigger once the PR is marked ready for review.

### How do I re-trigger Copilot assignment after a failure?

Remove the `status: accepted` label from the issue and re-apply it.  
The workflow triggers on the `labeled` event, so removing + re-adding the label
fires it again.

---

## Security considerations

- The `GITHUB_TOKEN` used by the workflows is **scoped to the repository** and
  expires at the end of each workflow run.
- No external services or secrets are required beyond `GITHUB_TOKEN`.
- The acceptance gate (only maintainers can apply `status: accepted`) relies on
  GitHub's built-in **collaborator permissions**: only users with Write access or
  higher can apply labels, which is enforced by GitHub natively.
- Bot-originated `labeled` events are filtered out by the
  `sender.type == 'User'` condition to prevent accidental automation loops.
