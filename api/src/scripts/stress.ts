/**
 * Load generator: run the API first, then: cd api && npm run test:stress -- http://localhost:3001 500 40
 *
 * Args: baseUrl totalRequests concurrency
 */

import http from "http";
import https from "https";

type Method = "GET" | "POST";

function parseArgs(): { baseUrl: string; total: number; concurrency: number } {
    const [, , a0, a1, a2] = process.argv;
    const baseUrl = a0 ?? "http://127.0.0.1:3001";
    const total = Math.max(1, parseInt(a1 ?? "300", 10));
    const concurrency = Math.max(1, parseInt(a2 ?? "25", 10));
    return { baseUrl, total, concurrency };
}

function requestJson(
    method: Method,
    urlStr: string,
    body?: object,
): Promise<{ status: number; json: unknown }> {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const lib = u.protocol === "https:" ? https : http;
        const payload = body
            ? Buffer.from(JSON.stringify(body), "utf8")
            : undefined;

        const req = lib.request(
            {
                hostname: u.hostname,
                port: u.port || (u.protocol === "https:" ? 443 : 80),
                path: `${u.pathname}${u.search}`,
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...(payload
                        ? { "Content-Length": String(payload.length) }
                        : {}),
                },
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on("data", (c) => chunks.push(c as Buffer));
                res.on("end", () => {
                    const text = Buffer.concat(chunks).toString("utf8");
                    let json: unknown = text;
                    try {
                        json = JSON.parse(text);
                    } catch {
                        /* raw */
                    }
                    resolve({ status: res.statusCode ?? 0, json });
                });
            },
        );
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function main(): Promise<void> {
    const { baseUrl, total, concurrency } = parseArgs();
    console.log(
        `Stress: ${total} POST /api/purchase requests to ${baseUrl} (concurrency=${concurrency})`,
    );

    let created = 0;
    let conflict = 0;
    let forbidden = 0;
    let clientErr = 0;
    let serverErr = 0;

    let nextId = 0;

    async function worker(): Promise<void> {
        for (;;) {
            const id = nextId++;
            if (id >= total) return;

            const userId = `stress-${id}-${Math.random().toString(36).slice(2, 8)}`;
            const r = await requestJson(
                "POST",
                `${baseUrl.replace(/\/$/, "")}/api/purchase`,
                {
                    userId,
                },
            );

            if (r.status === 201) created++;
            else if (r.status === 409) conflict++;
            else if (r.status === 403) forbidden++;
            else if (r.status >= 400 && r.status < 500) clientErr++;
            else serverErr++;
        }
    }

    const t0 = Date.now();
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const ms = Date.now() - t0;

    console.log(
        JSON.stringify(
            { ms, created, conflict, forbidden, clientErr, serverErr },
            null,
            2,
        ),
    );
    console.log(`Throughput: ${((total / ms) * 1000).toFixed(1)} req/s`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
