/// <reference path="./index.d.ts" />
import Measurement from "./Measurement.js";
import { buildSparklineTraces, reduceBucket } from "./sparklines.js";
import { trailingAverageAt, movingAverage } from "./filter.js";
import plotsInit from "./data/plots.json" with { type: "json" };
import slInit from "./data/sparklines.json" with { type: "json" };
import Vector from "./Vector.js";

const timeRanges = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    // "4h": 14400,
};
const PLOTS_BUF_MAX = 3600; // 1 hour max buffer
const SPARK_BUF_MAX = 100;
const SL_BUCKET_MAX = 10;
const MAX_SOURCES = 6; // tab cap, for performance

// Main-plot trace indices. The raw H/E/Z/Magnitude/Temperature series occupy
// 0-4; the moving-average overlay series mirror them at 5-9 (see plots.json).
const RAW_TRACES = [0, 1, 2, 3, 4];
const FILTER_TRACES = [5, 6, 7, 8, 9];
// Allowed moving-average window sizes, in seconds (see #filterWindow).
const FILTER_WINDOWS = [10, 30, 60];
// Opacity applied to the raw series while the filter overlay is shown, so the
// smoothed lines read as the primary signal without hiding the raw data.
const RAW_FADED_OPACITY = 0.25;

// ----------------------------------------------------------------------------
// Settings (persisted)
// ----------------------------------------------------------------------------
// Moving average and time window are shared across all sources; each source
// (tab) owns its own connection config and coordinate transform.

/**
 * @returns {string} a unique id (falls back when crypto is unavailable)
 */
function uid() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * @param {string} [name]
 * @returns {Source} a blank source with default settings
 */
function makeSource(name = "Source 1") {
    return {
        id: uid(),
        name,
        type: "websocket",
        websocket: { url: "" },
        mqtt: { broker: "", topic: "", username: "", password: "" },
        transform: { x: 0, y: 0, z: 0 },
        dB: { moving: false, h: 0, e: 0, z: 0 },
    };
}

/**
 * @returns {DashSettings}
 */
function defaultSettings() {
    const src = makeSource();
    return {
        displayWindow: "1h",
        dBdt: false,
        filter: { enabled: false, windowSec: 60 },
        sources: [src],
        activeSourceId: src.id,
    };
}

/**
 * Normalizes older settings shapes (single connection + global transform) into
 * the sources[] model so existing users keep their saved source.
 * @param {any} s
 */
function migrateSettings(s) {
    if (!s.filter) {
        s.filter = { enabled: false, windowSec: 60 };
    }
    if (!s.displayWindow) {
        s.displayWindow = "1h";
    }
    if (!("dBdt" in s)) {
        s.dBdt = false;
    }
    const hasSources = Array.isArray(s.sources) && s.sources.length > 0 &&
        s.sources[0] && s.sources[0].id;
    if (!hasSources) {
        const old = s.connection || {};
        s.sources = [{
            id: uid(),
            name: old.name || "Source 1",
            type: old.type || "websocket",
            websocket: { url: (old.websocket && old.websocket.url) || "" },
            mqtt: {
                broker: (old.mqtt && old.mqtt.broker) || "",
                topic: (old.mqtt && old.mqtt.topic) || "",
                username: (old.mqtt && old.mqtt.username) || "",
                password: (old.mqtt && old.mqtt.password) || "",
            },
            transform: s.transform || { x: 0, y: 0, z: 0 },
            dB: s.dB || { moving: false, h: 0, e: 0, z: 0 },
        }];
        s.activeSourceId = s.sources[0].id;
    }
    if (!s.activeSourceId || !s.sources.some(x => x.id === s.activeSourceId)) {
        s.activeSourceId = s.sources[0].id;
    }
    // Drop obsolete top-level keys from the pre-tabs model.
    delete s.connection;
    delete s.transform;
    delete s.inHEZ;
}

/** @type {DashSettings} */
let settings;
try {
    settings = JSON.parse(window.localStorage.getItem("settings"));
} catch (e) {
    settings = null;
}
if (!settings) {
    settings = defaultSettings();
}
migrateSettings(settings);

function saveSettings() {
    window.localStorage.setItem("settings", JSON.stringify(settings));
}
saveSettings(); // persist the normalized shape

/**
 * @param {string} id
 * @returns {Source|undefined}
 */
function getSource(id) {
    return settings.sources.find(s => s.id === id);
}
/**
 * @returns {Source}
 */
function activeSource() {
    return getSource(settings.activeSourceId);
}

// ----------------------------------------------------------------------------
// Sessions (runtime state, one per source — not persisted)
// ----------------------------------------------------------------------------

/**
 * @typedef {object} Session
 * @prop {string} id
 * @prop {Measurement[]} measurements
 * @prop {Measurement[]} sparklines
 * @prop {Measurement[]} sBucket
 * @prop {?object} connection live MagConnection instance, or null
 * @prop {number} status last status code (0-5)
 */

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * @param {Source} source
 * @returns {Session}
 */
function makeSession(source) {
    return {
        id: source.id,
        measurements: [],
        sparklines: [],
        sBucket: [],
        connection: null,
        status: 2,
    };
}
/** @returns {Session} */
function activeSession() {
    return sessions.get(settings.activeSourceId);
}

for (const src of settings.sources) {
    sessions.set(src.id, makeSession(src));
}

// ----------------------------------------------------------------------------
// Plots
// ----------------------------------------------------------------------------
const plotsDiv = document.getElementById("plots");
const sparkDiv = document.getElementById("sparklines");

let autofollow = true;
let updateLock = false;

// Per-source uirevision. Plotly preserves axis ranges, zoom, and the range
// slider whenever uirevision is unchanged (even across newPlot), which left a
// previous source's ranges behind when switching tabs. Keying it to the active
// source resets that state on switch while preserving the user's zoom/pan
// during live updates within a source.
// Deep-clone: Plotly writes computed axis ranges back into the layout object it
// is given, so a shared layout would carry one source's ranges into the next.
function mainLayout() {
    const layout = structuredClone(plotsInit.layout);
    layout.uirevision = settings.activeSourceId;
    return layout;
}
function sparkLayout() {
    const layout = structuredClone(slInit.layout);
    layout.uirevision = settings.activeSourceId;
    return layout;
}

/**
 * (Re)attaches the main-plot interaction handlers. Needed after every
 * Plotly.newPlot, which clears the plot's event registry.
 */
function attachPlotHandlers() {
    if (plotsDiv.removeAllListeners) {
        plotsDiv.removeAllListeners("plotly_relayout");
        plotsDiv.removeAllListeners("plotly_doubleclick");
    }
    plotsDiv.on("plotly_relayout", ev => {
        if (!updateLock &&
            "xaxis.range[0]" in ev &&
            "xaxis.range[1]" in ev) {
            autofollow = false;
        }
    });
    plotsDiv.on("plotly_doubleclick", () => {
        autofollow = true;
        updateLock = true;
        updateRange();
        updateLock = false;
    });
}

/**
 * Draws the main plot from scratch with newPlot (not react) so switching
 * sources fully clears the previous source's WebGL traces, axis ranges, and
 * range slider rather than leaving residual rendering behind.
 * @param {object[]} traces
 */
function drawMainPlot(traces) {
    // purge wipes the stored layout (axis ranges, range slider, WebGL context);
    // newPlot alone keeps the previous ranges when the new data is empty.
    Plotly.purge(plotsDiv);
    Plotly.newPlot(plotsDiv, traces, mainLayout(), plotsInit.config);
    attachPlotHandlers();
}
function drawSparkPlot(traces) {
    Plotly.purge(sparkDiv);
    Plotly.newPlot(sparkDiv, traces, sparkLayout(), slInit.config);
}

drawMainPlot(structuredClone(plotsInit.traces));
drawSparkPlot(structuredClone(slInit.traces));

/**
 * Applies the active source's coordinate transform to a measurement's HEZ.
 * @param {Measurement} m
 * @returns {Vector} the rotated HEZ vector ready for display
 */
function rotatedHEZ(m) {
    const { transform: { x, y, z } } = activeSource();
    return m.HEZ
        .rotate("x", x, false)
        .rotate("y", y, false)
        .rotate("z", z, false);
}

/**
 * Applies a delta-Baseline to a vector.
 *
 * Assumption: v is in HEZ.
 * @param {Vector} v the vector to adjust
 * @param {number} [idx=1] the index in the array to get (only applicable if dB
 * is set to moving average)
 * @returns {Vector} v - dB
 */
function applyDeltaB(v, idx = 1) {
    const { transform: { x, y, z } } = activeSource();
    /** @type {number[]} */
    let deltaB;
    if (activeSource().dB.moving) {
        const { measurements } = activeSession();
        deltaB = trailingAverageAt(measurements,
            measurements.length - idx, settings.filter.windowSec)
            .HEZ
            .rotate("x", x, false)
            .rotate("y", y, false)
            .rotate("z", z, false);
    } else {
        const { dB: { h, e, z } } = activeSource();
        deltaB = [h, e, z];
    }
    return v.delta(...deltaB);
}

/**
 * @returns {boolean}
 */
function usesDeltaB() {
    const { dB: { moving, h, e, z } } = activeSource();
    return moving || (h || e || z);
}

/** Resets both plots to their initial empty state (full re-init). */
function resetPlots() {
    drawMainPlot(structuredClone(plotsInit.traces));
    drawSparkPlot(structuredClone(slInit.traces));
}

/**
 * Recomputes the moving-average overlay (H, E, Z, Magnitude, Temperature) from
 * the active source's buffer and redraws traces 5-9 in a single restyle.
 */
function recomputeFiltered() {
    const smoothed = movingAverage(
        activeSession().measurements, settings.filter.windowSec);
    const x = smoothed.map(m => m.ts);
    let vectors = smoothed.map(rotatedHEZ);
    if (usesDeltaB()) {
        vectors = vectors.map(applyDeltaB);
    }
    Plotly.restyle(plotsDiv, {
        x: FILTER_TRACES.map(() => x),
        y: [
            vectors.map(v => v[0]),
            vectors.map(v => v[1]),
            vectors.map(v => v[2]),
            vectors.map(v => parseFloat(v.magnitude.toFixed(3))),
            smoothed.map(m => m.celsius),
        ],
    }, FILTER_TRACES);
}

/**
 * Shows or hides the moving-average overlay and fades the raw series to match
 * the current filter setting, without touching the underlying data.
 */
function syncFilterVisual() {
    const on = settings.filter.enabled;
    Plotly.restyle(plotsDiv,
        { opacity: on ? RAW_FADED_OPACITY : 1 }, RAW_TRACES);
    Plotly.restyle(plotsDiv, { visible: on }, FILTER_TRACES);
}

/** Rebuilds the overlay data (when enabled) and syncs its visibility. */
function refreshFilter() {
    if (settings.filter.enabled && activeSession().measurements.length > 0) {
        recomputeFiltered();
    }
    syncFilterVisual();
}

function updateCoordGraphs() {
    const vectors = activeSession().measurements.map(rotatedHEZ);

    /** @type {[0, 1, 2]} */
    const traces = [0, 1, 2];

    // Depending on what we have, what we update changes:
    // 1. If we only have rotation, then only coordinate graphs change.
    // 2. If we have any dB, all vector plots change.
    if (!usesDeltaB()) {
        Plotly.restyle(plotsDiv, {
            y: traces.map(t => vectors.map(v => v[t]))
        }, traces);
    } else {
        const vectorsdB = vectors.map(applyDeltaB);
        const newTraces = traces.map(t => vectorsdB.map(v => v[t]));
        newTraces.push(vectorsdB.map(v => v.magnitude));
        Plotly.restyle(plotsDiv, {
            y: newTraces
        }, traces.concat(3));
    }

    // The smoothed overlay depends on the same rotation, so rebuild it too.
    if (settings.filter.enabled) {
        recomputeFiltered();
    }
}

function updateRange() {
    const ms = activeSession().measurements;
    if (ms.length === 0) {
        return;
    }
    const { ts: latest } = ms[ms.length - 1];
    const seconds = timeRanges[settings.displayWindow] ?? timeRanges["1h"];
    const latestDiff = new Date(latest.getTime() - (seconds * 1000));
    try {
        // This keeps throwing a TypeError but it doesn't seem to affect
        // execution.
        Plotly.relayout(plotsDiv, {
            "xaxis.range":  [latestDiff, latest],
            "xaxis2.range": [latestDiff, latest],
            "xaxis3.range": [latestDiff, latest],
            "xaxis4.range": [latestDiff, latest],
            "xaxis5.range": [latestDiff, latest],
        });
    } catch (e) {}
}

/**
 * Appends one reading to the active plots (raw, plus the overlay if enabled).
 * @param {Measurement} measurement
 */
function extendAllTraces(measurement) {
    let dispVec = rotatedHEZ(measurement);
    if (usesDeltaB()) {
        dispVec = applyDeltaB(dispVec);
    }
    const { ts } = measurement;
    Plotly.extendTraces(plotsDiv, {
        x: [[ts], [ts], [ts], [ts], [ts]],
        y: [
            [dispVec[0]],
            [dispVec[1]],
            [dispVec[2]],
            [parseFloat(dispVec.magnitude.toFixed(3))],
            [measurement.celsius],
        ],
    }, RAW_TRACES);

    // A trailing moving average is causal, so each smoothed point is final once
    // computed: we can append the newest one rather than rebuilding the series.
    if (settings.filter.enabled) {
        const ms = activeSession().measurements;
        const smoothed = trailingAverageAt(
            ms, ms.length - 1, settings.filter.windowSec);
        let filtVec = rotatedHEZ(smoothed);
        if (usesDeltaB()) {
            filtVec = applyDeltaB(filtVec);
        }
        Plotly.extendTraces(plotsDiv, {
            x: [[ts], [ts], [ts], [ts], [ts]],
            y: [
                [filtVec[0]],
                [filtVec[1]],
                [filtVec[2]],
                [parseFloat(filtVec.magnitude.toFixed(3))],
                [smoothed.celsius],
            ],
        }, FILTER_TRACES);
    }
}

function updateSparks() {
    const session = activeSession();
    while (session.sparklines.length > SPARK_BUF_MAX) {
        session.sparklines.shift();
    }
    const newSlTraces = buildSparklineTraces(session.sparklines);
    Plotly.react(sparkDiv, newSlTraces, sparkLayout(), slInit.config);
}

/**
 * Builds the spreadsheet table row for a measurement, applying the active
 * source's coordinate transform. The moving-average filter intentionally does
 * not affect the spreadsheet — it always shows the rotated raw reading.
 * @param {Measurement} measurement
 * @returns {string} the `<tr>` markup for this measurement
 */
function spreadsheetRowHTML(measurement) {
    // Local time on the client end, for the operator's convenience.
    const date = new Intl.DateTimeFormat("en-US", {
        hour12: false,
        month: "numeric",
        day: "numeric",
        year: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
    }).format(measurement.ts);

    let dispVector = rotatedHEZ(measurement);
    if (usesDeltaB()) {
        dispVector = applyDeltaB(dispVector);
    }

    return `
        <tr>
            <td>${date}</td>
            <td>${dispVector[0].toFixed(3)}</td>
            <td>${dispVector[1].toFixed(3)}</td>
            <td>${dispVector[2].toFixed(3)}</td>
            <td>${dispVector.magnitude.toFixed(3)}</td>
            <td>${measurement.celsius.toFixed(2)}</td>
        </tr>`;
}

/**
 * Prepends a measurement's row to the top of the spreadsheet (newest first).
 * @param {Measurement} measurement
 */
function addSpreadsheetRow(measurement) {
    document.querySelector("#spreadsheet table tbody").insertAdjacentHTML(
        "afterbegin", spreadsheetRowHTML(measurement));
    // TODO: Remove last row once we're at max buffer size?
}

/** Rebuilds every spreadsheet row from the active source's buffer. */
function rebuildSpreadsheet() {
    // measurements run oldest -> newest, but the table shows newest at the top.
    document.querySelector("#spreadsheet table tbody").innerHTML =
        activeSession().measurements.map(spreadsheetRowHTML).reverse().join("");
}

/**
 * @param {Measurement} m
 */
function updateCurrentTable(m) {
    const { measurements: ms } = activeSession();
    let dispVec = rotatedHEZ(m);
    if (usesDeltaB()) {
        dispVec = applyDeltaB(dispVec);
    }

    let dB = "±0.000";
    if (ms.length > 1) {
        let prev = rotatedHEZ(ms[ms.length - 2]);
        if (usesDeltaB()) {
            prev = applyDeltaB(prev, 2);
        }
        const diff = dispVec.magnitude - prev.magnitude;
        dB = diff.toFixed(3);
        if (parseFloat(dB) === 0) {
            dB = `±${dB}`;
        } else if (dB.charAt(0) !== "-") {
            dB = `+${dB}`;
        }
    }

    document.getElementById("h").textContent = dispVec[0].toFixed(3);
    document.getElementById("e").textContent = dispVec[1].toFixed(3);
    document.getElementById("z").textContent = dispVec[2].toFixed(3);
    document.getElementById("mag").textContent = dispVec.magnitude.toFixed(3);
    document.getElementById("temp").textContent = m.celsius.toFixed(2);
    document.getElementById("dBdt").textContent = dB;
}

// ----------------------------------------------------------------------------
// Connection status (header indicator)
// ----------------------------------------------------------------------------
const statusEl = document.getElementById("status");

/**
 * Sets the header connection status indicator.
 * @param {number} s 0 connecting, 1 connected, 2 disconnected,
 *   3 failed/retrying, 4 file loaded, 5 auth failed
 * @param {number} [retry=0] retry count, shown for the failed state
 */
function setHeaderStatus(s, retry = 0) {
    const [sText] = statusEl.getElementsByTagName("span");
    const [ico] = statusEl.getElementsByTagName("i");
    switch (s) {
        case 0:
            sText.textContent = "Connecting";
            statusEl.className = "wait";
            ico.className = "fa-solid fa-arrows-rotate";
            break;
        case 1:
            sText.textContent = "Connected";
            statusEl.className = "success";
            ico.className = "fa-solid fa-signal";
            break;
        case 2:
            sText.textContent = "Disconnected";
            statusEl.className = "error";
            ico.className = "fa-solid fa-circle-xmark";
            break;
        case 3:
            sText.textContent = `Failed (${retry})`;
            statusEl.className = "warn";
            ico.className = "fa-solid fa-triangle-exclamation";
            break;
        case 4:
            sText.textContent = "File loaded";
            statusEl.className = "success";
            ico.className = "fa-solid fa-file-lines";
            break;
        case 5:
            sText.textContent = "Auth failed";
            statusEl.className = "error";
            ico.className = "fa-solid fa-user-lock";
            break;
    }
}

// ----------------------------------------------------------------------------
// Ingestion + connection routing
// ----------------------------------------------------------------------------

/**
 * Buffers one reading into a session (capping the buffers and aggregating the
 * sparkline bucket). DOM is untouched; the caller renders if it's active.
 * @param {Session} session
 * @param {Measurement} m
 * @returns {boolean} whether a new sparkline aggregate was produced
 */
function ingest(session, m) {
    session.measurements.push(m);
    while (session.measurements.length > PLOTS_BUF_MAX) {
        session.measurements.shift();
    }
    session.sBucket.push(m);
    if (session.sBucket.length >= SL_BUCKET_MAX) {
        session.sparklines.push(reduceBucket(session.sBucket));
        session.sBucket.length = 0;
        while (session.sparklines.length > SPARK_BUF_MAX) {
            session.sparklines.shift();
        }
        return true;
    }
    return false;
}

/**
 * Handles a reading from a given source. Always buffers it; only renders when
 * the source is the active tab.
 * @param {string} id source id
 * @param {MagUsbJson} json
 */
function handleReading(id, json) {
    const session = sessions.get(id);
    if (!session) {
        return;
    }
    const { ts, rt: tmp, x, y, z } = json;
    let measurement;
    try {
        measurement = new Measurement(ts, tmp, x, y, z);
    } catch (e) {
        console.log("Bad reading:", e);
        return;
    }

    // A zero reading on rt that repeats the previous field is a host problem,
    // not a dashboard problem: alert and drop the connection.
    const last = session.measurements[session.measurements.length - 1];
    if (!measurement.celsius && last && measurement.XYZ.equals(last.XYZ)) {
        handleHardwareError(session);
        return;
    }

    const newSpark = ingest(session, measurement);
    if (id === settings.activeSourceId) {
        addSpreadsheetRow(measurement);
        updateCurrentTable(measurement);
        extendAllTraces(measurement);
        if (newSpark) {
            updateSparks();
        }
        if (autofollow) {
            updateLock = true;
            updateRange();
            updateLock = false;
        }
    }
}

/**
 * @param {string} id source id
 * @param {number} code status code
 * @param {number} [retry]
 */
function handleStatus(id, code, retry) {
    const session = sessions.get(id);
    if (session) {
        session.status = code;
    }
    if (id === settings.activeSourceId) {
        setHeaderStatus(code, retry);
    }
    updateTabStatus(id, code);
}

/** @param {Session} session */
function handleHardwareError(session) {
    alert(
        "Hardware Error:\n" +
        "The magnetometer was disconnected from the host. Check the host " +
        "machine and the magnetometer for faulty cabling. Restart mag-usb " +
        "after the problem is resolved.");
    if (session.connection) {
        session.connection.disconnect();
    }
}

/**
 * @param {string} id
 * @returns {{onReading: function, onStatus: function}}
 */
function connectionHandlers(id) {
    return {
        onReading: json => handleReading(id, json),
        onStatus: (code, retry) => handleStatus(id, code, retry),
    };
}

/**
 * @param {Source} src
 * @returns {boolean} whether the source has enough config to connect live
 */
function isConfigured(src) {
    if (src.type === "websocket") {
        return isValidWsUrl(src.websocket.url);
    }
    if (src.type === "mqtt") {
        return isValidWsUrl(src.mqtt.broker) && !!src.mqtt.topic;
    }
    return false; // file: no live transport
}

/**
 * Opens (or reopens) the live transport for a session's source. No-op for file
 * sources or sources that aren't configured yet.
 * @param {Session} session
 */
function connectSession(session) {
    const src = getSource(session.id);
    if (!src || !isConfigured(src)) {
        if (session.id === settings.activeSourceId) {
            setHeaderStatus(session.status);
        }
        return;
    }
    if (session.connection) {
        session.connection.disconnect();
    }
    session.connection = window.MagConnection.create(
        src, connectionHandlers(session.id));
    session.connection.connect();
}

/** Clears the shared view (spreadsheet + plots) for the active source. */
function clearActiveView() {
    document.querySelector("#spreadsheet table tbody").innerHTML = "";
    resetPlots();
    // resetPlots() restores the overlay traces to their hidden default, so
    // re-apply the fade/visibility that matches the current filter setting.
    syncFilterVisual();
}

/**
 * Empties a session's buffers (e.g. before a fresh connection). Also clears the
 * shared view when the session is active.
 * @param {Session} session
 */
function clearSession(session) {
    session.measurements.length = 0;
    session.sparklines.length = 0;
    session.sBucket.length = 0;
    if (session.id === settings.activeSourceId) {
        clearActiveView();
    }
}

/** Renders the full active session into the shared view (used on tab switch). */
function renderActive() {
    const session = activeSession();
    const ms = session.measurements;

    resetPlots();
    document.querySelector("#spreadsheet table tbody").innerHTML = "";

    if (ms.length > 0) {
        const times = ms.map(m => m.ts);
        let vecs = ms.map(rotatedHEZ);
        if (usesDeltaB()) {
            vecs = vecs.map(applyDeltaB);
        }
        Plotly.update(plotsDiv, {
            x: [times, times, times, times, times],
            y: [
                vecs.map(v => v[0]),
                vecs.map(v => v[1]),
                vecs.map(v => v[2]),
                vecs.map(v => parseFloat(v.magnitude.toFixed(3))),
                ms.map(m => m.celsius),
            ],
        }, {}, RAW_TRACES);
        rebuildSpreadsheet();
        updateCurrentTable(ms[ms.length - 1]);
    } else {
        document.getElementById("h").textContent = "-";
        document.getElementById("e").textContent = "-";
        document.getElementById("z").textContent = "-";
        document.getElementById("mag").textContent = "-";
        document.getElementById("temp").textContent = "-";
    }
    refreshFilter();
    if (session.sparklines.length > 0) {
        updateSparks();
    }
    setHeaderStatus(session.status);
    autofollow = true;
    updateLock = true;
    updateRange();
    updateLock = false;
}

/**
 * Loads a JSONL .log file into the active session, replacing its buffer.
 * @param {File} file the .log file selected by the user
 * @returns {Promise<void>} resolves once the plot is updated
 */
function loadLogFile(file) {
    return file.text()
        .then(text => text.trim().split("\n"))
        .then(lines => {
            /** @type {Measurement[]} */
            const logs = [];
            for (let i = 0; i < lines.length; i++) {
                try {
                    /** @type {MagUsbJson} */
                    const json = JSON.parse(lines[i]);
                    logs[i] = new Measurement(
                        json.ts, json.rt, json.x, json.y, json.z);
                } catch (err) {
                    console.log(err);
                    throw new Error(
                        `Cannot load file. Line ${i + 1} is malformed.`);
                }
            }
            console.log(`Loaded ${file.name}`);
            return logs;
        }).then(logs => {
            const session = activeSession();
            session.measurements = logs;
            session.sparklines.length = 0;
            session.sBucket.length = 0;

            resetPlots();
            document.querySelector("#spreadsheet table tbody").innerHTML = "";
            const times = logs.map(({ ts }) => ts);
            const vecs = logs.map(rotatedHEZ);
            Plotly.update(plotsDiv, {
                x: [times, times, times, times, times],
                y: [
                    vecs.map(v => v[0]),
                    vecs.map(v => v[1]),
                    vecs.map(v => v[2]),
                    vecs.map(v => parseFloat(v.magnitude.toFixed(3))),
                    logs.map(m => m.celsius),
                ]
            }, {
                "xaxis.range": [logs[0].ts, logs[logs.length - 1].ts],
            }, RAW_TRACES);
            refreshFilter();
            session.status = 4;
            setHeaderStatus(4);
        });
}

// ----------------------------------------------------------------------------
// Sidebar: toggle
// ----------------------------------------------------------------------------
const sideToggle = document.getElementById("sideToggle");
sideToggle.addEventListener("click", () => {
    const sidebar = document.getElementById("config");
    if (sideToggle.classList.contains("fa-xmark")) {
        sidebar.style.transform = "translateX(-100%)";
    } else {
        sidebar.style.transform = "translateX(0)";
    }
    sideToggle.classList.toggle("fa-bars");
    sideToggle.classList.toggle("fa-xmark");
});

// ----------------------------------------------------------------------------
// Processing: rotation (per source)
// ----------------------------------------------------------------------------
const rotX = document.getElementById("rotX");
const rotY = document.getElementById("rotY");
const rotZ = document.getElementById("rotZ");
const xDel = document.getElementById("xDelta");
const yDel = document.getElementById("yDelta");
const zDel = document.getElementById("zDelta");

/**
 * Loads a source's transform into the rotation sliders.
 * @param {Source} src
 */
function loadRotation(src) {
    rotX.value = src.transform.x;
    rotY.value = src.transform.y;
    rotZ.value = src.transform.z;
    xDel.textContent = rotX.value;
    yDel.textContent = rotY.value;
    zDel.textContent = rotZ.value;
}

rotX.addEventListener("input", ev => { xDel.textContent = ev.target.value; });
rotY.addEventListener("input", ev => { yDel.textContent = ev.target.value; });
rotZ.addEventListener("input", ev => { zDel.textContent = ev.target.value; });

document.getElementById("saveRot").addEventListener("click", () => {
    const src = activeSource();
    src.transform.x = parseInt(rotX.value, 10);
    src.transform.y = parseInt(rotY.value, 10);
    src.transform.z = parseInt(rotZ.value, 10);
    saveSettings();
    updateCoordGraphs();
    rebuildSpreadsheet();
});

// ----------------------------------------------------------------------------
// Processing: variations from delta-B (per source)
// ----------------------------------------------------------------------------
const dBType = document.getElementById("dBType");
const methodBtns = [...dBType.querySelectorAll("button")];

/**
 * Shows only the fields for the given method type and marks its button active.
 * @param {string} type "constant" | "moving"
 */
function showMethodFields(type) {
    document.querySelectorAll("#config .method-fields").forEach(el => {
        el.hidden = el.dataset.type !== type;
    });
    methodBtns.forEach(b => { b.disabled = b.name === type; });
}

// Switch dB calc method (changes visible fields).
methodBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        showMethodFields(btn.name);
    });
});

const dH = document.getElementById("dH");
const dE = document.getElementById("dE");
const dZ = document.getElementById("dZ");

document.getElementById("savedB").addEventListener("click", () => {
    const src = activeSource();
    const field = document.querySelector("#dBType button:disabled").name;
    const isMoving = field === "moving";
    src.dB.moving = isMoving;
    if (!isMoving) {
        src.dB.h = dH.valueAsNumber;
        src.dB.e = dE.valueAsNumber;
        src.dB.z = dZ.valueAsNumber;
    }
    saveSettings();
    updateCoordGraphs();
    rebuildSpreadsheet();
});

/**
 * Loads a source's delta-B config into the sidebar.
 * @param {Source} src
 */
function loadDeltaB(src) {
    dH.value = src.dB.h ?? 0;
    dE.value = src.dB.e ?? 0;
    dZ.value = src.dB.z ?? 0;
    showMethodFields(src.dB.moving ? "moving" : "constant");
}

// ----------------------------------------------------------------------------
// Processing: moving-average filter (shared)
// ----------------------------------------------------------------------------
const filterGroup = document.getElementById("filterGroup");
const filterWindow = document.getElementById("filterWindow");
const filterOff = filterGroup.querySelector('button[name="off"]');
const filterOn = filterGroup.querySelector('button[name="on"]');

filterWindow.value = String(settings.filter.windowSec);
filterOff.disabled = !settings.filter.enabled;
filterOn.disabled = settings.filter.enabled;

/**
 * @param {boolean} enabled
 */
function setFilterEnabled(enabled) {
    settings.filter.enabled = enabled;
    saveSettings();
    filterOff.disabled = !enabled;
    filterOn.disabled = enabled;
    refreshFilter();
}

filterOff.addEventListener("click", () => setFilterEnabled(false));
filterOn.addEventListener("click", () => setFilterEnabled(true));

filterWindow.addEventListener("change", ev => {
    const windowSec = parseInt(ev.target.value, 10);
    if (!FILTER_WINDOWS.includes(windowSec)) {
        return;
    }
    settings.filter.windowSec = windowSec;
    saveSettings();
    if (settings.filter.enabled) {
        recomputeFiltered();
    }
});

// ----------------------------------------------------------------------------
// Display: time window (shared)
// ----------------------------------------------------------------------------
const timeSelect = document.getElementById("timerange");
timeSelect.value = settings.displayWindow;
timeSelect.addEventListener("change", ev => {
    settings.displayWindow = ev.target.value;
    saveSettings();
    autofollow = true;
    updateRange();
});

// ----------------------------------------------------------------------------
// Display: dB/dt(shared)
// ----------------------------------------------------------------------------
const dBdtToggle = document.getElementById("dBdtToggle");
dBdtToggle.checked = settings.dBdt;
function updatedBdt() {
    const row2 = document.querySelector(".row2");
    const cell = row2.querySelector(".cell:last-of-type");
    // TODO: Update the spreadsheet to include/exclude dB/dt column
    if (settings.dBdt) {
        row2.classList.add("dB");
        cell.style.cssText = "";
    } else {
        row2.classList.remove("dB");
        cell.style.display = "none";
    }
}
dBdtToggle.addEventListener("change", ev => {
    settings.dBdt = ev.target.checked;
    saveSettings();
    updatedBdt();
})

// ----------------------------------------------------------------------------
// Connection panel
// ----------------------------------------------------------------------------
const srcName = document.getElementById("srcName");
const connType = document.getElementById("connType");
const wsUrl = document.getElementById("wsUrl");
const wsUrlErr = document.getElementById("wsUrlErr");
const mqttBroker = document.getElementById("mqttBroker");
const mqttTopic = document.getElementById("mqttTopic");
const mqttUser = document.getElementById("mqttUser");
const mqttPass = document.getElementById("mqttPass");
const mqttBrokerErr = document.getElementById("mqttBrokerErr");
const mqttTopicErr = document.getElementById("mqttTopicErr");
const logfile = document.getElementById("logfile");
const fileErr = document.getElementById("fileErr");
const connectBtn = document.getElementById("connectBtn");
const typeButtons = [...connType.querySelectorAll("button")];

/**
 * Shows only the fields for the given source type and marks its button active.
 * @param {string} type "websocket" | "mqtt" | "file"
 */
function showTypeFields(type) {
    document.querySelectorAll("#config .type-fields").forEach(el => {
        el.hidden = el.dataset.type !== type;
    });
    typeButtons.forEach(b => { b.disabled = b.name === type; });
}

function clearConnErrors() {
    wsUrlErr.textContent = "";
    mqttBrokerErr.textContent = "";
    mqttTopicErr.textContent = "";
    fileErr.textContent = "";
}

/**
 * Loads a source's connection config into the panel.
 * @param {Source} src
 */
function loadConnForm(src) {
    srcName.value = src.name ?? "";
    wsUrl.value = src.websocket?.url ?? "";
    mqttBroker.value = src.mqtt?.broker ?? "";
    mqttTopic.value = src.mqtt?.topic ?? "";
    mqttUser.value = src.mqtt?.username ?? "";
    mqttPass.value = src.mqtt?.password ?? "";
    clearConnErrors();
    showTypeFields(src.type ?? "websocket");
}

// Switch source type (changes the active source's type + visible fields).
typeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        activeSource().type = btn.name;
        saveSettings();
        clearConnErrors();
        showTypeFields(btn.name);
    });
});

wsUrl.addEventListener("input", () => { wsUrlErr.textContent = ""; });
mqttBroker.addEventListener("input", () => { mqttBrokerErr.textContent = ""; });
mqttTopic.addEventListener("input", () => { mqttTopicErr.textContent = ""; });
logfile.addEventListener("change", () => { fileErr.textContent = ""; });

/**
 * @param {string} url
 * @returns {boolean} whether `url` is a valid ws:// or wss:// URL
 */
function isValidWsUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === "ws:" || u.protocol === "wss:";
    } catch {
        return false;
    }
}

connectBtn.addEventListener("click", () => {
    const src = activeSource();
    // Persist the current form values into the active source.
    src.name = srcName.value.trim();
    src.websocket.url = wsUrl.value.trim();
    src.mqtt = {
        broker: mqttBroker.value.trim(),
        topic: mqttTopic.value.trim(),
        username: mqttUser.value,
        password: mqttPass.value,
    };

    const session = activeSession();

    if (src.type === "websocket") {
        if (!isValidWsUrl(src.websocket.url)) {
            wsUrlErr.textContent = "Enter a ws:// or wss:// URL.";
            return;
        }
        saveSettings();
        clearSession(session);
        connectSession(session);
    } else if (src.type === "mqtt") {
        let ok = true;
        if (!isValidWsUrl(src.mqtt.broker)) {
            mqttBrokerErr.textContent = "Enter a ws:// or wss:// broker URL.";
            ok = false;
        }
        if (!src.mqtt.topic) {
            mqttTopicErr.textContent = "Enter a topic.";
            ok = false;
        }
        if (!ok) {
            return;
        }
        saveSettings();
        clearSession(session);
        connectSession(session);
    } else if (src.type === "file") {
        if (!logfile.files || logfile.files.length === 0) {
            fileErr.textContent = "Choose a .log file first.";
            return;
        }
        saveSettings();
        if (session.connection) {
            session.connection.disconnect();
            session.connection = null;
        }
        loadLogFile(logfile.files[0]).catch(err => {
            console.error(err);
            fileErr.textContent = err.message;
        });
    }
});

// ----------------------------------------------------------------------------
// Collapsible panels
// ----------------------------------------------------------------------------
document.querySelectorAll("#config .panel-header").forEach(header => {
    header.addEventListener("click", () => {
        const panel = header.closest(".panel");
        panel.dataset.collapsed = String(panel.dataset.collapsed !== "true");
    });
});

// ----------------------------------------------------------------------------
// Tabs (one per source)
// ----------------------------------------------------------------------------
const tabsEl = document.getElementById("tabs");
const addTabBtn = document.getElementById("addTab");

/**
 * @param {number} code status code
 * @returns {string} CSS class for the dot
 */
function statusClass(code) {
    switch (code) {
        case 0:
            return "s-connecting"; // blue
        case 1:
        case 4:
            return "s-connected"; // green
        case 3:
            return "s-failed"; // yellow
        default: // 2 disconnected, 5 auth failed
            return "s-disconnected"; // red
    }
}

/**
 * Updates just one tab's status dot.
 * @param {string} id
 * @param {number} code
 */
function updateTabStatus(id, code) {
    const dot = tabsEl.querySelector(`.tab[data-id="${id}"] .tab-status`);
    if (dot) {
        dot.className = "tab-status " + statusClass(code);
    }
}

/**
 * Rebuilds the tab strip from settings.sources.
 */
function renderTabs() {
    tabsEl.innerHTML = "";
    for (const src of settings.sources) {
        const session = sessions.get(src.id);
        const tab = document.createElement("div");
        tab.className = "tab" +
            (src.id === settings.activeSourceId ? " active" : "");
        tab.dataset.id = src.id;

        const dot = document.createElement("span");
        dot.className = "tab-status " + statusClass(session ? session.status : 2);
        tab.appendChild(dot);

        const name = document.createElement("span");
        name.className = "tab-name";
        name.textContent = src.name || "Untitled";
        tab.appendChild(name);

        const close = document.createElement("i");
        close.className = "tab-close fa-solid fa-xmark";
        close.title = "Close source";
        close.addEventListener("click", ev => {
            ev.stopPropagation();
            closeTab(src.id);
        });
        tab.appendChild(close);

        tab.addEventListener("click", () => switchTab(src.id));
        tabsEl.appendChild(tab);
    }
    addTabBtn.disabled = settings.sources.length >= MAX_SOURCES;
}

/**
 * Opens the config sidebar (used when adding a source to configure).
 */
function openSidebar() {
    document.getElementById("config").style.transform = "translateX(0)";
    sideToggle.classList.remove("fa-bars");
    sideToggle.classList.add("fa-xmark");
}

/**
 * Switches the UI to a different source.
 * @param {string} id
 */
function switchTab(id) {
    if (id === settings.activeSourceId || !sessions.has(id)) {
        return;
    }
    settings.activeSourceId = id;
    saveSettings();
    const src = activeSource();
    loadConnForm(src);
    loadRotation(src);
    loadDeltaB(src);
    renderActive();
    renderTabs();
}

/**
 * Adds a new, unconfigured source and switches to it.
 */
function addTab() {
    if (settings.sources.length >= MAX_SOURCES) {
        return;
    }
    const src = makeSource(`Source ${settings.sources.length + 1}`);
    settings.sources.push(src);
    sessions.set(src.id, makeSession(src));
    settings.activeSourceId = src.id;
    saveSettings();
    loadConnForm(src);
    loadRotation(src);
    loadDeltaB(src);
    renderActive();
    renderTabs();
    openSidebar();
    srcName.focus();
}

/**
 * Closes a source, its connection, and its session.
 * @param {string} id
 */
function closeTab(id) {
    const session = sessions.get(id);
    if (session && session.connection) {
        session.connection.disconnect();
    }
    sessions.delete(id);
    const idx = settings.sources.findIndex(s => s.id === id);
    if (idx !== -1) {
        settings.sources.splice(idx, 1);
    }

    // Never leave zero tabs.
    if (settings.sources.length === 0) {
        const src = makeSource("Source 1");
        settings.sources.push(src);
        sessions.set(src.id, makeSession(src));
        settings.activeSourceId = src.id;
    } else if (id === settings.activeSourceId) {
        settings.activeSourceId =
            settings.sources[Math.max(0, idx - 1)].id;
    }

    saveSettings();
    const src = activeSource();
    loadConnForm(src);
    loadRotation(src);
    loadDeltaB(src);
    renderActive();
    renderTabs();
}

addTabBtn.addEventListener("click", addTab);

// Live-rename the active tab as the source name is edited.
srcName.addEventListener("input", () => {
    activeSource().name = srcName.value;
    const label = tabsEl.querySelector(
        `.tab[data-id="${settings.activeSourceId}"] .tab-name`);
    if (label) {
        label.textContent = srcName.value || "Untitled";
    }
});

// ----------------------------------------------------------------------------
// Init: load the active source into the UI and connect saved sources.
// ----------------------------------------------------------------------------
loadConnForm(activeSource());
loadRotation(activeSource());
loadDeltaB(activeSource());
refreshFilter();
renderTabs();
updatedBdt();
for (const src of settings.sources) {
    connectSession(sessions.get(src.id));
}

/**
 * @typedef {object} MagUsbJson
 * @prop {string} ts
 * @prop {number} rt
 * @prop {number} x
 * @prop {number} y
 * @prop {number} z
 */

/**
 * @typedef {object} Source
 * @prop {string} id
 * @prop {string} name
 * @prop {"websocket"|"mqtt"|"file"} type
 * @prop {{url: string}} websocket
 * @prop {{broker: string, topic: string, username: string, password: string}} mqtt
 * @prop {{x: number, y: number, z: number}} transform
 * @prop {{moving: boolean, h: number, e: number, z: number}} dB
 */

/**
 * @typedef {object} DashSettings
 * @prop {string} displayWindow
 * @prop {boolean} dBdt
 * @prop {{enabled: boolean, windowSec: number}} filter
 * @prop {Source[]} sources
 * @prop {string} activeSourceId
 */
