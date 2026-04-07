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

/**
 *
 * @param {string} markCol
 * @param {string} name
 * @param {number} index
 * @returns {Plotly.Data}
 */
function makeTrace(markCol, name, index = 1) {
    return {
        type: "scattergl",
        mode: "lines",
        marker: { color: markCol },
        x: [],
        y: [],
        line: { width: 2 },
        hovertemplate: `%{y:.3f}<extra></extra>`,
        name: name,
        xaxis: index === 1 ? "x" : `x${index}`,
        yaxis: index === 1 ? "y" : `y${index}`,
    };
}

/**
 *
 * @param {number} anchor
 * @returns {Partial<Plotly.LayoutAxis>}
 */
function configXAxis(anchor) {
    const xaxis = {
        type: "date",
        autorange: false,
        showgrid: true,
        gridcolor: "#e5e7eb",
        gridwidth: 1,
        zeroline: false,
        tickformat: "%H:%M:%S",
        nticks: 8,
        anchor: anchor === 1 ? "y" : `y${anchor}`,
        showticklabels: anchor === 5,
    };
    if (anchor !== 1) {
        xaxis.matches = "x";
    }
    return xaxis;
}

// Init the graphs for each component
const xaxis1 = configXAxis(1);
// xaxis1.rangeselector = {
//     buttons: [{
//         step: "second",
//         stepmode: "backward",
//         count: 60,
//         label: "1min",
//     }, {
//         step: "second",
//         stepmode: "backward",
//         count: 300,
//         label: "5min",
//     }, {
//         step: "minute",
//         stepmode: "backward",
//         count: 15,
//         label: "15min",
//     }, {
//         step: "minute",
//         stepmode: "backward",
//         count: 60,
//         label: "1h"
//     }, {
//         step: "all",
//     }],
// };
const xaxis5 = configXAxis(5);
xaxis5.side - "bottom";
xaxis5.rangeslider = {
    visible: true,
    thickness: 0.05,
};
const plotsDiv = document.getElementById("plots");
const plots = Plotly.newPlot(plotsDiv, [
    makeTrace("#f00", "H (nT)"),
    makeTrace("#0f0", "E (nT)", 2),
    makeTrace("#00f", "Z (nT)", 3),
    makeTrace("#f0f", "Magnitude (nT)", 4),
    makeTrace("#ffae00", "Remote (°C)", 5),
], {
    template: "plotly_white",
    margin: { l: 50, r: 0, t: 0, b: 20, pad: 0 },
    grid: {
        rows: 5,
        columns: 1,
        pattern: "independent",
        roworder: "top to bottom",
    },
    paper_bgcolor: "#fff",
    plot_bgcolor: "#f7f9fb",
    hovermode: "x unified",
    hoversubplots: "all",
    xaxis: xaxis1,
    xaxis2: configXAxis(2),
    xaxis3: configXAxis(3),
    xaxis4: configXAxis(4),
    xaxis5: xaxis5,
    yaxis:  {
        domain: [0.81, 1.0],
        anchor: "x",
    },
    yaxis2: {
        domain: [0.61, 0.8],
        anchor: "x",
    },
    yaxis3: {
        domain: [0.41, 0.6],
        anchor: "x",
    },
    yaxis4: {
        domain: [0.21, 0.40],
        anchor: "x",
    },
    yaxis5: {
        domain: [0.1, 0.2],
        anchor: "x",
    },
    legend: {
        orientation: "h",
        xanchor: "left",
        yanchor: "bottom",
        xref: "paper",
        yref: "paper",
        x: 0.5,
        y: 1.0,
        width: 1,
        bgcolor: "transparent",
    },
    transition: {
        duration: 250,
        easing: "cubic",
    },
    uirevision: "true",
}, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
    scrollZoom: true,
});
let autofollow = true;
let updateLock = false;

function addAllTraces() {
    Plotly.addTraces(plotsDiv, [
        makeTrace("#f00", "H (nT)"),
        makeTrace("#0f0", "E (nT)", 2),
        makeTrace("#00f", "Z (nT)", 3),
        makeTrace("#f0f", "Magnitude (nT)", 4),
        makeTrace("#ffae00", "Remote (°C)", 5),
    ]);
}

function deleteAllTraces() {
    Plotly.deleteTraces(plotsDiv, [0, 1, 2, 3, 4]);
}

function updateCoordGraphs() {
    const { transform: { x: rX, y: rY, z: rZ } } = settings;
    const vectors = measurements.map(m =>
        (settings.inHEZ ? m.HEZ : m.XYZ)
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
    updateLock = true;
    Plotly.Plots.resize(plotsDiv);
    updateLock = false;
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
    const dispVec = (settings.inHEZ ? measurement.HEZ : measurement.XYZ)
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
    const dispVector = (settings.inHEZ ? measurement.HEZ : measurement.XYZ)
        .rotate("x", settings.transform.x, false)
        .rotate("y", settings.transform.y, false)
        .rotate("z", settings.transform.z, false);

    // Add the new row to the top of the table.
    document.querySelector("#spreadsheet table tbody").insertAdjacentHTML(
        "afterbegin", `
        <tr>
            <td>${date}</td>
            <td>${measurement.celsius.toFixed(2)}</td>
            <td>${dispVector.magnitude.toFixed(3)}</td>
            <td>${dispVector[0].toFixed(3)}</td>
            <td>${dispVector[1].toFixed(3)}</td>
            <td>${dispVector[2].toFixed(3)}</td>
        </tr>`);
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
        })
        .then(logs => {
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