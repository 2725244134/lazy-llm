.DEFAULT_GOAL := prepare

# Use bash for predictable shell semantics across targets.
SHELL := bash
.SHELLFLAGS := -euo pipefail -c

.PHONY: help
help: ## Show available make targets.
	@echo "Available make targets:"
	@awk 'BEGIN { FS = ":.*## " } /^[A-Za-z0-9_.-]+:.*## / { printf "  %-24s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: prepare
prepare: ## Install all dependencies.
	@echo "==> Installing dependencies (bun)"
	@bun install

.PHONY: dev dev-web
dev: ## Run Electron app in development mode.
	@echo "==> Starting Electron dev"
	@bun run dev:electron
dev-web: ## Run only the Vite dev server (no Electron).
	@echo "==> Starting web dev server"
	@bun run dev

.PHONY: build
build: ## Build for production (renderer + electron).
	@echo "==> Building production bundle"
	@bun run build

.PHONY: package
package: ## Package desktop app with electron-builder.
	@echo "==> Packaging desktop app"
	@bun run package

.PHONY: preview
preview: ## Preview the production web build locally.
	@echo "==> Starting web preview server"
	@bun run preview

.PHONY: check
check: ## Run type checking.
	@echo "==> Type-checking (vue-tsc)"
	@bun run typecheck

.PHONY: test test-unit test-electron-smoke
test: test-unit ## Run all test suites.
test-unit: ## Run unit tests with vitest.
	@echo "==> Running unit tests"
	@bun run test:unit
test-electron-smoke: ## Run Electron smoke tests with Playwright.
	@echo "==> Running Electron smoke tests"
	@bun run test:electron:smoke

.PHONY: clean
clean: ## Remove build artifacts.
	@echo "==> Cleaning build artifacts"
	@rm -rf dist dist-electron release node_modules
