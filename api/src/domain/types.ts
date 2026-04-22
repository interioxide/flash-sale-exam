export enum SalePhase {
    Upcoming = "upcoming",
    Active = "active",
    Ended = "ended",
}

export enum PurchaseStatus {
    Success = "success",
    AlreadyPurchased = "already_purchased",
    SoldOut = "sold_out",
    SaleNotStarted = "sale_not_started",
    SaleEnded = "sale_ended",
}

export type PurchaseResult = { status: PurchaseStatus };
