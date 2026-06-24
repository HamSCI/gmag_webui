# AI Usage Log — gmag_webui

This log records all substantive AI-assisted sessions for the project
"HamSCI Ground Magnetometer Web UI".

Required per University of Scranton AI Policy, HamSCI Generative AI Use Agreement, NASA AI guidance, NSF AI guidance, and NSF grants AGS-2432821, AGS-2432822, AGS-2432823, AGS-2432824 expectations.

---

<!-- Append new entries below this line, newest at the bottom. Use the format produced by the /commit command. -->

## [2026-06-17 13:04 EDT]
- **Tool**: Claude (Anthropic), claude-sonnet-4-6
- **Session Purpose**: Initial setup of AI governance infrastructure on the feature-ai branch. Adapted the w2naf-academia/ai_project_template scaffold to this project: created CLAUDE.md with project metadata, .claude/settings.json, .claude/commands/commit.md (/commit workflow), .claude/rules/ai-governance.md (policy compliance), .claude/rules/js-code.md (JavaScript/TypeScript guidelines), ai/ai_usage_log.md (this file), and updated .gitignore with Claude Code local-state exclusions.
- **Sections/Files Affected**: `CLAUDE.md`, `.claude/settings.json`, `.claude/commands/commit.md`, `.claude/rules/ai-governance.md`, `.claude/rules/js-code.md`, `ai/ai_usage_log.md`, `.gitignore`
- **Nature of Contribution**: Configuration / scaffolding
- **Human Review Status**: Reviewed and verified
- **Git Hash**: 6aba623

## [2026-06-17 13:43 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Document the gmag_webui GitHub project board in the README, and install/authenticate the gh CLI (incl. project scopes) to enable direct interaction with project board #7.
- **Sections/Files Affected**: `README.md` (added "Project Management" section linking to the HamSCI project board)
- **Nature of Contribution**: Documentation
- **Human Review Status**: Reviewed and verified
- **Git Hash**: fa7694d

## [2026-06-22 14:26 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Implement moving-average filtering (GitHub issue #24, FR-DP-04). Added a trailing, time-based moving-average filter with a configurable window (10s/30s/60s) and on/off toggle, overlaying smoothed H/E/Z/Magnitude/Temperature traces on faded raw data; handles data gaps gracefully. Also fixed a pre-existing ReferenceError in the magclose reset path (undefined mainTraces/slTraces) that my trace changes interacted with.
- **Sections/Files Affected**: `js/filter.js` (new — trailing moving-average algorithm), `js/filter_test.js` (new — 5 unit tests), `js/data/plots.json` (5 overlay traces), `index.html` (Moving Average controls), `js/index.js` (settings + migration, overlay recompute/append/visibility, control wiring, file-upload + magclose-reset integration)
- **Nature of Contribution**: Code generation (feature implementation + bug fix)
- **Human Review Status**: Reviewed and verified (unit tests pass; serve/asset smoke test passes; live UI against a magnetometer host not yet exercised)
- **Git Hash**: a120f52

## [2026-06-22 15:57 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Fix and improve the dashboard's right-column / spreadsheet layout and the moving-average filter's persistence. (1) Bounded the page to the viewport so it no longer scrolls/breaks, and made the spreadsheet fill its box and scroll internally. (2) Replaced the recoiling sticky table header with a static header over an independently scrolling body, with aligned columns. (3) Made the spreadsheet reflect coordinate-rotation changes across all existing rows (not just new ones). (4) Kept the Date column on one line and widened the right column so values stay readable. (5) Fixed the moving-average overlay not showing after a page refresh when the filter was enabled in localStorage.
- **Sections/Files Affected**: `css/index.css` (viewport/grid bounding, static header + scrolling body, date column, wider right column, spreadsheet spacing), `index.html` (explicit header `<tr>`), `js/index.js` (spreadsheetRowHTML / rebuildSpreadsheet on rotation save; apply saved filter state on load)
- **Nature of Contribution**: Code generation + bug fixes (with some manual edits by the author to spacing)
- **Human Review Status**: Reviewed and verified (layout, static header, column alignment, and filter-on-refresh all verified via headless-browser rendering; author confirmed visual result)
- **Git Hash**: 3403d75

## [2026-06-23 16:12 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Implement the configuration panel for connection settings (issue #20). Redesigned the config sidebar into an opaque instrument-style panel with collapsible Connection / Processing / Display sections. Built the Connection panel: source name, a WebSocket/MQTT/File source-type selector with conditional fields, a single Connect button with input validation, settings persistence to localStorage, load-on-startup, and auto-reconnect. MQTT fields are present but visual-only (live ingestion deferred to issue #19). Refactored transit.js from a cookie-based, WebSocket-only script into a connection manager (window.MagConnection) emitting the same magread/magclose/magerror events. Anchored the sidebar flush between the header and footer.
- **Sections/Files Affected**: `index.html` (redesigned `#config` sidebar markup), `css/index.css` (panel/field/segmented/button styles, panel tokens, sidebar anchored in `.layout`), `js/transit.js` (rewritten as connection manager), `js/index.js` (settings.connection default + migration, Connect handler with validation/persistence, source-type switching, collapsible panels, loadLogFile refactor)
- **Nature of Contribution**: Code generation (feature + refactor)
- **Human Review Status**: Reviewed and verified (render, collapse, type-switch, validation, WebSocket end-to-end via a fake host, persistence/auto-reconnect, and flush layout all verified via headless-browser rendering)
- **Git Hash**: cc298a0

## [2026-06-23 16:37 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Implement MQTT-over-WebSocket data ingestion (issue #19). Vendored the MQTT.js 5.15.1 browser bundle and added an MQTT transport to the connection manager: connects to a broker over WebSocket, subscribes to a topic, parses each message in the same JSONL reading format and dispatches `magread`, with optional username/password authentication and MQTT.js-driven reconnection. Wired the Connect handler to validate the broker URL and topic, and added a dedicated "Auth failed" connection status that surfaces (and stops retrying) when the broker rejects credentials. Switching between WebSocket and MQTT sources works.
- **Sections/Files Affected**: `vendor/mqtt.min.js` (new — vendored MQTT.js 5.15.1), `index.html` (load mqtt.min.js; MQTT broker/topic validation slots; removed the "coming soon" note), `js/transit.js` (MQTT transport in the connection manager, auth-failed status, teardown + auto-connect for MQTT), `js/index.js` (MQTT broker/topic validation and connect wiring)
- **Nature of Contribution**: Code generation (feature) + dependency vendoring
- **Human Review Status**: Reviewed and verified (MQTT connect/receive/render, broker+topic validation, WebSocket↔MQTT switching, no-regression on WebSocket, and authentication accept/reject — all verified via headless browser against local aedes MQTT-over-WS brokers, including a credential-required broker)
- **Git Hash**: f51c54a

## [2026-06-24 16:41 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Phase A groundwork for the tabbed multiple-data-source interface (issue #21): refactor the single-source dashboard onto a per-source "session" architecture, with full behavioral parity and no visible change yet. Converted the single global connection + data buffer into a `sources[] + activeSourceId` model where each source owns its connection config and coordinate transform, and each has one runtime session (measurement/sparkline buffers + live connection). Rewrote transit.js into a DOM-free per-source connection factory (`MagConnection.create(config, { onReading, onStatus })`); moved connection-status mapping from transit.js into index.js; readings and status route per source and only the active session renders. Added a guard so unconfigured sources don't auto-connect. Moving average and time window remain shared; rotation is now per-source.
- **Sections/Files Affected**: `js/transit.js` (rewritten as a per-source connection factory with WebSocket + MQTT transports, callback-based), `js/index.js` (sources[]/session model, settings migration from the old connection+transform shape, per-source reading/status routing, active-session rendering, status mapping, per-source rotation)
- **Nature of Contribution**: Code generation (refactor)
- **Human Review Status**: Reviewed and verified (WebSocket, MQTT, MQTT auth accept/reject, panel type-switch/collapse/validation, file load, filter overlay, per-source rotation, and persistence/auto-reconnect all verified via headless browser; single-source parity confirmed)
- **Git Hash**: [pending]
