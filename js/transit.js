/// <reference path="./index.d.ts" />

/* Connection manager. Creates independent transports (WebSocket or MQTT), one
 * per data source, so several stations can stream at once. Each instance is
 * DOM-free and reports through callbacks; the app decides how to route readings
 * and status to the right tab/session.
 *
 *   const conn = MagConnection.create(config, {
 *       onReading(json) {},          // one parsed reading
 *       onStatus(code, retry) {},    // connection status changed
 *   });
 *   conn.connect();  conn.disconnect();
 *
 *   config: { type: "websocket" | "mqtt",
 *             websocket: { url },
 *             mqtt: { broker, topic, username, password } }
 *
 *   status codes: 0 connecting, 1 connected, 2 disconnected,
 *                 3 failed/retrying, 5 auth failed
 *   (4 "file loaded" is an app-level status for File sources, not a transport.)
 */
(function () {
    /**
     * @param {object} config the source connection config
     * @param {{ onReading?: function, onStatus?: function }} handlers
     * @returns {{ connect: function, disconnect: function }}
     */
    function createConnection(config, handlers) {
        const onReading = handlers.onReading || (() => {});
        const onStatus = handlers.onStatus || (() => {});

        let ws = null;
        let mqttClient = null;
        // The URL we currently want connected, so a stale socket's backoff
        // can't resurrect a connection the user has changed or closed.
        let activeUrl = null;

        function connectWebSocket(url, retry = 0) {
            activeUrl = url;
            onStatus(retry > 0 ? 3 : 0, retry);
            const MAX_RATE = 30_000;
            let rate = retry > 0 ? 1000 * (2 ** retry - 1) : 0;
            if (rate > MAX_RATE) {
                rate = MAX_RATE;
            }

            setTimeout(() => {
                if (activeUrl !== url) {
                    return;
                }
                onStatus(0);
                ws = new WebSocket(url);

                ws.addEventListener("open", () => onStatus(1));

                ws.addEventListener("close", e => {
                    console.log("Closed", e.code);
                    if (e.code === 1006 && activeUrl === url) {
                        connectWebSocket(url, retry + 1);
                    } else {
                        onStatus(2);
                    }
                });

                ws.addEventListener("error", e => console.log(e));

                ws.addEventListener("message", e => {
                    try {
                        onReading(JSON.parse(e.data));
                    } catch (err) {
                        console.log("Bad WebSocket payload:", err);
                    }
                });
            }, rate);
        }

        function connectMqtt(cfg) {
            if (typeof mqtt === "undefined") {
                console.error("MQTT.js failed to load.");
                onStatus(2);
                return;
            }
            const { broker, topic, username, password } = cfg;
            onStatus(0);

            const opts = { reconnectPeriod: 2000 };
            if (username) {
                opts.username = username;
            }
            if (password) {
                opts.password = password;
            }
            // Set once the broker rejects credentials, so reconnect churn does
            // not overwrite the clearer "Auth failed" status.
            let authFailed = false;
            mqttClient = mqtt.connect(broker, opts);

            mqttClient.on("connect", () => {
                onStatus(1);
                mqttClient.subscribe(topic, err => {
                    if (err) {
                        console.log("MQTT subscribe error:", err);
                    }
                });
            });
            mqttClient.on("message", (_t, payload) => {
                try {
                    onReading(JSON.parse(payload.toString()));
                } catch (e) {
                    console.log("Bad MQTT payload:", e);
                }
            });
            mqttClient.on("reconnect", () => {
                if (!authFailed) {
                    onStatus(0);
                }
            });
            mqttClient.on("error", e => {
                console.log("MQTT error:", e);
                // CONNACK refusal for credentials: 4/5 (MQTT 3.1.1) or
                // 134/135 (MQTT 5). Stop retrying and surface it clearly.
                if (e && [4, 5, 134, 135].includes(e.code)) {
                    authFailed = true;
                    onStatus(5);
                    mqttClient.end(true);
                }
            });
            mqttClient.on("offline", () => {
                if (!authFailed) {
                    onStatus(2);
                }
            });
        }

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

        function connect() {
            teardown();
            if (config.type === "websocket") {
                connectWebSocket(config.websocket.url);
            } else if (config.type === "mqtt") {
                connectMqtt(config.mqtt);
            }
            // "file" sources are one-shot loads handled by the app.
        }

        function disconnect() {
            teardown();
            onStatus(2);
        }

        return { connect, disconnect };
    }

    globalThis.MagConnection = { create: createConnection };
})();
