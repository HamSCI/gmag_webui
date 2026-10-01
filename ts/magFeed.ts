// Same-origin relay for the live magnetometer feed.
//
// mag-usb's own WebSocket server is bound to loopback (or, even when bound
// wider, sits on a port that is not forwarded), so a browser could never
// reach it directly: the page loaded fine and the chart sat "disconnected"
// for ever, and the only workaround was to type a raw ws:// URL that had to
// differ depending on whether you came in over the LAN, a relay or RAC.
// Proxying it through the page's own server means the socket follows the
// page down whatever path it was opened on, and needs no configuration.
//
// Read-only on purpose: the upstream is a broadcast of samples, so nothing
// is relayed from the browser back to the instrument.
//
// Origin is deliberately not checked.  The feed is the same public sample
// stream the dashboard itself shows on this port, so a page on another site
// reading it gains nothing that loading the dashboard would not give it.
//
// ⛔ WHY THIS DOES NOT USE `new WebSocket(upstreamUrl)`.
// mag-usb's WebSocket server (third_party/mengrao-websocket) matches request
// header names CASE-SENSITIVELY with memcmp.  HTTP header names are
// case-insensitive (RFC 9110 5.1) and Deno, like every HTTP/2-era client,
// sends them lowercased -- so mag-usb answers a standards-compliant client
// with `400 Bad Request` while a hand-rolled request using
// `Sec-WebSocket-Key:` gets `101`.  Measured on AI6VN 2026-09-30:
//     Canonical-Case  -> HTTP/1.1 101 Switching Protocols
//     lowercase       -> HTTP/1.1 400 Bad Request
// Deno's client offers no way to control header casing, so the client side
// of RFC 6455 is written by hand here.  This is a WORKAROUND for an
// upstream bug: when mag-usb compares header names case-insensitively, all
// of this collapses back to one `new WebSocket`.

/** Default upstream: mag-usb's WebSocket server on this host. */
export const DEFAULT_UPSTREAM = "ws://127.0.0.1:8765/";

/**
 * Largest message accepted from upstream, after reassembling fragments.
 * A sample is ~100 bytes; anything near this is a broken or hostile peer.
 */
export const MAX_MESSAGE = 64 * 1024;

/** Largest handshake response accepted from upstream. */
const MAX_HEADER = 16 * 1024;

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const OP_CONT = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

/** Close codes from RFC 6455 7.4.1. */
const CLOSE_PROTOCOL_ERROR = 1002;
const CLOSE_TOO_BIG = 1009;

class ProtocolError extends Error {
    constructor(message: string, readonly code = CLOSE_PROTOCOL_ERROR) {
        super(message);
    }
}

/**
 * Sec-WebSocket-Accept for a given Sec-WebSocket-Key (RFC 6455 4.2.2).
 * @param key base64 nonce sent in the request
 */
export async function acceptFor(key: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-1", new TextEncoder().encode(key + WS_GUID));
    return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

/**
 * Encodes one client-to-server frame.  Client frames must be masked
 * (RFC 6455 5.3); only control frames are ever sent, so payloads are small.
 */
function encodeFrame(op: number, payload: Uint8Array): Uint8Array {
    const mask = crypto.getRandomValues(new Uint8Array(4));
    const frame = new Uint8Array(6 + payload.length);
    frame[0] = 0x80 | op;
    frame[1] = 0x80 | payload.length;
    frame.set(mask, 2);
    for (let i = 0; i < payload.length; i++) {
        frame[6 + i] = payload[i] ^ mask[i & 3];
    }
    return frame;
}

/** Reads from a connection into a growing buffer. */
class Reader {
    buf = new Uint8Array(0);
    #chunk = new Uint8Array(8192);

    constructor(readonly conn: Deno.Conn) {}

    /** Reads until at least `n` bytes are buffered; false at end of stream. */
    async fill(n: number): Promise<boolean> {
        while (this.buf.length < n) {
            const got = await this.conn.read(this.#chunk);
            if (got === null) return false;
            const merged = new Uint8Array(this.buf.length + got);
            merged.set(this.buf);
            merged.set(this.#chunk.subarray(0, got), this.buf.length);
            this.buf = merged;
        }
        return true;
    }

    /** Removes and returns the first `n` buffered bytes. */
    take(n: number): Uint8Array {
        const out = this.buf.slice(0, n);
        this.buf = this.buf.subarray(n);
        return out;
    }
}

/** Index of the blank line ending the HTTP headers, or -1. */
function headerEnd(buf: Uint8Array): number {
    for (let i = 0; i + 3 < buf.length; i++) {
        if (buf[i] === 13 && buf[i + 1] === 10
            && buf[i + 2] === 13 && buf[i + 3] === 10) {
            return i;
        }
    }
    return -1;
}

/**
 * Opens the upstream WebSocket and validates the handshake.
 * @returns the connection and a reader holding any bytes past the headers
 */
async function handshake(upstreamUrl: string): Promise<Reader> {
    const u = new URL(upstreamUrl);
    if (u.protocol !== "ws:") {
        // Deno.connect is plain TCP; mag-usb only ever serves ws:// anyway.
        throw new Error(`unsupported upstream scheme ${u.protocol} (only ws://)`);
    }
    const conn = await Deno.connect({
        hostname: u.hostname,
        port: Number(u.port || 80),
    });
    const reader = new Reader(conn);
    try {
        const key = btoa(String.fromCharCode(
            ...crypto.getRandomValues(new Uint8Array(16))));
        await conn.write(new TextEncoder().encode(
            `GET ${(u.pathname || "/") + u.search} HTTP/1.1\r\n` +
            `Host: ${u.host}\r\n` +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            `Sec-WebSocket-Key: ${key}\r\n` +
            "Sec-WebSocket-Version: 13\r\n\r\n"));

        let end = -1;
        while ((end = headerEnd(reader.buf)) < 0) {
            if (reader.buf.length > MAX_HEADER) {
                throw new Error("upstream handshake response too large");
            }
            if (!await reader.fill(reader.buf.length + 1)) {
                throw new Error("upstream closed during handshake");
            }
        }
        const lines = new TextDecoder().decode(reader.take(end + 4)).split("\r\n");
        if (!/^HTTP\/1\.1 101\b/.test(lines[0])) {
            throw new Error("upstream refused the upgrade: " + lines[0]);
        }
        const headers = new Headers();
        for (const line of lines.slice(1)) {
            const colon = line.indexOf(":");
            if (colon > 0) {
                headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
            }
        }
        if (headers.get("sec-websocket-accept") !== await acceptFor(key)) {
            throw new Error("upstream sent a bad Sec-WebSocket-Accept");
        }
        return reader;
    } catch (e) {
        try { conn.close(); } catch { /* already gone */ }
        throw e;
    }
}

/**
 * Relays text messages from the upstream WebSocket to `socket` until either
 * side closes.  Never sends anything from `socket` upstream.
 * @param socket the browser's socket, from Deno.upgradeWebSocket
 * @param upstreamUrl mag-usb's ws:// URL
 */
export async function relayMagFeed(socket: WebSocket, upstreamUrl: string): Promise<void> {
    let reader: Reader | null = null;
    let browserGone = false;
    // Without this, a browser that closes its tab leaves the upstream
    // connection open for ever: the loop below only ever waits on upstream,
    // and at 1 Hz upstream never goes quiet.
    socket.addEventListener("close", () => {
        browserGone = true;
        if (reader) {
            try { reader.conn.close(); } catch { /* already gone */ }
        }
    });

    try {
        reader = await handshake(upstreamUrl);
        if (browserGone) return;            // left while we were connecting
        await pump(reader, socket);
    } catch (e) {
        if (browserGone) return;            // conn.close() aborted the read
        console.error("mag ws upstream:", e instanceof Error ? e.message : e);
        if (e instanceof ProtocolError && reader) {
            const reason = new Uint8Array([e.code >> 8, e.code & 0xff]);
            try { await reader.conn.write(encodeFrame(OP_CLOSE, reason)); } catch { /* gone */ }
        }
    } finally {
        if (reader) {
            try { reader.conn.close(); } catch { /* already gone */ }
        }
        try { socket.close(); } catch { /* already gone */ }
    }
}

/** Reads frames from upstream and forwards complete text messages. */
async function pump(reader: Reader, socket: WebSocket): Promise<void> {
    const dec = new TextDecoder();
    // Fragmented message in progress: its opcode and the pieces so far.
    let msgOp = -1;
    let parts: Uint8Array[] = [];
    let partsLen = 0;

    for (;;) {
        if (!await reader.fill(2)) return;
        const b0 = reader.buf[0];
        const b1 = reader.buf[1];
        const fin = (b0 & 0x80) !== 0;
        const op = b0 & 0x0f;
        if (b1 & 0x80) {
            // Server frames are never masked (RFC 6455 5.1); the offsets
            // below would be wrong if one were.
            throw new ProtocolError("upstream sent a masked frame");
        }
        if (b0 & 0x70) {
            throw new ProtocolError("upstream set reserved bits (no extensions negotiated)");
        }

        let len = b1 & 0x7f;
        let off = 2;
        if (len === 126) {
            if (!await reader.fill(4)) return;
            len = (reader.buf[2] << 8) | reader.buf[3];
            off = 4;
        } else if (len === 127) {
            if (!await reader.fill(10)) return;
            const big = new DataView(reader.buf.buffer, reader.buf.byteOffset + 2, 8)
                .getBigUint64(0);
            if (big > BigInt(MAX_MESSAGE)) {
                throw new ProtocolError(`upstream frame of ${big} bytes`, CLOSE_TOO_BIG);
            }
            len = Number(big);
            off = 10;
        }

        const control = (op & 0x08) !== 0;
        if (control && (!fin || len > 125)) {
            throw new ProtocolError("upstream sent a fragmented or oversized control frame");
        }
        if (!control && partsLen + len > MAX_MESSAGE) {
            throw new ProtocolError(`upstream message over ${MAX_MESSAGE} bytes`, CLOSE_TOO_BIG);
        }

        if (!await reader.fill(off + len)) return;
        reader.take(off);
        const payload = reader.take(len);

        switch (op) {
            case OP_CLOSE:
                // Echo the close (RFC 6455 5.5.1), then we are done.
                await reader.conn.write(encodeFrame(OP_CLOSE, payload.subarray(0, 2)));
                return;
            case OP_PING:
                // mag-usb never pings today, but answer if a future one does.
                await reader.conn.write(encodeFrame(OP_PONG, payload));
                continue;
            case OP_PONG:
                continue;
            case OP_TEXT:
            case OP_BINARY:
                if (msgOp !== -1) {
                    throw new ProtocolError("upstream started a message mid-fragment");
                }
                msgOp = op;
                break;
            case OP_CONT:
                if (msgOp === -1) {
                    throw new ProtocolError("upstream sent a continuation with no message");
                }
                break;
            default:
                throw new ProtocolError(`upstream sent unknown opcode ${op}`);
        }

        parts.push(payload);
        partsLen += len;
        if (!fin) continue;

        // Only text is forwarded: mag-usb sends one JSON sample per message.
        if (msgOp === OP_TEXT && socket.readyState === WebSocket.OPEN) {
            const whole = new Uint8Array(partsLen);
            let at = 0;
            for (const p of parts) { whole.set(p, at); at += p.length; }
            socket.send(dec.decode(whole));
        }
        msgOp = -1;
        parts = [];
        partsLen = 0;
    }
}
