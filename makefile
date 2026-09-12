# Makefile

.PHONY: all backend frontend dev dev-backend dev-frontend serve

# By default, build both back- and front-end
all:
	@$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

# Build Rust backend
backend:
	cd backend && \
	cargo build --release

# Build React/Vite frontend
frontend:
	cd frontend && \
	npm run build

# Run backend in dev mode (cargo run, debug build)
dev-backend:
	cd backend && \
	cargo run

# Run frontend in dev mode (Next.js dev server)
dev-frontend:
	cd frontend && \
	npm run dev

# Run both frontend and backend dev servers together; Ctrl+C stops both
dev:
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) dev-backend & \
	$(MAKE) dev-frontend & \
	wait

# Build the frontend for production, then serve the static export and run
# the release backend together; Ctrl+C stops both
serve: frontend backend
	@trap 'kill 0' EXIT INT TERM; \
	(cd frontend && npm run serve) & \
	./backend/target/release/artisan_dashboard & \
	wait
