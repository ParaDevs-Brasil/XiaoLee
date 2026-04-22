.PHONY: dev build-docker run-docker test-backend test-anchor e2e-tests

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
