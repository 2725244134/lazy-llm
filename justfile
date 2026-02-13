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
  @bun run dev:electron

# Build for production (renderer + electron).
build:
  @echo "==> Building production bundle"
  @bun run build

# Package desktop app with electron-builder.
package:
  @echo "==> Packaging desktop app"
  @bun run package

# Run type checking.
check:
  @echo "==> Type-checking (tsc)"
  @bun run typecheck

# Check architecture import boundaries with baseline tolerance.
arch-check *args:
  @echo "==> Checking architecture import boundaries"
  @bun scripts/check_import_boundaries.ts {{args}}

# Run all test suites (unit + electron smoke).
test:
  @echo "==> Running unit tests"
  @bun run test:unit
  @echo "==> Building artifacts for Electron smoke tests"
  @bun run build
  @echo "==> Running Electron smoke tests"
  @bun run test:electron:smoke

# Validate package version against EXPECTED_VERSION (supports vX.Y.Z or X.Y.Z).
release-verify-tag:
  @if [ -z "${EXPECTED_VERSION:-}" ]; then echo "EXPECTED_VERSION is required, e.g. EXPECTED_VERSION=v0.1.1 just release-verify-tag"; exit 1; fi
  @echo "==> Validating release tag ${EXPECTED_VERSION}"
  @bun scripts/check_version_tag.ts --expected-version "${EXPECTED_VERSION}"

# Remove build artifacts.
clean:
  @echo "==> Cleaning build artifacts"
  @rm -rf dist dist-electron release
