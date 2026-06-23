/// <reference path="./index.d.ts" />
import Measurement from "./Measurement.js";
import { buildSparklineTraces, reduceBucket } from "./sparklines.js";
import { trailingAverageAt, movingAverage } from "./filter.js";
import plotsInit from "./data/plots.json" with { type: "json" };
import slInit from "./data/sparklines.json" with { type: "json" };

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

// Main-plot trace indices. The raw H/E/Z/Magnitude/Temperature series occupy
// 0-4; the moving-average overlay series mirror them at 5-9 (see plots.json).
const RAW_TRACES = [0, 1, 2, 3, 4];
const FILTER_TRACES = [5, 6, 7, 8, 9];
// Allowed moving-average window sizes, in seconds (see #filterWindow).
const FILTER_WINDOWS = [10, 30, 60];
// Opacity applied to the raw series while the filter overlay is shown, so the
// smoothed lines read as the primary signal without hiding the raw data.
const RAW_FADED_OPACITY = 0.25;

// Check for previously saved settings. Init defaults if not found.
if (window.localStorage.getItem("settings") === null) {
    window.localStorage.setItem("settings", JSON.stringify({
        inHEZ: true,
        displayWindow: "1h",
        transform: { x: 0, y: 0, z: 0 },
        filter: { enabled: false, windowSec: 60 },
        connection: {
            name: "",
            type: "websocket",
            websocket: { url: "" },
            mqtt: { broker: "", topic: "", username: "", password: "" },
        },
        // This is future proofing for the tabber system later.
        sources: [
            {
                name: "Untitled",
                type: "Unknown",
                url: "",
            },
        ],
    }));
}

/** @type {DashSettings} */
const settings = JSON.parse(window.localStorage.getItem("settings"));

// Migrate settings saved before the moving-average filter existed.
if (!settings.filter) {
    settings.filter = { enabled: false, windowSec: 60 };
}
// Migrate settings saved before the connection panel existed.
if (!settings.connection) {
    settings.connection = {
        name: "",
        type: "websocket",
        websocket: { url: "" },
        mqtt: { broker: "", topic: "", username: "", password: "" },
    };
}

function saveSettings() {
    window.localStorage.setItem("settings", JSON.stringify(settings));
}

// Load the user's settings
const timeSelect = document.getElementById("timerange");
timeSelect.value = settings.displayWindow;

const rotX = document.getElementById("rotX");
const rotY = document.getElementById("rotY");
const rotZ = document.getElementById("rotZ");
rotX.value = settings.transform.x;
rotY.value = settings.transform.y;
rotZ.value = settings.transform.z;

const xDel = document.getElementById("xDelta");
const yDel = document.getElementById("yDelta");
const zDel = document.getElementById("zDelta");
xDel.textContent = rotX.value;
yDel.textContent = rotY.value;
zDel.textContent = rotZ.value;

// Repopulate the tabber with the user's data sources
// const tabs = document.getElementById("tabs");
// let activeTab = 0;
// if (settings.sources.length > 0) {
//     const template = document.getElementById("srcTab");
//     for (const source of settings.sources) {
//         const clone = document.importNode(template.content, true);
//         const tabName = clone.querySelector(".tab-name");
//         tabName.textContent = source.name;
//         const tabIco = clone.querySelector(".tab-ico > i");
//         if (source.type === "Live") {
//             tabIco.className = "fa-solid fa-server";
//         } else if (source.type === "Static") {
//             tabIco.className = "fa-solid fa-file";
//         }
//         tabs.appendChild(clone);
//         console.log(`Loaded ${source.type} source ${source.name}`);
//     }
// }

/** @type {Measurement[]} */
const measurements = [];

/**
 * @type {Measurement[]}
 * For performance, we'll only keep up to 100 samples at a time.
 */
const sparklines = [];
/**
 * @type {Measurement[]}
 * This gets cleared every 10 samples.
 */
const sBucket = [];

const plotsDiv = document.getElementById("plots");
Plotly.newPlot(plotsDiv, plotsInit.traces, plotsInit.layout, plotsInit.config);

const sparkDiv = document.getElementById("sparklines");
Plotly.newPlot(sparkDiv, slInit.traces, slInit.layout, slInit.config);

let autofollow = true;
let updateLock = false;

/**
 * Applies the saved coordinate transform to a measurement's HEZ vector.
 * @param {Measurement} m
 * @returns {Vector} the rotated HEZ vector ready for display
 */
function rotatedHEZ(m) {
    const { transform: { x, y, z } } = settings;
    return m.HEZ
        .rotate("x", x, false)
        .rotate("y", y, false)
        .rotate("z", z, false);
}

/** Resets both plots to their initial empty state. */
function resetPlots() {
    Plotly.react(plotsDiv,
        structuredClone(plotsInit.traces), plotsInit.layout, plotsInit.config);
    Plotly.react(sparkDiv,
        structuredClone(slInit.traces), slInit.layout, slInit.config);
}

/**
 * Recomputes the moving-average overlay (H, E, Z, Magnitude, Temperature) from
 * the current raw buffer and redraws traces 5-9 in a single restyle. Used when
 * the whole series must be rebuilt at once (toggle on, window change, rotation
 * change, file load).
 */
function recomputeFiltered() {
    const smoothed = movingAverage(measurements, settings.filter.windowSec);
    const x = smoothed.map(m => m.ts);
    const vectors = smoothed.map(rotatedHEZ);
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
    if (settings.filter.enabled && measurements.length > 0) {
        recomputeFiltered();
    }
    syncFilterVisual();
}

function updateCoordGraphs() {
    const vectors = measurements.map(rotatedHEZ);
    // Only the coordinate graphs actually change. The magnitude will remain
    // the same.
    /** @type {[0, 1, 2]} */
    const traces = [0, 1, 2];
    Plotly.restyle(plotsDiv, {
        y: traces.map(t => vectors.map(v => v[t]))
    }, traces);
    // The smoothed overlay depends on the same rotation, so rebuild it too.
    if (settings.filter.enabled) {
        recomputeFiltered();
    }
}

// Toggle sidebar
const sideToggle = document.getElementById("sideToggle");
sideToggle.addEventListener("click", ev => {
    const sidebar = document.getElementById("config");

    // Adjust the layout to account for missing element.
    if (sideToggle.classList.contains("fa-xmark")) {
        sidebar.style.transform = "translateX(-100%)";
    } else {
        sidebar.style.transform = "translateX(0)";
    }

    sideToggle.classList.toggle("fa-bars");
    sideToggle.classList.toggle("fa-xmark");
});

// Set rotation deltas
// TODO: Add some indication that the rotation isn't saved?
rotX.addEventListener("input", ev => {
    xDel.textContent = ev.target.value;
});
rotY.addEventListener("input", ev => {
    yDel.textContent = ev.target.value;
});
rotZ.addEventListener("input", ev => {
    zDel.textContent = ev.target.value;
});
document.getElementById("saveRot").addEventListener("click", ev => {
    settings.transform.x = rotX.value;
    settings.transform.y = rotY.value;
    settings.transform.z = rotZ.value;
    saveSettings();
    updateCoordGraphs();
    rebuildSpreadsheet();
});

// Moving-average filter controls
const filterGroup = document.getElementById("filterGroup");
const filterWindow = document.getElementById("filterWindow");
const filterOff = filterGroup.querySelector('button[name="off"]');
const filterOn = filterGroup.querySelector('button[name="on"]');

// Load the saved filter state into the controls. The active button in a
// select-group is shown by disabling it (see .select-group:disabled in CSS).
filterWindow.value = String(settings.filter.windowSec);
filterOff.disabled = !settings.filter.enabled;
filterOn.disabled = settings.filter.enabled;
// Apply the saved filter to the freshly created plot so a refresh with the
// filter enabled shows the overlay (and faded raw) instead of a hidden one.
refreshFilter();

/** @param {boolean} enabled */
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
    if (!FILTER_WINDOWS.includes(windowSec)) return;
    settings.filter.windowSec = windowSec;
    saveSettings();
    if (settings.filter.enabled) {
        recomputeFiltered();
    }
});

function updateRange() {
    const { ts: latest } = measurements[measurements.length - 1];
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

timeSelect.addEventListener("change", ev => {
    const newRange = ev.target.value;
    settings.displayWindow = newRange;
    saveSettings();
    autofollow = true;
    updateRange();
});

/**
 *
 * @param {Measurement} measurement
 */
function extendAllTraces(measurement) {
    const dispVec = rotatedHEZ(measurement);
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
        const smoothed = trailingAverageAt(
            measurements, measurements.length - 1, settings.filter.windowSec);
        const filtVec = rotatedHEZ(smoothed);
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
    while (sparklines.length > SPARK_BUF_MAX) {
        sparklines.shift();
    }
    const newSlTraces = buildSparklineTraces(sparklines);
    Plotly.react(sparkDiv, newSlTraces, slInit.layout, slInit.config);
}

/**
 * Builds the spreadsheet table row for a measurement, applying the current
 * coordinate transform. The moving-average filter intentionally does not affect
 * the spreadsheet — it always shows the rotated raw reading.
 * @param {Measurement} measurement
 * @returns {string} the `<tr>` markup for this measurement
 */
function spreadsheetRowHTML(measurement) {
    // Reformat the date for the spreadsheet. Specifically, we want this to be
    // in local time on the client end for their convenience.
    const date = new Intl.DateTimeFormat("en-US", {
        hour12: false,
        month: "numeric",
        day: "numeric",
        year: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
    }).format(measurement.ts);

    // Apply coordinate system and transform deltas
    const dispVector = rotatedHEZ(measurement);

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

/**
 * Rebuilds every spreadsheet row from the buffered measurements. Used when the
 * coordinate transform changes so that existing rows reflect it too, not just
 * rows added afterward.
 */
function rebuildSpreadsheet() {
    // measurements run oldest -> newest, but the table shows newest at the top.
    document.querySelector("#spreadsheet table tbody").innerHTML =
        measurements.map(spreadsheetRowHTML).reverse().join("");
}

/**
 *
 * @param {Measurement} m
 */
function updateCurrentTable(m) {
    const h = document.getElementById("h");
    const e = document.getElementById("e");
    const z = document.getElementById("z");
    const magnitude = document.getElementById("mag");
    const temperature = document.getElementById("temp");

    const dispVec = rotatedHEZ(m);

    h.textContent = dispVec[0].toFixed(3);
    e.textContent = dispVec[1].toFixed(3);
    z.textContent = dispVec[2].toFixed(3);
    magnitude.textContent = m.HEZ.magnitude.toFixed(3);
    temperature.textContent = m.celsius.toFixed(2);
}

/**
 * Callback handler for each magnetometer reading.
 * @param {CustomEvent<MagUsbJson>} ev
 */
function onMagRead(ev) {
    // Extract the JSON attributes and convert to in-house object. This will
    // allow us to do common operations much easier.
    const { detail: { ts, rt: tmp, x, y, z } } = ev;
    const measurement = new Measurement(ts, tmp, x, y, z);
    // The table is currently unreadable with the raw values. This scale is
    // just temporary until we reach a better solution.
    // measurement.setScale(1/1000);

    // A zero reading on rt is a host problem, not a dashboard problem. We
    // should alert the client of the problem and then kill the connection.
    if (!measurement.celsius &&
        measurement.XYZ.equals(measurements[measurements.length - 1].XYZ)) {
        document.dispatchEvent(new CustomEvent("magerror", {
            detail: {
                message: "Hardware Error:\n" +
                "The magnetometer was disconnected from the host. Check the " +
                "host machine and the magnetometer for faulty cabling. " +
                "Restart mag-usb after the problem is resolved."
            },
        }));
        return;
    }

    measurements.push(measurement);
    while (measurements.length > PLOTS_BUF_MAX) {
        measurements.shift();
    }
    sBucket.push(measurement);
    addSpreadsheetRow(measurement);
    updateCurrentTable(measurement);
    extendAllTraces(measurement);
    if (sBucket.length >= SL_BUCKET_MAX) {
        const bAgg = reduceBucket(sBucket);
        sBucket.length = 0;
        sparklines.push(bAgg);
        updateSparks();
    }
    if (autofollow) {
        updateLock = true;
        updateRange();
        updateLock = false;
    }
}

document.addEventListener("magread", onMagRead);
plotsDiv.on("plotly_relayout", ev => {
    if (!updateLock && (
        "xaxis.range[0]" in ev &&
        "xaxis.range[1]" in ev
    )) {
        autofollow = false;
        console.log("autofollow disabled");
    }
});
plotsDiv.on("plotly_doubleclick", ev => {
    autofollow = true;
    updateLock = true;
    updateRange();
    updateLock = false;
});

// Reset the graphs and clear the spreadsheet
document.addEventListener("magclose", ev => {
    document.querySelector("#spreadsheet table tbody").innerHTML = "";
    measurements.length = 0;
    sparklines.length = 0;
    sBucket.length = 0;
    resetPlots();
    // resetPlots() restores the overlay traces to their hidden default, so
    // re-apply the fade/visibility that matches the current filter setting.
    syncFilterVisual();
});

/**
 * Loads a JSONL .log file into the dashboard, replacing the current buffer.
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
            measurements.length = 0;
            measurements.push(...logs);
            const times = logs.map(({ ts }) => ts);
            Plotly.update(plotsDiv, {
                x: [times, times, times, times, times],
                y: [
                    logs.map(({ HEZ }) => HEZ[0]),
                    logs.map(({ HEZ }) => HEZ[1]),
                    logs.map(({ HEZ }) => HEZ[2]),
                    logs.map(({ HEZ }) => HEZ.magnitude),
                    logs.map(m => m.celsius),
                ]
            }, {
                "xaxis.range": [logs[0].ts, logs[logs.length - 1].ts],
            }, [0, 1, 2, 3, 4]);
            // Rebuild the moving-average overlay for the freshly loaded data.
            refreshFilter();
            window.MagConnection.setStatus(4);
        });
}

// --- Connection panel (issue #20) ---
const srcName = document.getElementById("srcName");
const connType = document.getElementById("connType");
const wsUrl = document.getElementById("wsUrl");
const wsUrlErr = document.getElementById("wsUrlErr");
const mqttBroker = document.getElementById("mqttBroker");
const mqttTopic = document.getElementById("mqttTopic");
const mqttUser = document.getElementById("mqttUser");
const mqttPass = document.getElementById("mqttPass");
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

// Load saved connection settings into the form.
const conn = settings.connection;
srcName.value = conn.name ?? "";
wsUrl.value = conn.websocket?.url ?? "";
mqttBroker.value = conn.mqtt?.broker ?? "";
mqttTopic.value = conn.mqtt?.topic ?? "";
mqttUser.value = conn.mqtt?.username ?? "";
mqttPass.value = conn.mqtt?.password ?? "";
showTypeFields(conn.type ?? "websocket");

// Switch source type (only changes which fields are shown; doesn't connect).
typeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        settings.connection.type = btn.name;
        saveSettings();
        wsUrlErr.textContent = "";
        fileErr.textContent = "";
        showTypeFields(btn.name);
    });
});

// Clear validation messages as the user edits.
wsUrl.addEventListener("input", () => { wsUrlErr.textContent = ""; });
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
    const { type } = settings.connection;
    // Persist the current form values regardless of type.
    settings.connection.name = srcName.value.trim();
    settings.connection.websocket.url = wsUrl.value.trim();
    settings.connection.mqtt = {
        broker: mqttBroker.value.trim(),
        topic: mqttTopic.value.trim(),
        username: mqttUser.value,
        password: mqttPass.value,
    };

    if (type === "websocket") {
        if (!isValidWsUrl(settings.connection.websocket.url)) {
            wsUrlErr.textContent = "Enter a ws:// or wss:// URL.";
            return;
        }
        saveSettings();
        window.MagConnection.connect(settings.connection);
    } else if (type === "mqtt") {
        // Settings persist now; live ingestion arrives with issue #19.
        saveSettings();
        alert("MQTT support is coming soon. Your settings have been saved.");
    } else if (type === "file") {
        if (!logfile.files || logfile.files.length === 0) {
            fileErr.textContent = "Choose a .log file first.";
            return;
        }
        saveSettings();
        loadLogFile(logfile.files[0]).catch(err => {
            console.error(err);
            fileErr.textContent = err.message;
        });
    }
});

// --- Collapsible panels ---
document.querySelectorAll("#config .panel-header").forEach(header => {
    header.addEventListener("click", () => {
        const panel = header.closest(".panel");
        panel.dataset.collapsed = String(panel.dataset.collapsed !== "true");
    });
});

/**
 * @typedef {object} MagUsbJson
 * @prop {string} ts
 * @prop {number} rt
 * @prop {number} x
 * @prop {number} y
 * @prop {number} z
 */

/**
 * @typedef {object} DashSettings
 * @prop {boolean} inHEZ
 * @prop {string} displayWindow
 * @prop {object} transform
 * @prop {number} transform.x
 * @prop {number} transform.y
 * @prop {number} transform.z
 * @prop {object} filter
 * @prop {boolean} filter.enabled
 * @prop {number} filter.windowSec
 * @prop {DataSource[]} sources
 */

/**
 * @typedef {object} DataSource
 * @prop {string} name
 * @prop {"Live"|"Static"|"Unknown"} type
 * @prop {string} url
 */