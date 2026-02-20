# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-02-20

### Fixed

- Fix idle-status detection in inject bridge by requiring submit button readiness.

## [0.2.0] - 2026-02-17

### Added

- Add image-paste prompt flow with staged clipboard payload and readiness wait.
- Add realistic provider mock fixtures plus cross-provider chat-flow E2E coverage.
- Add quick-prompt queue timeline with round grouping and per-round controls.

### Fixed

- Fix Grok completion handling and avoid early empty completion in inject bridge polling.
- Fix quick-prompt visibility/toggle behavior and stabilize related E2E assertions.
- Fix CI headless Electron test invocation to use existing E2E recipe.

### Changed

- Refactor main-process view lifecycle into sidebar/quick-prompt/prompt-image services.
- Reorganize provider/runtime architecture and tighten import-boundary checks.
- Replace mock capture workflow with actionbook-based capture/transform tooling.

## [0.1.2] - 2026-02-15

### Added

- Add gen-docs documentation skill
- Add per-pane latest-only queue with busy-state gating
- Add prompt queue status in composer UX
- Migrate sidebar runtime to React
- Add smooth sidebar animation and blur-close quick prompt

### Fixed

- Fix gemini streaming detection with stop DOM alignment
- Fix gemini stop mat-icon as streaming indicator
- Fix gemini latest-turn status detection and submit guard
- Fix prompt first-message deadlock on non-streaming status
- Fix sidebar width tween rate for smoother transitions
- Fix network pane session isolation and diagnostics
- Fix main-process sidebar layout transitions
- Fix forge renderer index path for smoke tests
- Fix quick-prompt overlay centering in app viewport

### Changed

- Migrate runtime to src main-services and forge
- Modularize IPC handlers and runtime store
- Extract app shell stylesheet
- Remove legacy electron source leftovers

### Removed

- Remove startup proxy probe log for chatgpt

## [0.1.1] - 2024-??-??

### Added

- Initial release
