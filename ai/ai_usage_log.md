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

## [2026-07-08 21:27 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Fix the time-series panning so autofollow disengages when the user drags the Plotly range slider. Previously the plot's `plotly_relayout` handler only detected drag/zoom inside the plot body (`xaxis.range[0]`/`[1]`), so a range-slider drag (which emits `xaxis5.range`, the slider's bottom axis) left autofollow on and the view snapped back to the trailing window on the next reading. Broadened the handler to also treat a slider drag as a user pan, distinguishing it from the app's own `updateRange()` (which sets every axis, so its asynchronously-delivered event includes `xaxis.range`) to avoid self-disabling autofollow during live updates; also wrapped the one remaining unguarded `updateRange()` (time-window change) in `updateLock`.
- **Sections/Files Affected**: `js/index.js` (`plotly_relayout` handler in `attachPlotHandlers`: added `userSlider` detection alongside the existing `userZoom`; `updateLock` guard on the time-window `updateRange()`)
- **Nature of Contribution**: Code generation (bug fix)
- **Human Review Status**: Reviewed and verified (headless Chromium against a live fake host: autofollow still tracks live data when on; the range slider's exact event shape disables autofollow with no snap-back; a real mouse-drag run also held the view; range-slider event key confirmed empirically as `xaxis5.range`; zoom and double-click paths unchanged)
- **Git Hash**: 377f42a

## [2026-07-09 17:16 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Implement automated tests for critical functionality (issue #26) and wire up CI. Expanded the author's `js/tests.js` starter into a 28-case Deno test suite covering the critical calculations: XYZ→HEZ conversion, coordinate rotation (`Vector.rotate` in degrees + radians, magnitude preservation), delta-B/scale, magnitude, JSON Lines parsing into a `Measurement` (fields, HEZ, UTC timestamp, constructor type-rejection), JSONL/CSV export formatting + round-trip, sparkline data-buffer aggregation (`reduceBucket`/`minMaxOfBucket`), and both the trailing and O(N) `slidingWindowMeans` moving-average paths (including an equivalence check). Added a `deno task test` command so the suite runs with one command, removed the now-redundant `js/filter_test.js` (superseded by `tests.js`), and added a GitHub Actions workflow that runs `deno lint` + the tests on every push/PR. Cleaned up the two remaining lint findings that would have failed CI: typed the `onReading` handler in `index.d.ts` (replacing `Function`) and dropped an unnecessary `async` on the `Deno.serve` handler in `main.ts`. (Separately, the author's own lint cleanup to `index.js`/`transit.js` was committed on its own beforehand.)
- **Sections/Files Affected**: `js/tests.js` (new tests for rotation/export/buffers/parsing/sliding-window), `deno.json` (`test` task), `js/index.d.ts` (`onReading` typed signature), `ts/main.ts` (removed unused `async`), `.github/workflows/ci.yml` (new CI: lint + test), `js/filter_test.js` (removed — superseded)
- **Nature of Contribution**: Code generation (tests + CI) and minor type/lint fixes
- **Human Review Status**: Reviewed and verified (all 28 tests pass via `deno task test`; `deno lint js/ ts/` clean across 9 files; `deno check ts/main.ts` clean; CI steps mirror the local commands)
- **Git Hash**: 35c97c2

## [2026-07-09 20:22 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Make the Trends sparklines account for the active source's coordinate rotation (and delta-B), which they previously ignored — they rendered raw HEZ and never refreshed when the transform changed, so they disagreed with the main plot. Introduced a single `displayHEZ(m)` helper (rotation + delta-B baseline) as the shared source of truth for what gets plotted, made `buildSparklineTraces` take that display-mapper so the H/E/Z/magnitude rows mirror the main plot, and added a `refreshSparks()` call to the Save Rotation / Save dB / Reset dB handlers so the sparklines update on any transform change. Also DRY'd `buildSparklineTraces` (5 duplicated line+marker literal pairs → a `row()` helper) and reused `displayHEZ` across the live trace append, current-reading, and spreadsheet-row paths (collapsing four copies of the rotate-then-maybe-deltaB pattern).
- **Sections/Files Affected**: `js/sparklines.js` (`buildSparklineTraces(sparklines, toDisplay)` + `row()` helper, empty-guard), `js/index.js` (new `displayHEZ`; `updateSparks` passes it; new `refreshSparks` wired into rotation/delta-B handlers; `displayHEZ` reused in `extendAllTraces`/`updateCurrentTable`/`spreadsheetRowHTML`)
- **Nature of Contribution**: Code generation (bug fix + refactor)
- **Human Review Status**: Reviewed and verified (`deno lint` clean; 28 tests pass; headless check: a 90° Z-rotation transforms the sparkline rows correctly — H→−E, E→H — and the sparkline H matches the main-plot H, with no page errors)
- **Git Hash**: 8531f7e

## [2026-07-09 22:24 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Enhance the Trends sparklines. Wired the previously-unused `minMaxOfBucket` into a translucent min/max envelope band behind each average line (so short excursions aren't averaged away by the bucket mean); the band is drawn in display space through `displayHEZ` so it respects rotation/delta-B, exact for the linear H/E/Z rows and an average-enclosing approximation for the nonlinear magnitude row. Reworked the rows to H/E/Z/Magnitude (dropped temperature; magnitude replaces it), added per-row text labels (accessibility, not color-only), switched the traces from WebGL `scattergl` to lighter SVG `scatter`, hid the y-axis tick numbers, and laid the four panels out as a 2×2 grid with tightened inter-panel gaps. Repositioned the Trends box to sit between Current Reading and the Spreadsheet at 15% of the right column (to set up a later layout change). `ingest` now stores a per-bucket `{avg, lo, hi}` aggregate.
- **Sections/Files Affected**: `js/sparklines.js` (`buildSparklineTraces` min/max band + average + marker, H/E/Z/Mag rows, band encloses the average), `js/index.js` (`ingest` stores `{avg, lo, hi}`, imports `minMaxOfBucket`), `js/data/sparklines.json` (2×2 grid, SVG scatter, per-row labels, hidden y-ticks, tightened gaps), `js/index.d.ts` (`SparkAgg` typedef), `css/index.css` (Trends slice 15%, reordered below Current Reading), `index.html` (moved the Trends block above the Spreadsheet)
- **Nature of Contribution**: Code generation (feature + layout)
- **Human Review Status**: Reviewed and verified (`deno lint` clean across 9 files; 28 tests pass; headless demo confirmed the 2×2 band/labels render with no y-ticks and no page errors; author verified the layout manually)
- **Git Hash**: 5b35531

## [2026-07-09 23:44 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Restore the unified cross-subplot hover on the main plot (hovering shows all five channels — H, E, Z, Magnitude, Temperature — at one timestamp). It had broken because the main plot's five stacked rows were each on a separate matched x-axis, and `layout.hoversubplots` was set to the invalid value `"all"` (silently falling back to `"overlaying"`, which only shows the hovered row); Plotly's `"axis"` mode can only group rows that literally share an x-axis. Fixed by putting all traces on a single shared x-axis with five stacked y-axes (keeping per-row gridlines and the bottom rangeslider) and setting `hoversubplots: "axis"`. Because the rangeslider and the app's own `updateRange()` now both emit `xaxis.range`, reworked `updateRange()` to hold `updateLock` across Plotly's asynchronously-delivered `plotly_relayout` event (cleared in the relayout promise's `.finally`) so autofollow isn't self-disabled, and simplified the autofollow relayout handler (any user `xaxis.range` change disables follow) and its call sites.
- **Sections/Files Affected**: `js/data/plots.json` (all traces on shared `x`; single bottom x-axis with rangeslider + ticks; removed the extra x-axes and the now-unneeded grid; `hoversubplots: "axis"`), `js/index.js` (`updateRange` single `xaxis.range` with async-safe `updateLock`; simplified `plotly_relayout`/`plotly_doubleclick` handlers; removed manual lock wrapping at the live/render/time-window call sites)
- **Nature of Contribution**: Code generation (bug fix)
- **Human Review Status**: Reviewed and verified (headless: unified hover shows all five values at the timestamp; gridlines present in every row; autofollow follows live data; a real rangeslider drag emits `xaxis.range` and disables autofollow with no snap-back; `deno lint` clean, 28 tests pass)
- **Git Hash**: 60df33b

## [2026-07-10 17:54 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8
- **Session Purpose**: Make the dashboard usable on tablets/iPad (issue #27, FR-UI-07) — the remaining task after the author verified Chrome/Firefox/Safari. Added the missing viewport meta tag (and charset) so tablets render at device width instead of scaling a ~980px desktop layout. Added responsive breakpoints: on landscape tablets the desktop side-by-side layout is kept (plots stay the primary view) and the spreadsheet's text is shrunk so its 6–7 columns (including dB/dt) stay readable in the 500px data column without stealing plot width; on portrait tablets the plots stack over a two-column data band (Current Reading + Trends on the left, Spreadsheet beside them spanning both rows), sized with flex so the whole dashboard fits the viewport without scrolling, with Current Reading laid out in two columns (via `display: contents`) so the readings aren't cramped, the two panel headers aligned, and the config sidebar pinned as a fixed overlay. Verified touch interactions (open sidebar, pick source type, add tab) work.
- **Sections/Files Affected**: `index.html` (viewport + charset meta), `css/index.css` (responsive section: `≤1100px` spreadsheet font; `≤900px` portrait flex-column stack, 2-column data band with Spreadsheet spanning, 2-column Current Reading, header-alignment fix, fixed sidebar overlay)
- **Nature of Contribution**: Code generation (responsive layout)
- **Human Review Status**: Reviewed and verified (headless Chromium at iPad landscape 1024×768 and portrait 768×1024 with touch: no JS/console errors; portrait fits with no scroll and Z/Mag sparklines visible; spreadsheet no longer overflows/cramps even with dB/dt; tap opens sidebar / selects source type / adds tab; `deno lint` clean and 28 tests pass; author verified across major browsers and the tablet layout iterations)
- **Git Hash**: b215225

## [2026-07-14 15:15 EDT]
- **Tool**: Claude (Anthropic), claude-opus-4-8 (1M context)
- **Session Purpose**: Fix four iPad/tablet responsive-layout bugs found in device testing (issue #27) and add per-subplot separator borders to the main plot. (1) The Plotly "x unified" hover readout lingered on tap until the next tap inside the plot; now dismissed on a tap anywhere outside the plot. (2) In landscape the modebar obstructed the legend; the modebar is now vertical with a right-margin gutter. (3) The connection-status text wrapped when many/long source tabs filled the header; it now stays on one line while the tab strip scrolls. (4) In portrait the fixed config sidebar covered the footer; the footer now paints above the drawer and the drawer content clears it. Also added theme-aware rectangle borders around each of the five stacked subplots to separate them and de-clutter the y-axis labels.
- **Sections/Files Affected**: `js/index.js` (document-level `pointerdown` → `Plotly.Fx.unhover`; theme-aware plot border color threaded through `plotTheme()`/`themeLayout()`/`retintPlots()`), `js/data/plots.json` (main-plot layout: `modebar.orientation: "v"`, `margin.r` gutter, five per-subplot border `shapes`), `css/index.css` (`#status` nowrap/flex-shrink; `footer` position/z-index; portrait `#config` padding-bottom)
- **Nature of Contribution**: Code generation (bug fixes and a plot styling feature)
- **Human Review Status**: Reviewed and verified (tested on iPad against a Mac-served dev build; author confirmed the four fixes; `plots.json` valid, 28 tests pass)
- **Git Hash**: ac5277e
