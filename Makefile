.PHONY: init init-check init-backend init-frontend smoke smoke-backend smoke-frontend smoke-api lint-quick lint-quick-backend lint-quick-frontend preflight ci-local ci-local-backend ci-local-frontend dev build-docker run-docker stop-docker test-backend test-anchor e2e-tests stress-test

BACKEND_REQUIREMENTS ?= backend/requirements.docker.txt

init:
	@echo "Initializing XiaoLee project..."
	@$(MAKE) init-check
	@[ -f .env ] || cp .env.example .env
	@$(MAKE) init-backend
	@$(MAKE) init-frontend
	@echo "Done. Next steps: run 'make smoke', 'make dev' or 'make run-docker'."

init-check:
	@echo "Checking local toolchain..."
	@command -v python3 >/dev/null 2>&1 || (echo "python3 is required" && exit 1)
	@command -v node >/dev/null 2>&1 || (echo "node is required" && exit 1)
	@command -v npm >/dev/null 2>&1 || (echo "npm is required" && exit 1)
	@command -v docker >/dev/null 2>&1 || (echo "docker is required" && exit 1)
	@python3 --version
	@node --version
	@npm --version
	@docker --version
	@docker compose version

smoke:
	@echo "Running quick smoke checks..."
	@$(MAKE) smoke-backend
	@$(MAKE) smoke-frontend
	@echo "Smoke checks finished successfully."

smoke-api:
	@echo "Running API smoke checks via local HTTP..."
	@cd backend && ../.venv/bin/python scripts/smoke_api.py

smoke-backend:
	@echo "Backend smoke tests..."
	@cd backend && PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 ../.venv/bin/pytest -q tests/test_metrics.py

smoke-frontend:
	@echo "Frontend smoke tests..."
	@cd frontend && npm test -- src/utils/swap.test.ts

lint-quick:
	@echo "Running quick lint checks..."
	@$(MAKE) lint-quick-backend
	@$(MAKE) lint-quick-frontend
	@echo "Quick lint checks finished successfully."

lint-quick-backend:
	@echo "Backend quick lint..."
	@cd backend && ../.venv/bin/python -m py_compile server/app.py server/metrics.py

lint-quick-frontend:
	@echo "Frontend quick lint..."
	@cd frontend && npm run lint -- --file src/components/navbar/Wallet.tsx

preflight:
	@echo "Running preflight checks..."
	@$(MAKE) init-check
	@$(MAKE) smoke
	@$(MAKE) smoke-api
	@$(MAKE) lint-quick
	@echo "Preflight checks finished successfully."

ci-local:
	@echo "Running local CI pipeline..."
	@$(MAKE) init-check
	@$(MAKE) ci-local-backend
	@$(MAKE) ci-local-frontend
	@echo "Local CI pipeline finished successfully."

ci-local-backend:
	@echo "CI local backend: install + pytest..."
	@if [ -x .venv/bin/python ]; then \
		.venv/bin/python -m pip install -r $(BACKEND_REQUIREMENTS); \
		PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/pytest -q -p pytest_asyncio -c backend/pytest.ini backend/tests; \
	else \
		python3 -m pip install -r $(BACKEND_REQUIREMENTS); \
		PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -q -p pytest_asyncio -c backend/pytest.ini backend/tests; \
	fi

ci-local-frontend:
	@echo "CI local frontend: npm ci + lint + test + build..."
	@cd frontend && npm ci && npm run lint && npm test && npm run build

init-backend:
	@echo "Installing backend dependencies..."
	@if [ -x .venv/bin/python ]; then \
		.venv/bin/python -m pip install -r $(BACKEND_REQUIREMENTS); \
	else \
		python3 -m pip install -r $(BACKEND_REQUIREMENTS); \
	fi

init-frontend:
	@echo "Installing frontend dependencies..."
	@if [ -f frontend/package-lock.json ]; then \
		cd frontend && npm ci; \
	else \
		cd frontend && npm install; \
	fi

dev:
	@echo "Starting local dev environment (Backend & Frontend)..."
	@bash -c "cd backend && uvicorn server.app:app --reload & cd frontend && npm run dev"

build-docker:
	docker compose build

run-docker:
	docker compose up -d

stop-docker:
	docker compose down

test-backend:
	cd backend && pytest tests/

test-anchor:
	cd solana-program/xiaolee_core && anchor test

e2e-tests:
	@echo "Running E2E tests against local environment..."
	python qa/scripts/e2e_flow_simulation.py

stress-test:
	@echo "Starting Locust for stress testing..."
	locust -f qa/load_testing/locustfile.py --host=http://localhost:8000
