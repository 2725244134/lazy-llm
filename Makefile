.PHONY: prepare dev build package check test test-electron-smoke clean

# One-time setup
prepare:
	bun install

# Daily development
dev:
	bun run dev:electron

# Type checking and linting
check:
	bun run typecheck

# Run tests
test:
	bun run test

# Electron smoke test
test-electron-smoke:
	bun run test:electron:smoke

# Build for production
build:
	bun run build

# Package desktop app
package:
	bun run package

# Clean build artifacts
clean:
	rm -rf dist dist-electron release node_modules
