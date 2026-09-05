.PHONY: run build lint lint-ci typecheck check-comments

run:
	npm run dev

build:
	npm run build

# eslint doesn't type-check — without this, a type error only surfaces at
# `next build` (the Docker image build), which CI only runs when publishing
# to main, so a broken PR would go green. Kept alongside lint here to catch it.
typecheck:
	npm run typecheck

lint: check-comments typecheck
	npm run lint

# Same as lint — eslint never auto-fixes here (no --fix in the script), so
# there's no separate check-only variant to write.
lint-ci: check-comments typecheck
	npm run lint

# CLAUDE.md bans "Stage N" numbering and "currently mocked"-style comments —
# they describe transient state that goes stale once the stage/mock is gone
# and nobody comes back to update it. Enforced here instead of relying on
# remembering the rule while writing each comment.
check-comments:
	@matches=$$(grep -rnE "Stage [0-9]|currently mocked" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=out . 2>/dev/null); \
	if [ -n "$$matches" ]; then \
		echo "$$matches"; \
		echo "Found stale-state comments (Stage N / currently mocked) — see CLAUDE.md's code-comment rules"; \
		exit 1; \
	fi
