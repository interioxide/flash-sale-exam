import type { FlashSaleRepository } from "../repos/flashSaleRepository";
import { SalePhase, type PurchaseResult } from "../domain/types";

export interface SaleStatusResponse {
    phase: SalePhase;
    productName: string;
    startsAt: string;
    endsAt: string;
    remainingStock: number | null;
}

export class FlashSaleService {
    constructor(
        private readonly repo: FlashSaleRepository,
        private readonly getNow: () => Date,
        private readonly saleStart: Date,
        private readonly saleEnd: Date,
        private readonly productName: string,
        private readonly exposeStock: boolean,
    ) {}

    getSaleStatus(): SaleStatusResponse {
        const now = this.getNow();
        const phase = this.phaseAt(now);

        const base: SaleStatusResponse = {
            phase,
            productName: this.productName,
            startsAt: this.saleStart.toISOString(),
            endsAt: this.saleEnd.toISOString(),
            remainingStock: null,
        };

        return base;
    }

    async getSaleStatusWithStock(): Promise<SaleStatusResponse> {
        const status = this.getSaleStatus();
        if (this.exposeStock && status.phase === SalePhase.Active) {
            status.remainingStock = await this.repo.getRemainingStock();
        }
        return status;
    }

    async getUserPurchaseStatus(
        userId: string,
    ): Promise<{ purchased: boolean }> {
        const purchased = await this.repo.hasUserPurchased(userId);
        return { purchased };
    }

    fillStock(amount: number): Promise<number> {
        return this.repo.fillStock(amount);
    }

    attemptPurchase(userId: string): Promise<PurchaseResult> {
        return this.repo.attemptPurchase(userId.trim());
    }

    private phaseAt(now: Date): SalePhase {
        const t = now.getTime();
        if (t < this.saleStart.getTime()) return SalePhase.Upcoming;
        if (t > this.saleEnd.getTime()) return SalePhase.Ended;
        return SalePhase.Active;
    }

    getRemainingStock(): Promise<number> {
        return this.repo.getRemainingStock();
    }
}
