set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# Show available recipes.
help:
  @echo "Available just recipes:"
  @just --list

# Install all dependencies.
prepare:
  @echo "==> Installing dependencies (bun)"
  @bun install

# Run Electron app in development mode.
dev:
  @echo "==> Starting Electron dev"
  @bun run dev

# Run only the renderer dev server (no Electron).
dev-web:
  @echo "==> Starting web dev server"
  @bunx vite --config vite.renderer.config.mts

# Build for production (typecheck + Electron Forge package).
build:
  @echo "==> Building production bundle"
  @bun run build

# Package desktop app with Electron Forge.
package:
  @echo "==> Packaging desktop app"
  @bun run package

# Preview renderer production assets locally.
preview:
  @echo "==> Starting web preview server"
  @bunx vite build --config vite.renderer.config.mts
  @bunx vite preview --config vite.renderer.config.mts

# Run type checking.
check:
  @echo "==> Type-checking (tsc)"
  @bun run typecheck

# Check architecture import boundaries with baseline tolerance.
arch-check *args:
  @echo "==> Checking architecture import boundaries"
  @bun scripts/check_import_boundaries.ts {{args}}

# Run all test suites.
test: test-unit test-electron-smoke

# Run unit tests with vitest.
test-unit:
  @echo "==> Running unit tests"
  @bun run test:unit

# Build production artifacts required by Electron smoke tests.
test-electron-smoke-prepare:
  @echo "==> Building artifacts for Electron smoke tests"
  @bun run build:inject
  @bun run build:app

# Run Electron smoke tests with Playwright.
test-electron-smoke: test-electron-smoke-prepare
  @echo "==> Running Electron smoke tests"
  @bunx playwright test tests/electron/

# Run Electron smoke tests in headless Linux (xvfb).
test-electron-smoke-headless: test-electron-smoke-prepare
  @echo "==> Running Electron smoke tests (headless)"
  @xvfb-run -a bunx playwright test tests/electron/

# Validate package version against EXPECTED_VERSION (supports vX.Y.Z or X.Y.Z).
release-verify-tag:
  @if [ -z "${EXPECTED_VERSION:-}" ]; then echo "EXPECTED_VERSION is required, e.g. EXPECTED_VERSION=v0.1.1 just release-verify-tag"; exit 1; fi
  @echo "==> Validating release tag ${EXPECTED_VERSION}"
  @bun scripts/check_version_tag.ts --expected-version "${EXPECTED_VERSION}"

# Remove build artifacts.
clean:
  @echo "==> Cleaning build artifacts"
  @rm -rf dist dist-electron release .vite out
