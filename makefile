# Makefile

.PHONY: all backend frontend

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
