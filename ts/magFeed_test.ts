import { assert, assertEquals } from "@std/assert";
import { acceptFor, MAX_MESSAGE, relayMagFeed } from "./magFeed.ts";

// A stand-in for mag-usb's WebSocket server.  Like the real one it matches
// header names case-sensitively, so these tests also pin the workaround.

/** Encodes an unmasked server-to-client frame. */
function frame(op: number, payload: Uint8Array | string, fin = true): Uint8Array {
    const data = typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
    const head = data.length < 126 ? 2 : data.length < 65536 ? 4 : 10;
    const out = new Uint8Array(head + data.length);
    out[0] = (fin ? 0x80 : 0) | op;
    if (head === 2) {
        out[1] = data.length;
    } else if (head === 4) {
        out[1] = 126;
        new DataView(out.buffer).setUint16(2, data.length);
    } else {
        out[1] = 127;
        new DataView(out.buffer).setBigUint64(2, BigInt(data.length));
    }
    out.set(data, head);
    return out;
}

/** Reads one masked client frame and returns its opcode and unmasked payload. */
async function readClientFrame(conn: Deno.Conn): Promise<{ op: number, payload: Uint8Array }> {
    const head = new Uint8Array(6);
    await readExactly(conn, head);
    assert(head[1] & 0x80, "client frames must be masked");
    const len = head[1] & 0x7f;
    const payload = new Uint8Array(len);
    await readExactly(conn, payload);
    for (let i = 0; i < len; i++) payload[i] ^= head[2 + (i & 3)];
    return { op: head[0] & 0x0f, payload };
}

async function readExactly(conn: Deno.Conn, into: Uint8Array): Promise<void> {
    let at = 0;
    while (at < into.length) {
        const n = await conn.read(into.subarray(at));
        if (n === null) throw new Error("eof");
        at += n;
    }
}

/** Resolves true when the peer closes `conn`, false after `ms`. */
async function closedWithin(conn: Deno.Conn, ms: number): Promise<boolean> {
    const buf = new Uint8Array(64);
    const eof = (async () => {
        try { while (await conn.read(buf) !== null) { /* drain */ } } catch { /* reset */ }
        return true;
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<boolean>((r) => { timer = setTimeout(() => r(false), ms); });
    const result = await Promise.race([eof, late]);
    clearTimeout(timer);
    return result;
}

type Script = (conn: Deno.Conn) => Promise<void>;

/**
 * Runs a fake upstream, a /ws relay in front of it and a browser-side client.
 * @returns messages the client received, once its socket closes
 */
async function run(script: Script, opts: { badAccept?: boolean, browserCloses?: number } = {}) {
    const upstream = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const served = (async () => {
        const conn = await upstream.accept();
        const buf = new Uint8Array(4096);
        let req = "";
        while (!req.includes("\r\n\r\n")) {
            const n = await conn.read(buf);
            if (n === null) return;
            req += new TextDecoder().decode(buf.subarray(0, n));
        }
        const key = /\r\nSec-WebSocket-Key: (\S+)/.exec(req)?.[1];  // case-sensitive
        if (!key) {
            await conn.write(new TextEncoder().encode("HTTP/1.1 400 Bad Request\r\n\r\n"));
            conn.close();
            return;
        }
        const accept = opts.badAccept ? "AAAAAAAAAAAAAAAAAAAAAAAAAAA=" : await acceptFor(key);
        await conn.write(new TextEncoder().encode(
            "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n" +
            `Connection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`));
        try { await script(conn); } finally { try { conn.close(); } catch { /* gone */ } }
    })();

    const upstreamUrl = `ws://127.0.0.1:${(upstream.addr as Deno.NetAddr).port}/`;
    const relayDone: Promise<void>[] = [];
    const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, (req) => {
        const { socket, response } = Deno.upgradeWebSocket(req);
        relayDone.push(relayMagFeed(socket, upstreamUrl));
        return response;
    });

    const messages: string[] = [];
    const client = new WebSocket(`ws://127.0.0.1:${server.addr.port}/ws`);
    await new Promise<void>((resolve) => {
        client.onmessage = (e) => {
            messages.push(e.data);
            if (messages.length === opts.browserCloses) client.close();
        };
        client.onclose = () => resolve();
    });

    await served;
    await Promise.all(relayDone);
    upstream.close();
    await server.shutdown();
    return messages;
}

Deno.test("relay forwards text messages and reassembles fragments", async () => {
    // "°" is two bytes in UTF-8; split it across the fragment boundary.
    const deg = new TextEncoder().encode("°");
    const messages = await run(async (conn) => {
        await conn.write(frame(0x1, '{"x":1}'));
        await conn.write(frame(0x1, new Uint8Array([0x7b, 0x22, deg[0]]), false));
        await conn.write(frame(0x0, new Uint8Array([deg[1], 0x22, 0x7d])));
        await conn.write(frame(0x2, new Uint8Array([1, 2, 3])));     // binary: dropped
        await conn.write(frame(0x1, "x".repeat(300)));                // 16-bit length
        await conn.write(frame(0x8, new Uint8Array([0x03, 0xe8])));
        const reply = await readClientFrame(conn);
        assertEquals(reply.op, 0x8, "relay echoes the close");
    });
    assertEquals(messages, ['{"x":1}', '{"°"}', "x".repeat(300)]);
});

Deno.test("relay answers upstream pings with a pong", async () => {
    await run(async (conn) => {
        await conn.write(frame(0x9, "beat"));
        const pong = await readClientFrame(conn);
        assertEquals(pong.op, 0xa);
        assertEquals(new TextDecoder().decode(pong.payload), "beat");
    });
});

Deno.test("relay drops upstream when the browser leaves", async () => {
    let dropped = false;
    await run(async (conn) => {
        await conn.write(frame(0x1, "one"));
        // Keep sending like mag-usb would; the relay must hang up on us.
        const ticker = setInterval(() => conn.write(frame(0x1, "tick")).catch(() => {}), 20);
        try {
            dropped = await closedWithin(conn, 2000);
        } finally {
            clearInterval(ticker);
        }
    }, { browserCloses: 1 });
    assert(dropped, "upstream connection was left open after the browser closed");
});

Deno.test("relay rejects an oversized frame with close 1009", async () => {
    await run(async (conn) => {
        await conn.write(frame(0x1, "x".repeat(MAX_MESSAGE + 1)));
        const close = await readClientFrame(conn);
        assertEquals(close.op, 0x8);
        assertEquals((close.payload[0] << 8) | close.payload[1], 1009);
    });
});

Deno.test("relay rejects an oversized fragmented message with close 1009", async () => {
    await run(async (conn) => {
        const half = "x".repeat(MAX_MESSAGE / 2 + 1);
        await conn.write(frame(0x1, half, false));
        await conn.write(frame(0x0, half));
        const close = await readClientFrame(conn);
        assertEquals((close.payload[0] << 8) | close.payload[1], 1009);
    });
});

Deno.test("relay rejects a masked server frame with close 1002", async () => {
    await run(async (conn) => {
        const f = frame(0x1, "hi");
        const masked = new Uint8Array([f[0], f[1] | 0x80, 0, 0, 0, 0, ...f.subarray(2)]);
        await conn.write(masked);
        const close = await readClientFrame(conn);
        assertEquals((close.payload[0] << 8) | close.payload[1], 1002);
    });
});

Deno.test("relay refuses an upstream with a bad Sec-WebSocket-Accept", async () => {
    const messages = await run(async (conn) => {
        await conn.write(frame(0x1, "should never arrive"));
    }, { badAccept: true });
    assertEquals(messages, []);
});
