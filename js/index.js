/// <reference path="./index.d.ts" />
import Measurement from "./Measurement.js";
import { buildSparklineTraces, reduceBucket } from "./sparklines.js";
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

// Check for previously saved settings. Init defaults if not found.
if (window.localStorage.getItem("settings") === null) {
    window.localStorage.setItem("settings", JSON.stringify({
        inHEZ: true,
        displayWindow: "1h",
        transform: { x: 0, y: 0, z: 0 },
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

function addAllTraces() {
    Plotly.addTraces(plotsDiv, mainTraces);
    Plotly.addTraces(sparkDiv, slTraces);
}

function deleteAllTraces() {
    Plotly.deleteTraces(plotsDiv, [0, 1, 2, 3, 4]);
    Plotly.deleteTraces(sparkDiv, [0, 1, 2, 3, 4]);
}

function updateCoordGraphs() {
    const { transform: { x: rX, y: rY, z: rZ } } = settings;
    const vectors = measurements.map(m => m.HEZ
        .rotate("x", rX, false)
        .rotate("y", rY, false)
        .rotate("z", rZ, false));
    // Only the coordinate graphs actually change. The magnitude will remain
    // the same.
    /** @type {[0, 1, 2]} */
    const traces = [0, 1, 2];
    Plotly.restyle(plotsDiv, {
        y: traces.map(t => vectors.map(v => v[t]))
    }, traces);
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
    const { transform: { x: rX, y: rY, z: rZ } } = settings;

    const dispVec = measurement.HEZ
        .rotate("x", rX, false)
        .rotate("y", rY, false)
        .rotate("z", rZ, false);
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
    }, [0, 1, 2, 3, 4]);
}

function updateSparks() {
    while (sparklines.length > 100) {
        sparklines.shift();
    }
    const newSlTraces = buildSparklineTraces(sparklines);
    Plotly.react(sparkDiv, newSlTraces, slInit.layout, slInit.config);
}

/**
 * @param {Measurement} measurement
 */
function addSpreadsheetRow(measurement) {
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
    const dispVector = measurement.HEZ
        .rotate("x", settings.transform.x, false)
        .rotate("y", settings.transform.y, false)
        .rotate("z", settings.transform.z, false);

    // Add the new row to the top of the table.
    document.querySelector("#spreadsheet table tbody").insertAdjacentHTML(
        "afterbegin", `
        <tr>
            <td>${date}</td>
            <td>${dispVector[0].toFixed(3)}</td>
            <td>${dispVector[1].toFixed(3)}</td>
            <td>${dispVector[2].toFixed(3)}</td>
            <td>${dispVector.magnitude.toFixed(3)}</td>
            <td>${measurement.celsius.toFixed(2)}</td>
        </tr>`);
    // TODO: Remove last row once we're at max buffer size?
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

    const dispVec = m.HEZ
        .rotate("x", settings.transform.x, false)
        .rotate("y", settings.transform.y, false)
        .rotate("z", settings.transform.z, false);

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
    while (measurements.length >= PLOTS_BUF_MAX) {
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
    deleteAllTraces();
    addAllTraces();
    measurements.length = 0;
});

// JSONL File upload
document.getElementById("saveLog").addEventListener("click", ev => {
    /** @type {HTMLInputElement} */
    const uploader = document.getElementById("logfile");
    if (uploader.files.length === 0) {
        alert("Missing .log file.");
        return;
    }
    console.log(uploader.files[0].type);
    uploader.files[0].text()
        .then(text => text.trim().split("\n"))
        .then(lines => {
            /** @type {Measurement[]} */
            const logs = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                try {
                    /** @type {MagUsbJson} */
                    const json = JSON.parse(line);
                    const m = new Measurement(
                        json.ts, json.rt, json.x, json.y, json.z);
                    logs[i] = m;
                } catch (err) {
                    console.log(err);
                    throw new Error(
                        `Cannot load file. Line ${i+1} is malformed.`);
                }
            }
            console.log(`Loaded ${uploader.files[0].name}`);
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
            }, [0, 1, 2, 3, 4])
            // This currently lags the client. Need a different approach!
            // for (const log of logs) {
            //     addSpreadsheetRow(log);
            // }
        }).catch(err => {
            console.error(err);
            alert(err.message);
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
 * @prop {DataSource[]} sources
 */

/**
 * @typedef {object} DataSource
 * @prop {string} name
 * @prop {"Live"|"Static"|"Unknown"} type
 * @prop {string} url
 */