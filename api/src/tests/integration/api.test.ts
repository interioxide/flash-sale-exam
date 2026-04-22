import request from "supertest";
import type { Application } from "express";
import { createApp } from "../../app";
import { SalePhase } from "../../domain/types";
import { FlashSaleService } from "../../services/flashSaleService";
import { RedisFlashSaleRepository } from "../../repos/redisFlashSaleRepository";
import Redis from "ioredis";
import { config } from "../../config";

describe("Flash sale HTTP API", () => {
    let app: Application;
    const STOCK_KEY = "flash:sale:stock:v1";
    const USER_PREFIX = "flash:sale:user:v1";
    const start = new Date("2026-01-01T12:00:00.000Z");
    const end = new Date("2026-12-31T13:00:00.000Z");
    const now = () => new Date("2026-04-01T12:30:00.000Z");

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
        now,
        start,
        end,
    );
    const service = new FlashSaleService(
        repo,
        now,
        start,
        end,
        "Integration Product",
        true,
    );

    beforeEach(() => {
        app = createApp(service);
    });

    it("GET /api/sale/status returns JSON", async () => {
        const res = await request(app).get("/api/sale/status").expect(200);
        expect(res.body.phase).toBe(SalePhase.Active);
        expect(res.body.productName).toBe("Integration Product");
    });

    it("POST /api/stock/fill increases remaining stock", async () => {
        const remainingStock = await service.getRemainingStock();
        const amountToFill = 2;
        const expectedRemainingStock = remainingStock + amountToFill;
        await request(app)
            .post("/api/stock/fill")
            .send({ amount: amountToFill })
            .expect(200)
            .expect((res) => {
                expect(res.body.success).toBe(true);
                expect(res.body.remainingStock).toBe(expectedRemainingStock);
            });

        const status = await request(app).get("/api/sale/status").expect(200);
        expect(status.body.remainingStock).toBe(expectedRemainingStock);
    });

    it("POST /api/stock/fill rejects invalid amounts", async () => {
        await request(app)
            .post("/api/stock/fill")
            .send({ amount: 0 })
            .expect(400)
            .expect((res) => {
                expect(res.body.error).toBe(
                    "amount must be a positive integer",
                );
            });
    });

    it("POST /api/purchase reserves stock once per user", async () => {
        const ramdomUserId = `user-${crypto.randomUUID().slice(0, 8)}`;

        await request(app)
            .post("/api/purchase")
            .send({ userId: ramdomUserId })
            .expect(201);

        await request(app)
            .post("/api/purchase")
            .send({ userId: ramdomUserId })
            .expect(409)
            .expect((res) => {
                expect(res.body.reason).toBe("already_purchased");
            });
    });

    it("GET /api/purchase/status reflects reservation", async () => {
        const ramdomUserId = `user-${crypto.randomUUID().slice(0, 8)}`;

        await request(app)
            .post("/api/purchase")
            .send({ userId: ramdomUserId })
            .expect(201);

        const res = await request(app)
            .get("/api/purchase/status")
            .query({ userId: ramdomUserId })
            .expect(200);

        expect(res.body.purchased).toBe(true);
    });
});
