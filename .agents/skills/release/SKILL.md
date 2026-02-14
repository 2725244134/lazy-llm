---
name: release
description: Execute the release workflow for LazyLLM desktop application.
type: flow
---

```d2
understand: |md
  Understand the release automation by reading AGENTS.md and
  .github/workflows/validate-tag.yml.
|
check_changes: |md
  Check for changes since the last release (by git tag). Look for changes in:
  - Root package (src/, package.json, forge.config.ts, etc.)
  - packages/shared-config/
  - packages/shared-contracts/
|
has_changes: "Any changes since last release?"
confirm_version: |md
  Confirm the new version with the user. Follow the project versioning policy:
  - patch: bug fixes and small improvements
  - minor: new features and backwards-compatible changes
  - major: breaking changes (requires explicit manual decision)
  Current version is read from package.json.
|
update_version: |md
  Update package.json version to the new version.
|
update_changelog: |md
  Update or create CHANGELOG.md with the new release. Keep an Unreleased header
  for unreleased changes. Follow keepachangelog format:
  https://keepachangelog.com/en/1.1.0/
|
new_branch: |md
  Create a new branch `bump-v<new-version>`.
|
open_pr: |md
  Commit all changes, push to remote, and open a PR with gh describing the
  updates. Use conventional commit format.
|
monitor_pr: "Monitor the PR until it is merged."
post_merge: |md
  After merge, switch to main, pull latest changes, and tell the user the git
  tag command needed for the final release tag (they will tag + push tags).
  Remind them to run: EXPECTED_VERSION=vX.Y.Z just release-verify-tag
|


BEGIN -> understand -> check_changes -> has_changes
has_changes -> END: no
has_changes -> confirm_version: yes
confirm_version -> update_version -> update_changelog -> new_branch -> open_pr -> monitor_pr -> post_merge -> END
```
