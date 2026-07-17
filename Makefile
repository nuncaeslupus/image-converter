.PHONY: install dev build preview test test-watch test-build lint format format-check typecheck ci clean

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

test:
	npm test

test-watch:
	npm run test:watch

test-build:
	npm run test:build

lint:
	npm run lint

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

# Full local gate: everything CI runs, in one command.
ci: lint typecheck test test-build

clean:
	rm -rf dist node_modules
