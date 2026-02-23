export function createMsgResp(status: number, msg: string): Response {
    return new Response(JSON.stringify({ message: msg, }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}