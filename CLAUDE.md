# gmag_webui

## Project Overview
A real-time web dashboard for the HamSCI Ground Magnetometer network. The dashboard connects to a [mag-usb](https://github.com/wittend/mag-usb) host via WebSocket, receives live magnetometer readings, and renders interactive time-series plots using Plotly.js. It is served via Deno inside a Docker container and is intended for use by amateur radio operators and citizen scientists participating in the HamSCI network to monitor geomagnetic activity.

**PI**: Dr. Nathaniel Frissell (W2NAF), University of Scranton  
**Collaborators**: HamSCI community  
**Funder**: NSF AGS-2432821, AGS-2432822, AGS-2432823, AGS-2432824  
**Project period**: January 1, 2025 – December 31, 2028

## Project Goal
Develop and maintain a browser-based dashboard that displays real-time ground magnetometer data for the HamSCI citizen science network. The dashboard connects to a mag-usb WebSocket host, renders live time-series charts, and is deployable via Docker for easy setup by network participants.

## Repository Structure

```
gmag_webui/
├── CLAUDE.md
├── README.md
├── .gitignore
├── .claude/
│   ├── settings.json
│   ├── commands/commit.md        ← /commit workflow
│   └── rules/
│       ├── ai-governance.md
│       └── js-code.md            ← JavaScript/TypeScript rules
├── ai/
│   └── ai_usage_log.md           ← mandatory AI session log
├── index.html                    ← main dashboard page
├── js/                           ← JavaScript source files
├── ts/                           ← TypeScript source files
├── css/                          ← stylesheets
├── vendor/                       ← vendored dependencies (Plotly.js, Font Awesome)
├── docs/
├── images/
├── Dockerfile
├── compose.yaml
├── config.toml
└── deno.json
```

## Submodules
This project currently has no submodules. If any are added in the future:
1. Make changes and commit **inside** the submodule first
2. Then commit the updated submodule pointer in this repo
3. Always use `[AI-assisted]` prefix on commits made with AI assistance
4. Ask before pushing to any remote

The `/commit` workflow auto-detects submodules via `git submodule status`.

## AI Governance
All AI-assisted work must comply with the policies in `.claude/rules/ai-governance.md`.
Every substantive AI session must be logged in `ai/ai_usage_log.md` before committing.
Use the `/commit` command to handle logging and committing in the correct order.
