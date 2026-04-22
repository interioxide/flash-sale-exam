import dotenv from "dotenv";

dotenv.config();

function parseDate(name: string, fallback: string): Date {
    const raw = process.env[name] ?? fallback;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date for ${name}: ${raw}`);
    }
    return date;
}

export const config = {
    port: parseInt(process.env.PORT ?? "3001", 10),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    sale: {
        start: parseDate("SALE_START", "2026-01-01T00:00:00.000Z"),
        end: parseDate("SALE_END", "2099-12-31T23:59:59.999Z"),
        totalStock: Math.max(0, parseInt(process.env.TOTAL_STOCK ?? "100", 10)),
        productName: process.env.PRODUCT_NAME ?? "Limited Edition Product",
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
        max: parseInt(process.env.RATE_LIMIT_MAX ?? "10000", 10),
    },
} as const;
