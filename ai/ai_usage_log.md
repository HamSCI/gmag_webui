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
- **Git Hash**: b212b60

## [2026-06-24 17:24 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Implement the tabbed multiple-data-source interface (issue #21), Phase B, on top of the per-source session refactor. Built the tab bar — add / switch / close tabs, per-tab connection-status dots, live rename, a 6-source performance cap, and an always-at-least-one-tab rule. All tabs stay connected and keep buffering in the background; only the active session renders to the shared plots/spreadsheet/trends; switching re-renders from the active session; rotation is per-tab. Also fixed a tab-switch rendering bug where a previous source's axis ranges, range slider, and WebGL traces lingered when switching to another source — root cause was Plotly mutating the shared layout object's nested axis objects with computed ranges; fixed by deep-cloning the layout on each draw, using purge + newPlot on reset, and keying uirevision to the active source.
- **Sections/Files Affected**: `index.html` (replaced the commented tabber scaffold with the live tab bar markup), `css/index.css` (tab bar styling; wordmark no longer flex-grows), `js/index.js` (tab management: render/add/switch/close + per-tab status; background-buffering reading routing; active-session redraw with deep-cloned per-source layout, purge+newPlot, and per-source uirevision)
- **Nature of Contribution**: Code generation (feature + bug fix)
- **Human Review Status**: Reviewed and verified (create/switch/close multiple tabs, two independent live sources with background buffering, persistence + reconnect-all on reload, and a clean switch to an empty source — all verified via headless browser against two local fake hosts)
- **Git Hash**: 66813ae

## [2026-07-06 19:34 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Finish delta-B (issue #23) and dB/dt (issue #29), plus a magnitude-filter correctness fix and a spreadsheet header-alignment polish. (1) #23: reworked delta-B to a fixed snapshot baseline — Constant uses the typed ΔH/ΔE/ΔZ; Moving Average snapshots the current trailing moving average at Save — so applyDeltaB is an O(1) fixed subtraction. This fixes the earlier moving-dB overlay-cancels-to-0 bug and the O(N²·W) slowdown. Made usesDeltaB numeric, added a Reset (absolute) control, and made updateCoordGraphs always restyle H/E/Z + magnitude. (2) #29: compute dB/dt via real Δt in nT/s from the rotated raw magnitude (baseline-independent); show it in the Current Reading and as a spreadsheet column toggled by "Show dB/dt". (3) Magnitude-filter correctness: the moving-average overlay's magnitude now smooths the displayed magnitude (average of the per-sample magnitudes) rather than the magnitude of the averaged vector, so it tracks the raw scatter under delta-B; H/E/Z keep the vector average. (4) Spreadsheet polish: reserve the scrollbar gutter on the header and body so column labels stay centered over the data when the body scrolls.
- **Sections/Files Affected**: `js/index.js` (delta-B snapshot baseline + O(1) applyDeltaB, Reset handler, updateCoordGraphs, dB/dt via real Δt, spreadsheet dB/dt column, magnitude filter via avg-of-magnitudes), `js/filter.js` (new trailingScalarMean helper), `index.html` (Reset (absolute) button, dB/dt table header), `css/index.css` (dB/dt column show/hide, scrollbar-gutter alignment for the fixed header + scrolling body)
- **Nature of Contribution**: Code generation (features + bug fixes)
- **Human Review Status**: Reviewed and verified (delta-B constant/moving, no overlay cancellation, reset, dB/dt value + column toggle, magnitude filter tracking the raw scatter, and header/data column alignment all verified via headless browser plus a numeric check against the real filter code; author confirmed the alignment fix)
- **Git Hash**: 34a998d

## [2026-07-07 15:15 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Make historical .log file import performant at full-day size (86,400 rows) for issue #15. Two changes: (1) replaced the O(N·W) trailing moving-average recompute with an O(N) sliding-window running-sum pass (`slidingWindowMeans`), eliminating the per-point re-summation and transient-object GC churn that dominated a day-size load; (2) virtualized the spreadsheet so only the visible row window (plus overscan) is in the DOM, with off-screen height reserved by spacer `<tr>`s and a single shared date formatter — so import populates the table instantly instead of building 86,400 DOM rows. Together these cut the full import (filter on) from ~44s to ~3.2s. `loadLogFile` now populates the spreadsheet; the filter is applied across the whole file and the plot range spans the whole dataset (goals #1–#3).
- **Sections/Files Affected**: `js/filter.js` (new `slidingWindowMeans` O(N) helper), `js/index.js` (`recomputeFiltered` single-pass rewrite; spreadsheet virtualization — `spacerRow`/`windowRows`/`renderSpreadsheet`/`resetSpreadsheet`, rewritten `rebuildSpreadsheet`/`addSpreadsheetRow`, shared `DATE_FMT`, scroll handler; `loadLogFile`/`renderActive`/`clearActiveView` repointed at the virtualized renderer), `css/index.css` (`.stripe`-class striping and `.spacer` rows for the virtualized body)
- **Nature of Contribution**: Code generation (performance optimization)
- **Human Review Status**: Reviewed and verified (86,400-row import measured at ~3.2s with 35 DOM rows; filter=86,400 points, range=24h; scroll top/mid/bottom show newest/midday/oldest with the body bounded to 325px; live WebSocket path prepends newest-first and updates the Current Reading — all verified via headless Chromium against a day-size log and a fake WS host)
- **Git Hash**: eb039f3

## [2026-07-08 20:34 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Implement light and dark theme support (issue #16). Wired the previously inert footer toggle into a full theming system: added a `theme` preference ("system"/"light"/"dark") to settings with migration, defaulting to the OS `prefers-color-scheme` until the user flips the toggle (then their explicit choice persists to localStorage and is restored on load). Tokenized the CSS into semantic color-pair variables with dark and light palettes, added an anti-flash inline `<head>` script that sets the theme before first paint, and made the Plotly charts (main + sparklines) re-theme their backgrounds/grids/font on toggle without rebuilding traces or losing the axis range. Light theme uses a dark brushed-silver (gunmetal) chrome so the white logo, light chrome text, and the colored connection-status indicator (incl. the yellow "Failed" state) stay readable; the table header uses a matching solid gunmetal; config inputs get a border/tint so they stand out on the light panel. Also fixed the Trends sparklines not filling their container (removed the hardcoded layout height so they autosize like the main plot) and vertically centered the footer theme toggle.
- **Sections/Files Affected**: `css/index.css` (semantic token pairs + dark/light palettes; tokenized chrome/surfaces/inputs/tabs; gunmetal light chrome + solid gunmetal table header; centered footer toggle), `index.html` (anti-flash inline theme script), `js/index.js` (settings.theme default + migration; resolveTheme/applyTheme; toggle + matchMedia wiring; plotTheme/themeLayout/retintPlots and layout injection), `js/data/sparklines.json` (removed fixed height so sparklines autosize)
- **Nature of Contribution**: Code generation (feature)
- **Human Review Status**: Reviewed and verified (OS-default resolution for dark/light, toggle flips + persists, explicit choice overrides OS on reload, charts/spreadsheet/chrome re-theme with 86,400-row data loaded with no trace/range loss, yellow "Failed" status readable on gunmetal chrome, sparklines fill container — all verified via headless Chromium with screenshots; author confirmed the visual result)
- **Git Hash**: e7a35e8
