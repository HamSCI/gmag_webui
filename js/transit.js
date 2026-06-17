/* This script is solely responsible for connecting to the host magnetometer
 * and transferring the magnetometer's data to the index.js script.
 * This script works fine for now as a local variant of the WebSocket hosts,
 * but later, this is all moving to the backend server in favor of serving
 * more intricate elements and visuals like the graphs and the spreadsheet.
 */

const { cookie } = document;
const host = document.getElementById("host");
const state = document.getElementById("status");
let ws = null;

// Auto-init if a previous host is stored
if (cookie.startsWith("host")) {
    const hostUrl = cookie.substring(cookie.indexOf("=") + 1);
    if (hostUrl.length) {
        initWS(hostUrl);
    }
}

document.getElementById("saveHost").addEventListener("click", ev => {
    document.dispatchEvent(new CustomEvent("magclose"));
    if (host.value.trim() === "" && ws instanceof WebSocket) {
        ws.close();
        ws = null;
        document.cookie = "";
        return;
    } else if (host.value) {
        // If a connection exists, close and free.
        // Later this will be changed to support multiple hosts.
        if (ws instanceof WebSocket) {
            ws.close(1000);
            ws = null;
        }
        initWS(host.value);
    }
});

/**
 * Initializes the WebSocket connection.
 * @param {string} url the host URL
 * @param {number} [retry=0] the current reconnect attempt count
 */
function initWS(url, retry = 0) {
    setStatus(retry > 0 ? 3 : 0, retry);
    const MAX_RATE = 30_000;
    let rate = retry > 0 ? 1000 * (2 ** retry - 1) : 0;
    if (rate > MAX_RATE) {
        rate = MAX_RATE;
    }

    setTimeout(() => {
        setStatus(0);
        ws = new WebSocket(url);
        // Only save the host if it connects.
        ws.addEventListener("open", e => {
            document.cookie = `host=${ws.url}`;
            setStatus(1);
        });

        ws.addEventListener("close", e => {
            console.log("Closed", e.code);
            if (e.code === 1006) {
                initWS(url, retry + 1);
            } else {
                setStatus(2);
                document.dispatchEvent(new CustomEvent("magclose"));
            }
        });

        ws.addEventListener("error", e => {
            console.log(e);
        });

        ws.addEventListener("message", e => {
            const { data } = e;
            const json = JSON.parse(data);
            console.log(json);
            document.dispatchEvent(new CustomEvent("magread", {
                detail: json
            }));
        });
    }, rate);
}

/**
 * Helper function for setting the connection status.
 * @param {number} s the status number
 * @param {number} retry the retry count
 */
function setStatus(s, retry = 0) {
    const [sText] = state.getElementsByTagName("span");
    const [ico] = state.getElementsByTagName("i");

    switch (s) {
        case 0:
            sText.textContent = "Connecting";
            state.className = "wait";
            ico.className = "fa-solid fa-arrows-rotate";
            break;
        case 1:
            sText.textContent = "Connected";
            state.className = "success";
            ico.className = "fa-solid fa-signal";
            break;
        case 2:
            sText.textContent = "Disconnected";
            state.className = "error";
            ico.className = "fa-solid fa-circle-xmark";
            break;
        case 3:
            sText.textContent = `Failed (${retry})`;
            state.className = "warn";
            ico.className = "fa-solid fa-triangle-exclamation";
            break;
    }
}

document.addEventListener("magerror", ({ detail: res }) => {
    alert(res.message);
    ws.close();
});