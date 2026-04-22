import Redis from "ioredis";
import { config } from "./config";
import type { FlashSaleRepository } from "./repos/flashSaleRepository";
import { RedisFlashSaleRepository } from "./repos/redisFlashSaleRepository";

const STOCK_KEY = "flash:sale:stock:v1";
const USER_PREFIX = "flash:sale:user:v1";

export async function createRepository(
    getNow: () => Date,
): Promise<FlashSaleRepository> {
    const redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
            if (times > 10) return null;
            return Math.min(times * 50, 2000);
        },
    });

    redis.on("error", (err) => {
        console.error("[redis] connection error:", err.message);
    });

    const repo = new RedisFlashSaleRepository(
        redis,
        STOCK_KEY,
        USER_PREFIX,
        getNow,
        config.sale.start,
        config.sale.end,
    );

    await repo.ensureStockInitialized(config.sale.totalStock);
    return repo;
}
