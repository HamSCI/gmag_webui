---
paths:
  - "**/*.js"
  - "**/*.ts"
  - "**/*.mjs"
  - "deno.json"
  - "deno.lock"
  - "package.json"
  - "package-lock.json"
---

# JavaScript / TypeScript Code Guidelines

These rules apply to all `.js`, `.ts`, and related configuration files in this project.

## General Principles
- Follow the existing code structure — do not introduce new abstractions without need
- Maintain consistency with the existing code style (indentation, naming conventions, module patterns)
- Do not commit secrets, credentials, or sensitive configuration — use environment variables or config files that are gitignored

## Deno-Specific
- This project uses Deno as the runtime — follow Deno import and module conventions
- Update `deno.json` imports map when adding new dependencies
- Prefer vendoring dependencies locally per project convention (see `vendor/`)

## Commits
- Use `[AI-assisted]` prefix for commits whose content was produced or substantially shaped with AI assistance
- Reference issue numbers in commit messages when applicable (e.g., "closes #N")
- Always ask before pushing to any remote
- Stage specific files with `git add <file>` rather than `git add -A` or `git add .`

## Documentation
- Document non-obvious design decisions in code comments or the `docs/` directory
- Apply the project's open-source license consistently (see `LICENSE` at root)
