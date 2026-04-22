import { FlashSaleService } from "../../services/flashSaleService";
import type { FlashSaleRepository } from "../../repos/flashSaleRepository";
import {
    PurchaseStatus,
    type PurchaseResult,
    SalePhase,
} from "../../domain/types";

function mockRepo(
    overrides: Partial<FlashSaleRepository> = {},
): FlashSaleRepository {
    return {
        getRemainingStock: jest.fn().mockResolvedValue(10),
        fillStock: jest.fn().mockResolvedValue(15),
        hasUserPurchased: jest.fn().mockResolvedValue(false),
        attemptPurchase: jest.fn().mockResolvedValue({ status: "success" }),
        ...overrides,
    };
}

describe("FlashSaleService", () => {
    const start = new Date("2026-01-01T12:00:00.000Z");
    const end = new Date("2026-12-31T13:00:00.000Z");
    const now = () => new Date("2026-04-22T13:00:00.000Z");

    it("reports phases from the configured window", () => {
        const service = new FlashSaleService(
            mockRepo(),
            () => new Date("2025-12-25T01:00:00.000Z"),
            start,
            end,
            "Test Product 1",
            true,
        );
        expect(service.getSaleStatus().phase).toBe(SalePhase.Upcoming);

        const active = new FlashSaleService(
            mockRepo(),
            now,
            start,
            end,
            "Test Product",
            true,
        );
        expect(active.getSaleStatus().phase).toBe(SalePhase.Active);

        const ended = new FlashSaleService(
            mockRepo(),
            () => new Date("2027-01-01T13:00:00.000Z"),
            start,
            end,
            "Test Product 2",
            true,
        );
        expect(ended.getSaleStatus().phase).toBe(SalePhase.Ended);
    });

    it("includes remaining stock only when sale is active and flag is on", async () => {
        const repo = mockRepo({
            getRemainingStock: jest.fn().mockResolvedValue(7),
        });
        const during = new FlashSaleService(
            repo,
            now,
            start,
            end,
            "Test Product",
            true,
        );
        const st = await during.getSaleStatusWithStock();
        expect(st.remainingStock).toBe(7);

        const before = new FlashSaleService(
            repo,
            () => new Date("2027-01-01T13:00:00.000Z"),
            start,
            end,
            "Test Product",
            true,
        );
        expect(
            (await before.getSaleStatusWithStock()).remainingStock,
        ).toBeNull();
    });

    it("purchase attempts to the repository", async () => {
        const attempt = jest
            .fn()
            .mockResolvedValue({
                status: PurchaseStatus.Success,
            } satisfies PurchaseResult);
        const service = new FlashSaleService(
            mockRepo({ attemptPurchase: attempt }),
            now,
            start,
            end,
            "Test Product",
            true,
        );

        await service.attemptPurchase("  mark  ");
        expect(attempt).toHaveBeenCalledWith("mark");
    });

    it("fills stock through the repository", async () => {
        const fillStock = jest.fn().mockResolvedValue(12);
        const service = new FlashSaleService(
            mockRepo({ fillStock }),
            now,
            start,
            end,
            "Test Product",
            true,
        );

        await expect(service.fillStock(4)).resolves.toBe(12);
        expect(fillStock).toHaveBeenCalledWith(4);
    });
});
