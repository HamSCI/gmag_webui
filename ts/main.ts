import "@std/dotenv/load";

function createMsgResp(status: number, msg: string): Response {
    return new Response(JSON.stringify({ message: msg, }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function getContentType(path: string): string {
    if (path === "/" || path.endsWith(".html")) {
        return "text/html";
    } else if (path.endsWith(".css")) {
        return "text/css";
    } else if (path.endsWith(".js")) {
        return "text/javascript";
    } else if (path.endsWith(".json")) {
        return "application/json";
    } else if (path.endsWith(".png")) {
        return "image/png";
    } else if (path.endsWith(".woff2")) {
        return "font/woff";
    } else {
        return "application/json";
    }
}

if (import.meta.main) {
    const hostname = Deno.env.get("HOST") ?? "0.0.0.0";
    const portRaw = Deno.env.get("PORT");
    const port = typeof portRaw !== "undefined"
        ? parseInt(portRaw)
        : 8000;
    Deno.serve({ port, hostname }, (req: Request) => {
        const url = new URL(req.url);
        const { pathname } = url;

        // Same-origin live feed.  mag-usb's own WebSocket server is bound to
        // loopback (or, even when bound wider, sits on a port that is not
        // forwarded), so a browser could never reach it directly: the page
        // loaded fine and the chart sat "disconnected" for ever, and the only
        // workaround was to type a raw ws:// URL that had to differ depending
        // on whether you came in over the LAN, a relay or RAC.  Proxying it
        // here means the socket follows the page down whatever path it was
        // opened on, and needs no configuration at all.
        //
        // Read-only on purpose: the upstream is a broadcast of samples, so
        // nothing is relayed from the browser back to the instrument.
        if (pathname === "/ws") {
            if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
                return createMsgResp(426, "Upgrade Required.");
            }
            const upstreamUrl = Deno.env.get("MAG_WS_URL")
                ?? "ws://127.0.0.1:8765/";
            const { socket, response } = Deno.upgradeWebSocket(req);

            // ⛔ WHY THIS DOES NOT USE `new WebSocket(upstreamUrl)`.
            // mag-usb's WebSocket server matches request header names
            // CASE-SENSITIVELY.  HTTP header names are case-insensitive
            // (RFC 9110 5.1) and Deno, like every HTTP/2-era client, sends
            // them lowercased -- so mag-usb answers a standards-compliant
            // client with `400 Bad Request` while a hand-rolled request using
            // `Sec-WebSocket-Key:` gets `101`.  Measured on AI6VN 2026-09-30:
            //     Canonical-Case  -> HTTP/1.1 101 Switching Protocols
            //     lowercase       -> HTTP/1.1 400 Bad Request
            // Deno's client offers no way to control header casing, so the
            // handshake is written by hand here.  This is a WORKAROUND for an
            // upstream bug: when mag-usb compares header names case-
            // insensitively, all of this collapses back to one `new WebSocket`.
            (async () => {
                const u = new URL(upstreamUrl);
                const conn = await Deno.connect({
                    hostname: u.hostname,
                    port: Number(u.port || 80),
                });
                try {
                    const key = btoa(String.fromCharCode(
                        ...crypto.getRandomValues(new Uint8Array(16))));
                    await conn.write(new TextEncoder().encode(
                        `GET ${u.pathname || "/"} HTTP/1.1\r\n` +
                        `Host: ${u.host}\r\n` +
                        "Upgrade: websocket\r\n" +
                        "Connection: Upgrade\r\n" +
                        `Sec-WebSocket-Key: ${key}\r\n` +
                        "Sec-WebSocket-Version: 13\r\n\r\n"));

                    let buf = new Uint8Array(0);
                    const push = (chunk: Uint8Array) => {
                        const merged = new Uint8Array(buf.length + chunk.length);
                        merged.set(buf); merged.set(chunk, buf.length);
                        buf = merged;
                    };
                    const find = (needle: string) => {
                        const hay = new TextDecoder().decode(buf);
                        return hay.indexOf(needle);
                    };
                    const chunk = new Uint8Array(8192);

                    // headers
                    let headerEnd = -1;
                    while (headerEnd < 0) {
                        const n = await conn.read(chunk);
                        if (n === null) throw new Error("upstream closed during handshake");
                        push(chunk.subarray(0, n));
                        headerEnd = find("\r\n\r\n");
                    }
                    const status = new TextDecoder().decode(buf.subarray(0, 32));
                    if (!status.startsWith("HTTP/1.1 101")) {
                        throw new Error("upstream refused the upgrade: " +
                                        status.split("\r\n")[0]);
                    }
                    buf = buf.subarray(headerEnd + 4);

                    // frames: server->client frames are never masked
                    const dec = new TextDecoder();
                    for (;;) {
                        while (buf.length < 2) {
                            const n = await conn.read(chunk);
                            if (n === null) return;
                            push(chunk.subarray(0, n));
                        }
                        const op = buf[0] & 0x0f;
                        let len = buf[1] & 0x7f;
                        let off = 2;
                        if (len === 126) {
                            while (buf.length < 4) {
                                const n = await conn.read(chunk);
                                if (n === null) return;
                                push(chunk.subarray(0, n));
                            }
                            len = (buf[2] << 8) | buf[3];
                            off = 4;
                        } else if (len === 127) {
                            while (buf.length < 10) {
                                const n = await conn.read(chunk);
                                if (n === null) return;
                                push(chunk.subarray(0, n));
                            }
                            len = Number(new DataView(
                                buf.buffer, buf.byteOffset + 2, 8).getBigUint64(0));
                            off = 10;
                        }
                        while (buf.length < off + len) {
                            const n = await conn.read(chunk);
                            if (n === null) return;
                            push(chunk.subarray(0, n));
                        }
                        const payload = buf.subarray(off, off + len);
                        if (op === 0x8) return;                 // upstream close
                        if ((op === 0x1 || op === 0x0) &&
                            socket.readyState === WebSocket.OPEN) {
                            socket.send(dec.decode(payload));
                        }
                        buf = buf.subarray(off + len);
                    }
                } finally {
                    try { conn.close(); } catch { /* already gone */ }
                    try { socket.close(); } catch { /* already gone */ }
                }
            })().catch((e) => {
                console.error("mag ws upstream:", e.message ?? e);
                try { socket.close(); } catch { /* already gone */ }
            });

            return response;
        }

        if (pathname === "/") {
            return new Response(Deno.readTextFileSync("./index.html"), {
                headers: {
                    "Content-Type": "text/html",
                },
            });
        } else if (pathname.endsWith(".html")
                || pathname.endsWith(".css")
                || pathname.endsWith(".js")
                || pathname.endsWith(".json")) {
            return new Response(Deno.readTextFileSync(`.${pathname}`), {
                headers: {
                    "Content-Type": getContentType(pathname),
                },
            });
        } else if (pathname.endsWith(".png")
                || pathname.endsWith(".woff2")) {
            return new Response(Deno.readFileSync(`.${pathname}`), {
                headers: {
                    "Content-Type": getContentType(pathname),
                },
            });
        } else {
            return createMsgResp(404, "Not Found.");
        }
    });
    console.log(`Running at http://${hostname}:${port}/`);
}