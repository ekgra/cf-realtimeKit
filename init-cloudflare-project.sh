#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

prompt_yes_no() {
  local prompt="$1"
  local answer

  read -r -p "$prompt [y/N] " answer || answer=""
  case "$answer" in
    y|Y|yes|YES|Yes) return 0 ;;
    *) return 1 ;;
  esac
}

default_repo_name() {
  basename "$PWD" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//'
}

ensure_gitignore_entry() {
  local entry="$1"
  local pattern="$2"

  touch .gitignore
  if ! grep -Eq "$pattern" .gitignore; then
    printf '%s\n' "$entry" >> .gitignore
  fi
}

mkdir -p \
  context/archive \
  docs/specs/mvp \
  docs/diagrams/sequences \
  docs/diagrams/issues \
  docs/adr \
  docs/issues \
  .opencode/skills

if [ ! -f context/compact.md ]; then
  cat > context/compact.md <<'EOF'
# Project Context Handoff

## Purpose

## Current State

## Repo Layout

## Decisions

## Validation

## PRDs / Specs

## Open Questions
EOF
fi

if [ ! -f context/compact-delta.md ]; then
  cat > context/compact-delta.md <<'EOF'
# Compact Delta

Current state:
- Reset after latest context compaction.
- Add new entries below in this format:

## YYYY-MM-DD HH:MM TZ
- Issue: #123 or none
- Change:
- Files:
- Validation:
EOF
fi

if [ ! -f README.md ]; then
  project_name="$(basename "$PWD")"
  cat > README.md <<EOF
# $project_name

## Overview

Briefly describe what this project is, who it serves, and its current product status.

## Quick Start

Add the minimal install, configuration, run, and smoke-check commands for this repo.

## Documentation Map

- PRD: \`docs/specs/mvp/PRD.md\`
- ADRs: \`docs/adr/\`
- Architecture diagram: \`docs/diagrams/architecture.svg\`
- Main sequence diagram: \`docs/diagrams/sequences/main-flow.puml\`
- Issues: GitHub issues or \`docs/issues/\`

## Architecture

Summarize the major runtime boundaries, storage systems, integrations, and deployment environments. Link or embed the rendered architecture diagram when available.

## Core Workflows

Summarize the primary user/system workflows. Link sequence diagrams when available.

## Environments

Describe \`dev-local\`, \`dev-remote\`, \`staging\`, and optional \`production\` usage for this project.

## Configuration

List required environment variables, Cloudflare bindings, secrets, Wrangler environments, and where they are configured.

## Development

Document useful commands, repo layout, coding conventions, and where feature work starts.

## Testing And Validation

Document repo-confirmed test, build, runtime, E2E, smoke, and quality-gate commands.

## Operations

Document logging, observability, debugging, smoke checks, rollback, and recovery notes.

## Decisions

Link important PRDs and ADRs. Keep decision rationale in the source artifacts.

## Current Status / Roadmap

Summarize the current milestone, implemented slices, known gaps, and next planned work.
EOF
fi

touch \
  docs/specs/mvp/.gitkeep \
  docs/diagrams/sequences/.gitkeep \
  docs/diagrams/issues/.gitkeep \
  docs/adr/.gitkeep \
  docs/issues/.gitkeep \
  context/archive/.gitkeep

ensure_gitignore_entry "AGENTS.md" '^AGENTS\.md$'
ensure_gitignore_entry ".opencode/" '^\.opencode/?$'

required_paths=(
  ".opencode/skills/grill-me-enhanced/SKILL.md"
  ".opencode/skills/to-issues/SKILL.md"
  ".opencode/skills/observability/SKILL.md"
  ".opencode/skills/test-strategy/SKILL.md"
  ".opencode/skills/tdd/SKILL.md"
  ".opencode/skills/integration-testing/SKILL.md"
  ".opencode/skills/worker-runtime-testing/SKILL.md"
  ".opencode/skills/e2e-playwright/SKILL.md"
  ".opencode/skills/smoke-testing/SKILL.md"
  ".opencode/skills/test-debugging/SKILL.md"
  ".opencode/skills/quality-gate/SKILL.md"
)

missing=()
for path in "${required_paths[@]}"; do
  if [ ! -f "$path" ]; then
    missing+=("$path")
  fi
done

if [ ! -f AGENTS.md ]; then
  echo "Warning: AGENTS.md not found in target project root."
  echo "Install the Cloudflare agent instructions before starting agent-driven project work."
  echo
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_initialized=true
else
  git_initialized=false
  echo "Warning: target project is not inside an initialized Git worktree."
  echo "Initialize Git before relying on PRD/history, context archives, or issue evidence workflows."
  if prompt_yes_no "Initialize Git with main branch now?"; then
    if git init -b main >/dev/null 2>&1; then
      :
    else
      git init >/dev/null
      git branch -M main >/dev/null 2>&1 || true
    fi
    git_initialized=true
    echo "Initialized Git repository."
  else
    echo "Skipping Git initialization. Remote repo creation cannot continue until Git is initialized."
  fi
  echo
fi

if [ "$git_initialized" = true ]; then
  if git ls-files --error-unmatch AGENTS.md >/dev/null 2>&1 || [ -n "$(git ls-files .opencode 2>/dev/null)" ]; then
    echo "Warning: AGENTS.md and/or .opencode are already tracked by Git."
    echo ".gitignore will not untrack existing files. To untrack them safely, run:"
    echo "  git rm --cached AGENTS.md -r .opencode"
    echo
  fi

  if git remote >/dev/null 2>&1 && [ -n "$(git remote)" ]; then
    echo "Git remotes already configured:"
    git remote -v
    echo
  else
    echo "Warning: target project has no Git remote configured."
    echo "Configure a remote before relying on GitHub issue, PR, and durable evidence workflows."
    if prompt_yes_no "Create a public GitHub repo and add it as origin?"; then
      if ! command -v gh >/dev/null 2>&1; then
        echo "Error: gh is not installed. Install GitHub CLI or add a remote manually."
        exit 3
      fi

      gh_login="$(gh api user --jq .login 2>/dev/null || true)"
      if [ -z "$gh_login" ]; then
        echo "Error: GitHub CLI is not authenticated."
        echo "Run: gh auth login -h github.com"
        echo "Then rerun this initializer."
        exit 3
      fi

      echo "GitHub CLI is logged in as: $gh_login"
      if ! prompt_yes_no "Create public repo under this GitHub account?"; then
        echo "Switch GitHub accounts manually, then rerun this initializer:"
        echo "  gh auth login -h github.com"
        exit 3
      fi

      suggested_repo_name="$(default_repo_name)"
      if [ -z "$suggested_repo_name" ]; then
        suggested_repo_name="cloudflare-project"
      fi

      read -r -p "GitHub repo name [$suggested_repo_name]: " repo_name || repo_name=""
      repo_name="${repo_name:-$suggested_repo_name}"
      repo_full_name="$gh_login/$repo_name"

      if prompt_yes_no "Create public GitHub repo $repo_full_name?"; then
        gh repo create "$repo_full_name" --public
        git remote add origin "git@github.com:$repo_full_name.git"
        echo "Added origin: git@github.com:$repo_full_name.git"
        echo
        echo "Next steps:"
        echo "  git status"
        echo "  git add ."
        echo "  git commit -m \"Initial project scaffold\""
        echo "  git push -u origin main"
      else
        echo "Skipped GitHub repo creation."
      fi
    fi
    echo
  fi
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing required OpenCode agent/skill files:"
  printf '  - %s\n' "${missing[@]}"
  echo
  echo "Install or copy these before starting the GME -> PRD -> issues -> implementation workflow."
  exit 2
fi

if ! command -v d2 >/dev/null 2>&1; then
  echo "Warning: d2 not found. D2 diagram sources can be written, but rendering will be unavailable."
fi

if ! command -v plantuml >/dev/null 2>&1; then
  echo "Warning: plantuml not found. PUML sequence sources can be written, but rendering will be unavailable."
fi

echo "Project scaffolding initialized."
