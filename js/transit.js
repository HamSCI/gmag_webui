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
    let mqttClient = null;
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
            case 5:
                sText.textContent = "Auth failed";
                state.className = "error";
                ico.className = "fa-solid fa-user-lock";
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

    /**
     * Connects to an MQTT broker over WebSocket and forwards each message as a
     * reading. MQTT.js handles its own reconnection.
     * @param {{ broker: string, topic: string, username?: string,
     *   password?: string }} cfg the MQTT connection settings
     */
    function connectMqtt(cfg) {
        if (typeof mqtt === "undefined") {
            console.error("MQTT.js failed to load.");
            setStatus(2);
            return;
        }
        const { broker, topic, username, password } = cfg;
        setStatus(0);

        const opts = { reconnectPeriod: 2000 };
        if (username) {
            opts.username = username;
        }
        if (password) {
            opts.password = password;
        }
        // Set once the broker rejects our credentials, so the retry-driven
        // "Connecting"/"Disconnected" churn doesn't overwrite the clearer
        // "Auth failed" status.
        let authFailed = false;
        mqttClient = mqtt.connect(broker, opts);

        mqttClient.on("connect", () => {
            setStatus(1);
            mqttClient.subscribe(topic, err => {
                if (err) {
                    console.log("MQTT subscribe error:", err);
                }
            });
        });
        mqttClient.on("message", (t, payload) => {
            try {
                // Same JSONL reading format as the WebSocket transport.
                const json = JSON.parse(payload.toString());
                document.dispatchEvent(new CustomEvent("magread", {
                    detail: json,
                }));
            } catch (e) {
                console.log("Bad MQTT payload:", e);
            }
        });
        mqttClient.on("reconnect", () => {
            if (!authFailed) {
                setStatus(0);
            }
        });
        mqttClient.on("error", e => {
            console.log("MQTT error:", e);
            // CONNACK refusal for credentials: 4/5 (MQTT 3.1.1) or
            // 134/135 (MQTT 5). Stop retrying and surface it clearly.
            if (e && [4, 5, 134, 135].includes(e.code)) {
                authFailed = true;
                setStatus(5);
                mqttClient.end(true);
            }
        });
        mqttClient.on("offline", () => {
            if (!authFailed) {
                setStatus(2);
            }
        });
    }

    /** Closes any live transport without flipping status to "Disconnected". */
    function teardown() {
        activeUrl = null;
        if (ws instanceof WebSocket) {
            ws.close(1000);
            ws = null;
        }
        if (mqttClient) {
            mqttClient.end(true);
            mqttClient = null;
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
            connectMqtt(cfg.mqtt);
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
        } else if (c && c.type === "mqtt" && c.mqtt && c.mqtt.broker && c.mqtt.topic) {
            connectMqtt(c.mqtt);
        }
    } catch (e) {
        console.log(e);
    }
})();
