import Measurement from "./Measurement.js";

// Check for previously saved settings. Init defaults if not found.
if (window.localStorage.getItem("settings") === null) {
    window.localStorage.setItem("settings", JSON.stringify({
        host: "",
        inHEZ: true,
        displayWindow: "1h",
        transform: { x: 0, y: 0, z: 0 },
    }));
}

const settings = JSON.parse(window.localStorage.getItem("settings"));
if (settings.host !== "") {
    // Fill in host and auto-connect.
}

/** @type {Measurement[]} */
const measurements = [];

// Init the graphs for each component
const hPlot = Plotly.newPlot("hDiv", [{
    type: "scatter",
    mode: "lines",
    marker: { color: "#f00" },
    x: [], y: [],
}], {
    yaxis: { title: { text: "H (nT)" }, fixedrange: true },
    margin: { l: 0, r: 0, t: 0, b: 0, pad: 4 },
}, { responsive: true });
const ePlot = Plotly.newPlot("eDiv", [{
    type: "scatter",
    mode: "lines",
    marker: { color: "#0f0" },
    x: [], y: [],
}], {
    yaxis: { title: { text: "E (nT)" }, fixedrange: true },
    margin: { l: 0, r: 0, t: 0, b: 0, pad: 4 },
}, { responsive: true });
const zPlot = Plotly.newPlot("zDiv", [{
    type: "scatter",
    mode: "lines",
    marker: { color: "#00f" },
    x: [], y: [],
}], {
    yaxis: { title: { text: "Z (nT)" }, fixedrange: true },
    margin: { l: 0, r: 0, t: 0, b: 0, pad: 4 },
}, { responsive: true });
const magPlot = Plotly.newPlot("magDiv", [{
    type: "scatter",
    mode: "lines",
    marker: { color: "#f0f" },
    x: [], y: [],
}], {
    yaxis: { title: { text: "Mag (nT)" }, fixedrange: true },
    margin: { l: 0, r: 0, t: 0, b: 0, pad: 4 },
}, { responsive: true });
const rtPlot = Plotly.newPlot("rtDiv", [{
    type: "scatter",
    mode: "lines",
    marker: { color: "#ffd900" },
    x: [], y: [],
}], {
    xaxis: { title: { text: "Time" } },
    yaxis: { title: { text: "Remote (°C)" }, fixedrange: true },
    margin: { l: 0, r: 0, t: 0, b: 0, pad: 4 },
}, { responsive: true });

// Toggle sidebar
document.getElementById("sideToggle").addEventListener("click", function(ev) {
    this.classList.toggle("fa-bars");
    this.classList.toggle("fa-xmark");

    const sidebar = document.getElementById("config");
    const [layout] = document.getElementsByClassName("layout");

    // Adjust the layout to account for missing element.
    if (this.classList.contains("fa-xmark")) {
        sidebar.style.display = "block";
        layout.style.gridTemplateColumns = "300px 1fr 400px";
    } else {
        sidebar.style.display = "none";
        layout.style.gridTemplateColumns = "1fr 400px";
    }
});

// Export CSV format
document.getElementById("csv").addEventListener("click", ev => {

});

// Export JSONL format
document.getElementById("jsonl").addEventListener("click", ev => {

});

// Convert between XYZ and HEZ
// document.getElementById("inHEZ").addEventListener("click", function(ev) {
//     inHEZ = this.checked;
// });

// Set rotation deltas
document.getElementById("rotX").addEventListener("input", ev => {
    document.getElementById("xDelta").textContent = ev.target.value;
    settings.transform.x = ev.target.value;
    window.localStorage.setItem("settings", JSON.stringify(settings));
    // Update the graphs and spreadsheet
});
document.getElementById("rotY").addEventListener("input", ev => {
    document.getElementById("yDelta").textContent = ev.target.value;
    deltas.y = ev.target.value;
    window.localStorage.setItem("settings", JSON.stringify(settings));
    // Update the graphs and spreadsheet
});
document.getElementById("rotZ").addEventListener("input", ev => {
    document.getElementById("zDelta").textContent = ev.target.value;
    deltas.z = ev.target.value;
    window.localStorage.setItem("settings", JSON.stringify(settings));
    // Update the graphs and spreadsheet
});

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
    // What might be a good idea is to treat mag-usb as a proper API and have
    // it send other JSON responses and error messages to the client.

    // This should be server-side logic.
    if (!measurement.celsius &&
        measurement.XYZ.equals(measurements[measurements.length - 1].XYZ)) {
        // TODO: Add save dialog for JSONL file
        document.dispatchEvent(new CustomEvent("magerror", {
            detail: {
                message: "Hardware Error:\n" +
                "The magnetometer was disconnected from the host. Check the " +
                "host machine and the magnetometer for faulty cabling. " +
                "Restart mag-usb after the problem is resolved.\n" +
                "A JSONL file of the logged data has been generated.",
            },
        }));
        return;
    }

    measurements.push(measurement);

    // Reformat the date for the spreadsheet. Specifically, we want this to be
    // in local time on the client end for their convenience.
    // We'll still keep the timestamps in UTC-0 when we export.
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
    const toRad = deg => deg * (Math.PI / 180);
    if (settings.transform.x) {
        dispVector = dispVector.rotate("x", toRad(settings.transform.x));
    }
    if (settings.transform.y) {
        dispVector = dispVector.rotate("y", toRad(settings.transform.y));
    }
    if (settings.transform.z) {
        dispVector = dispVector.rotate("z", toRad(settings.transform.z));
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

    // Add the data to the charts
    addData("hDiv", dispVector[0]);
    addData("eDiv", dispVector[1]);
    addData("zDiv", dispVector[2]);
    addData("magDiv", parseFloat(dispVector.magnitude.toFixed(3)));
    addData("rtDiv", measurement.celsius);

    function addData(htmlId, value) {
        Plotly.extendTraces(htmlId, {
            x: [[date]], y: [[value]]
        }, [0]);
    }
}

document.addEventListener("magread", onMagRead);

// Reset the graphs and clear the spreadsheet
document.addEventListener("magclose", ev => {
    document.querySelector("#spreadsheet table tbody").innerHTML = "";
    // Plotly.deleteTraces("hDiv", 0);
    // Plotly.deleteTraces("eDiv", 0);
    // Plotly.deleteTraces("zDiv", 0);
    // Plotly.deleteTraces("magDiv", 0);
    // Plotly.deleteTraces("rtDiv", 0);
    measurements.length = 0;
});

/**
 * @typedef {object} MagUsbJson
 * @prop {string} ts
 * @prop {number} rt
 * @prop {number} x
 * @prop {number} y
 * @prop {number} z
 */