import Redis from "ioredis";
import type { FlashSaleRepository } from "./flashSaleRepository";
import { PurchaseStatus, type PurchaseResult } from "../domain/types";

const LUA_ATTEMPT = `
local stockKey = KEYS[1]
local userKey = KEYS[2]
local nowMs = tonumber(ARGV[1])
local startMs = tonumber(ARGV[2])
local endMs = tonumber(ARGV[3])

if nowMs < startMs then
  return 'NOT_STARTED'
end
if nowMs > endMs then
  return 'ENDED'
end

if redis.call('EXISTS', userKey) == 1 then
  return 'ALREADY'
end

local stock = tonumber(redis.call('GET', stockKey))
if stock == nil or stock < 1 then
  return 'SOLD_OUT'
end

redis.call('SET', userKey, '1')
local newStock = redis.call('DECR', stockKey)
if tonumber(newStock) < 0 then
  redis.call('INCR', stockKey)
  redis.call('DEL', userKey)
  return 'SOLD_OUT'
end

return 'OK'
`;

export class RedisFlashSaleRepository implements FlashSaleRepository {
    constructor(
        private readonly redis: Redis,
        private readonly stockKey: string,
        private readonly userKeyPrefix: string,
        private readonly getNow: () => Date,
        private readonly saleStart: Date,
        private readonly saleEnd: Date,
    ) {}

    async getRemainingStock(): Promise<number> {
        const raw = await this.redis.get(this.stockKey);
        if (raw === null) return 0;
        const n = parseInt(raw, 10);
        return Number.isNaN(n) ? 0 : Math.max(0, n);
    }

    async fillStock(amount: number): Promise<number> {
        const increment = Math.max(0, Math.floor(amount));
        if (increment === 0) {
            return this.getRemainingStock();
        }

        const newStock = await this.redis.incrby(this.stockKey, increment);
        return Math.max(0, newStock);
    }

    async hasUserPurchased(userId: string): Promise<boolean> {
        const n = await this.redis.exists(this.userKey(userId));
        return n === 1;
    }

    async attemptPurchase(userId: string): Promise<PurchaseResult> {
        const nowMs = this.getNow().getTime();
        const res = (await this.redis.eval(
            LUA_ATTEMPT,
            2,
            this.stockKey,
            this.userKey(userId),
            nowMs.toString(),
            this.saleStart.getTime().toString(),
            this.saleEnd.getTime().toString(),
        )) as string;

        switch (res) {
            case "OK":
                return { status: PurchaseStatus.Success };
            case "ALREADY":
                return { status: PurchaseStatus.AlreadyPurchased };
            case "SOLD_OUT":
                return { status: PurchaseStatus.SoldOut };
            case "NOT_STARTED":
                return { status: PurchaseStatus.SaleNotStarted };
            case "ENDED":
                return { status: PurchaseStatus.SaleEnded };
            default:
                return { status: PurchaseStatus.SoldOut };
        }
    }

    private userKey(userId: string): string {
        return `${this.userKeyPrefix}:${encodeURIComponent(userId)}`;
    }

    async ensureStockInitialized(totalStock: number): Promise<void> {
        await this.redis.setnx(this.stockKey, String(Math.max(0, totalStock)));
    }
}
