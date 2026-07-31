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