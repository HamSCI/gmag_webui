/* Connection manager. Owns the live transport to the magnetometer host and
 * normalizes everything into the same document events the dashboard already
 * listens for:
 *   - "magread"  { detail: <reading JSON> }  one reading
 *   - "magclose"                              connection ended / reset
 *   - "magerror" { detail: { message } }      fatal hardware/transport error
 *
 * Today the only live transport is WebSocket. MQTT-over-WebSocket ingestion is
 * planned (issue #19); the config panel already collects its settings.
 *
 * index.js owns the persisted settings object, so this module only *reads*
 * localStorage (to auto-connect on load) and never writes it.
 */
(function () {
    const state = document.getElementById("status");
    let ws = null;
    // The URL we currently want to be connected to. Reconnect attempts check
    // against this so a stale socket can't resurrect a connection the user has
    // since changed or closed.
    let activeUrl = null;

    /**
     * Sets the header connection status indicator.
     * @param {number} s 0 connecting, 1 connected, 2 disconnected,
     *   3 failed/retrying, 4 file loaded
     * @param {number} [retry=0] retry count, shown for the failed state
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
            case 4:
                sText.textContent = "File loaded";
                state.className = "success";
                ico.className = "fa-solid fa-file-lines";
                break;
        }
    }

    /**
     * Opens a WebSocket connection, retrying with exponential backoff on an
     * abnormal (1006) close.
     * @param {string} url the WebSocket URL
     * @param {number} [retry=0] the current reconnect attempt count
     */
    function connectWebSocket(url, retry = 0) {
        activeUrl = url;
        setStatus(retry > 0 ? 3 : 0, retry);
        const MAX_RATE = 30_000;
        let rate = retry > 0 ? 1000 * (2 ** retry - 1) : 0;
        if (rate > MAX_RATE) {
            rate = MAX_RATE;
        }

        setTimeout(() => {
            // Bail if the user changed/closed the connection during the backoff.
            if (activeUrl !== url) {
                return;
            }
            setStatus(0);
            ws = new WebSocket(url);

            ws.addEventListener("open", () => setStatus(1));

            ws.addEventListener("close", e => {
                console.log("Closed", e.code);
                if (e.code === 1006 && activeUrl === url) {
                    connectWebSocket(url, retry + 1);
                } else {
                    setStatus(2);
                    document.dispatchEvent(new CustomEvent("magclose"));
                }
            });

            ws.addEventListener("error", e => console.log(e));

            ws.addEventListener("message", e => {
                const json = JSON.parse(e.data);
                document.dispatchEvent(new CustomEvent("magread", {
                    detail: json,
                }));
            });
        }, rate);
    }

    /** Closes any live socket without flipping the status to "Disconnected". */
    function teardown() {
        activeUrl = null;
        if (ws instanceof WebSocket) {
            ws.close(1000);
            ws = null;
        }
    }

    /**
     * Connects to a source described by a saved connection config.
     * @param {{ type: string, websocket?: { url: string } }} cfg
     */
    function connect(cfg) {
        teardown();
        if (cfg.type === "websocket") {
            connectWebSocket(cfg.websocket.url);
        } else if (cfg.type === "mqtt") {
            // Ingestion lands with issue #19; settings are persisted already.
            console.warn("MQTT transport is not implemented yet.");
            setStatus(2);
        }
        // "file" is a one-shot load handled in index.js, not a live transport.
    }

    /** Closes the live connection and resets the dashboard. */
    function disconnect() {
        teardown();
        document.dispatchEvent(new CustomEvent("magclose"));
        setStatus(2);
    }

    window.MagConnection = { connect, disconnect, setStatus };

    document.addEventListener("magerror", ({ detail: res }) => {
        alert(res.message);
        disconnect();
    });

    // Auto-connect to the previously saved source on load (WebSocket only).
    try {
        const saved = JSON.parse(window.localStorage.getItem("settings"));
        const c = saved && saved.connection;
        if (c && c.type === "websocket" && c.websocket && c.websocket.url) {
            connectWebSocket(c.websocket.url);
        }
    } catch (e) {
        console.log(e);
    }
})();
