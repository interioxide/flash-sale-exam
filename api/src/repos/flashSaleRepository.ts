import type { PurchaseResult } from "../domain/types";

export interface FlashSaleRepository {
    /** Current remaining stock (best-effort for display; purchase path is authoritative). */
    getRemainingStock(): Promise<number>;
    /** Add units back into stock and return the updated remaining count. */
    fillStock(amount: number): Promise<number>;
    /** Whether this user already holds a reservation / completed purchase. */
    hasUserPurchased(userId: string): Promise<boolean>;
    /** Atomically enforce one-per-user and decrement stock when possible. */
    attemptPurchase(userId: string): Promise<PurchaseResult>;
}
