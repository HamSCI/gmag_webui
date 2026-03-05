/// <reference path="./index.d.ts" />
import Measurement from "./Measurement.js";

const timeRanges = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
};

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

function makeLayout(yTitle) {
    return {
        template: "plotly_white",
        margin: { l: 50, r: 0, t: 0, b: 30 },
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#f7f9fb",
        hovermode: "x unified",
        xaxis: {
            title: { text: "Time" },
            type: "date",
            autorange: false,
            showgrid: true,
            gridcolor: "#e5e7eb",
            gridwidth: 1,
            zeroline: false,
            tickformat: "%H:%M:%S",
            nticks: 8,
            // rangeslider: { visible: true },
        },
        yaxis: {
            title: { text: yTitle },
            showgrid: true,
            gridcolor: "#e5e7eb",
            gridwidth: 1,
            zeroline: false,
            automargin: true,
        },
    };
}

function makeTrace(markCol) {
    return {
        type: "scattergl",
        mode: "lines",
        marker: { color: markCol },
        x: [],
        y: [],
        line: { width: 2 },
        hovertemplate: `%{y:.3f}<extra></extra>`,
    };
}

const plotConfig = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
    scrollZoom: true,
};

// Init the graphs for each component
const hDiv = document.getElementById("hDiv");
const eDiv = document.getElementById("eDiv");
const zDiv = document.getElementById("zDiv");
const magDiv = document.getElementById("magDiv");
const rtDiv = document.getElementById("rtDiv");

const hPlot = Plotly.newPlot(hDiv,
    [makeTrace("#f00")],
    makeLayout("H (nT)"),
    plotConfig);
const ePlot = Plotly.newPlot(eDiv,
    [makeTrace("#0f0")],
    makeLayout("E (nT)"),
    plotConfig);
const zPlot = Plotly.newPlot(zDiv,
    [makeTrace("#00f")],
    makeLayout("Z (nT)"),
    plotConfig);
const magPlot = Plotly.newPlot(magDiv,
    [makeTrace("#f0f")],
    makeLayout("Mag (nT)"),
    plotConfig);
const rtPlot = Plotly.newPlot(rtDiv,
    [makeTrace("#ffd900")],
    makeLayout("Remote(°C)"),
    plotConfig);

function addAllTraces() {
    Plotly.addTraces(hDiv,   makeTrace("#f00"));
    Plotly.addTraces(eDiv,   makeTrace("#0f0"));
    Plotly.addTraces(zDiv,   makeTrace("#00f"));
    Plotly.addTraces(magDiv, makeTrace("#f0f"));
    Plotly.addTraces(rtDiv,  makeTrace("#ffd900"));
}
function deleteAllTraces() {
    Plotly.deleteTraces(hDiv,   0);
    Plotly.deleteTraces(eDiv,   0);
    Plotly.deleteTraces(zDiv,   0);
    Plotly.deleteTraces(magDiv, 0);
    Plotly.deleteTraces(rtDiv,  0);
}

function updateCoordGraphs() {
    const { transform: { x: rX, y: rY, z: rZ } } = settings;
    const vectors = measurements.map(m => settings.inHEZ ? m.HEZ : m.XYZ)
        .map(v => v.rotate("x", rX, false)
            .rotate("y", rY, false)
            .rotate("z", rZ, false));
    // Only the coordinate graphs actually change.
    // The magnitude will remain the same.
    Plotly.restyle(hDiv, { y: [vectors.map(vec => vec[0])] }, [0]);
    Plotly.restyle(eDiv, { y: [vectors.map(vec => vec[1])] }, [0]);
    Plotly.restyle(zDiv, { y: [vectors.map(vec => vec[2])] }, [0]);
}

// Toggle sidebar
const sideToggle = document.getElementById("sideToggle");
sideToggle.addEventListener("click", ev => {
    sideToggle.classList.toggle("fa-bars");
    sideToggle.classList.toggle("fa-xmark");

    const sidebar = document.getElementById("config");
    const [layout] = document.getElementsByClassName("layout");

    // Adjust the layout to account for missing element.
    if (sideToggle.classList.contains("fa-xmark")) {
        sidebar.style.display = "block";
        layout.style.gridTemplateColumns = "300px 1fr 400px";
    } else {
        sidebar.style.display = "none";
        layout.style.gridTemplateColumns = "1fr 400px";
    }
    // Resize the plots to match the new container.
    Plotly.Plots.resize(hDiv);
    Plotly.Plots.resize(eDiv);
    Plotly.Plots.resize(zDiv);
    Plotly.Plots.resize(magDiv);
    Plotly.Plots.resize(rtDiv);
});

// Convert between XYZ and HEZ
// document.getElementById("inHEZ").addEventListener("click", function(ev) {
//     inHEZ = this.checked;
// });

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

function updateRange(graphDiv) {
    const { ts: latest } = measurements[measurements.length - 1];
    const seconds = timeRanges[settings.displayWindow] ?? timeRanges["1h"];
    const latestDiff = new Date(latest.getTime() - (seconds * 1000));
    Plotly.relayout(graphDiv, {
        "xaxis.range": [latestDiff, latest],
    });
}
function syncAllRanges() {
    updateRange(hDiv);
    updateRange(eDiv);
    updateRange(zDiv);
    updateRange(magDiv);
    updateRange(rtDiv);
}
timeSelect.addEventListener("change", ev => {
    const newRange = ev.target.value;
    settings.displayWindow = newRange;
    saveSettings();
    syncAllRanges();
});

/**
 *
 * @param {Measurement} measurement
 */
function extendAllTraces(measurement) {
    const { transform: { x: rX, y: rY, z: rZ } } = settings;
    const dispVec = (settings.inHEZ ? measurement.HEZ : measurement.XYZ)
        .rotate("x", rX, false)
        .rotate("y", rY, false)
        .rotate("z", rZ, false);
    const { ts } = measurement;
    Plotly.extendTraces(hDiv, {
        x: [[ts]], y: [[dispVec[0]]]
    }, [0]);
    Plotly.extendTraces(eDiv, {
        x: [[ts]], y: [[dispVec[1]]]
    }, [0]);
    Plotly.extendTraces(zDiv, {
        x: [[ts]], y: [[dispVec[2]]]
    }, [0]);
    Plotly.extendTraces(magDiv, {
        x: [[ts]], y: [[parseFloat(dispVec.magnitude.toFixed(3))]]
    }, [0]);
    Plotly.extendTraces(rtDiv, {
        x: [[ts]], y: [[measurement.celsius]]
    }, [0]);
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
    let dispVector = settings.inHEZ ? measurement.HEZ : measurement.XYZ;
    if (settings.transform.x) {
        dispVector = dispVector.rotate("x", settings.transform.x, false);
    }
    if (settings.transform.y) {
        dispVector = dispVector.rotate("y", settings.transform.y, false);
    }
    if (settings.transform.z) {
        dispVector = dispVector.rotate("z", settings.transform.z, false);
    }

    // Add the new row to the top of the table.
    document.querySelector("#spreadsheet table tbody").insertAdjacentHTML(
        "afterbegin", `
        <tr>
            <td>${date}</td>
            <td>${measurement.celsius}</td>
            <td>${dispVector.magnitude.toFixed(3)}</td>
            <td>${dispVector[0].toFixed(3)}</td>
            <td>${dispVector[1].toFixed(3)}</td>
            <td>${dispVector[2].toFixed(3)}</td>
        </tr>`);
}

/**
 * Callback handler for each magnetometer reading.
 * @param {CustomEvent<MagUsbJson>} event
 */
function onMagRead(event) {
    // Extract the JSON attributes and convert to in-house object. This will
    // allow us to do common operations much easier.
    const { detail: { ts, rt: tmp, x, y, z } } = event;
    const measurement = new Measurement(ts, tmp, x, y, z);

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
    addSpreadsheetRow(measurement);
    extendAllTraces(measurement);
    syncAllRanges();
}

document.addEventListener("magread", onMagRead);

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
                } catch (e) {
                    throw new Error(
                        `Cannot load file. Line ${i+1} is malformed.`);
                }
            }
            console.log(`Loaded ${uploader.files[0].name}`);
            return logs;
        })
        .then(logs => {
            measurements.length = 0;
            measurements.push(...logs);
            const times = logs.map(({ ts }) => ts);
            Plotly.update(hDiv, {
                x: [times],
                y: [logs.map(({ HEZ }) => HEZ[0])],
            }, {
                "xaxis.range": [logs[0].ts, logs[logs.length - 1].ts]
            }, [0]);
            Plotly.update(eDiv, {
                x: [times],
                y: [logs.map(({ HEZ }) => HEZ[1])],
            }, {
                "xaxis.range": [logs[0].ts, logs[logs.length - 1].ts]
            }, [0]);
            Plotly.update(zDiv, {
                x: [times],
                y: [logs.map(({ HEZ }) => HEZ[2])],
            }, {
                "xaxis.range": [logs[0].ts, logs[logs.length - 1].ts]
            }, [0]);
            Plotly.update(magDiv, {
                x: [times],
                y: [logs.map(({ HEZ }) => HEZ.magnitude)],
            }, {
                "xaxis.range": [logs[0].ts, logs[logs.length - 1].ts]
            }, [0]);
            Plotly.update(rtDiv, {
                x: [times],
                y: [logs.map(m => m.celsius)],
            }, {
                "xaxis.range": [logs[0].ts, logs[logs.length - 1].ts]
            }, [0]);
            // This currently lags the client. Need a different approach!
            // for (const log of logs) {
            //     addSpreadsheetRow(log);
            // }
        })
        .catch(err => {
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