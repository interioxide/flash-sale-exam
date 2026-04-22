import { Router, type Request, type Response } from "express";
import type { FlashSaleService } from "../services/flashSaleService";
import { PurchaseStatus } from "../domain/types";

export function createSaleRouter(service: FlashSaleService): Router {
    const router = Router();

    router.get("/sale/status", async (_req: Request, res: Response) => {
        const body = await service.getSaleStatusWithStock();
        res.json(body);
    });

    router.post("/stock/fill", async (req: Request, res: Response) => {
        const amount = req.body?.amount;
        if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            !Number.isInteger(amount) ||
            amount < 1
        ) {
            res.status(400).json({ error: "amount must be a positive integer" });
            return;
        }

        const remainingStock = await service.fillStock(amount);
        res.status(200).json({
            success: true,
            remainingStock,
        });
    });

    router.get("/purchase/status", async (req: Request, res: Response) => {
        const userId = String(req.query.userId ?? "").trim();
        if (!userId) {
            res.status(400).json({ error: "userId is required" });
            return;
        }
        const body = await service.getUserPurchaseStatus(userId);
        res.json(body);
    });

    router.post("/purchase", async (req: Request, res: Response) => {
        const userId =
            typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
        if (!userId) {
            res.status(400).json({ error: "userId is required" });
            return;
        }

        const result = await service.attemptPurchase(userId);
        switch (result.status) {
            case PurchaseStatus.Success:
                res.status(201).json({
                    success: true,
                    message: "Purchase secured.",
                });
                break;
            case PurchaseStatus.AlreadyPurchased:
                res.status(409).json({
                    success: false,
                    reason: "already_purchased",
                    message: "You have already secured an item in this sale.",
                });
                break;
            case PurchaseStatus.SoldOut:
                res.status(409).json({
                    success: false,
                    reason: "sold_out",
                    message: "All units have been allocated.",
                });
                break;
            case PurchaseStatus.SaleNotStarted:
                res.status(403).json({
                    success: false,
                    reason: "sale_not_started",
                    message: "The sale has not started yet.",
                });
                break;
            case PurchaseStatus.SaleEnded:
                res.status(403).json({
                    success: false,
                    reason: "sale_ended",
                    message: "The sale has ended.",
                });
                break;
            default:
                res.status(500).json({ error: "Unexpected state" });
        }
    });

    return router;
}
