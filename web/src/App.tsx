import { useCallback, useEffect, useMemo, useState } from "react";
import { PurchaseStatus, SalePhase } from "./domain/types";

type SaleStatus = {
    phase: SalePhase;
    productName: string;
    startsAt: string;
    endsAt: string;
    remainingStock: number | null;
};

const apiBase = import.meta.env.VITE_API_URL ?? "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    const text = await res.text();
    let body: unknown = text;
    try {
        body = JSON.parse(text);
    } catch {
        /* plain text */
    }
    if (!res.ok) {
        const err = new Error("Request failed") as Error & {
            status: number;
            body: unknown;
        };
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body as T;
}

export default function App(): JSX.Element {
    const [userId, setUserId] = useState(() => {
        const k = "flash-sale-user-id";
        const existing = localStorage.getItem(k);
        if (existing) return existing;
        const id = `user-${crypto.randomUUID().slice(0, 8)}`;
        localStorage.setItem(k, id);
        return id;
    });

    const [status, setStatus] = useState<SaleStatus | null>(null);
    const [purchaseNote, setPurchaseNote] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const refreshStatus = useCallback(async () => {
        const s = await fetchJson<SaleStatus>("/api/sale/status");
        setStatus(s);
    }, []);

    useEffect(() => {
        refreshStatus().catch(() => setStatus(null));
        const id = window.setInterval(() => {
            refreshStatus().catch(() => {});
        }, 3000);
        return () => window.clearInterval(id);
    }, [refreshStatus]);

    const phaseLabel = useMemo(() => {
        if (!status) return "Loading…";
        switch (status.phase) {
            case SalePhase.Upcoming:
                return "Upcoming";
            case SalePhase.Active:
                return "Live";
            case SalePhase.Ended:
                return "Ended";
            default:
                return status.phase;
        }
    }, [status]);

    async function onBuy(): Promise<void> {
        setLoading(true);
        setPurchaseNote(null);
        try {
            await fetchJson<{ success?: boolean }>("/api/purchase", {
                method: "POST",
                body: JSON.stringify({ userId }),
            });
            setPurchaseNote("Success — your item is reserved.");
            await refreshStatus();
        } catch (e: unknown) {
            const err = e as Error & {
                status?: number;
                body?: { reason?: string; message?: string };
            };
            const reason =
                typeof err.body === "object" &&
                err.body !== null &&
                "reason" in err.body
                    ? (err.body as { reason?: string }).reason
                    : undefined;
            let msg = "";
            switch (reason) {
                case PurchaseStatus.AlreadyPurchased:
                    msg = "You already secured an item.";
                    break;
                case PurchaseStatus.SoldOut:
                    msg = "Sold out.";
                    break;
                case PurchaseStatus.SaleNotStarted:
                    msg = "Sale has not started yet.";
                    break;
                case PurchaseStatus.SaleEnded:
                    msg = "Sale has ended.";
                    break;
                default:
                    msg =
                        (typeof err.body === "object" &&
                        err.body !== null &&
                        "message" in err.body &&
                        typeof (err.body as { message?: string }).message ===
                            "string"
                            ? (err.body as { message: string }).message
                            : null) ?? "Could not complete purchase.";
            }
            setPurchaseNote(msg);
        } finally {
            setLoading(false);
        }
    }

    async function checkReservation(): Promise<void> {
        setLoading(true);
        setPurchaseNote(null);
        try {
            const r = await fetchJson<{ purchased: boolean }>(
                `/api/purchase/status?userId=${encodeURIComponent(userId)}`,
            );
            setPurchaseNote(
                r.purchased ? "You have a reservation." : "No reservation yet.",
            );
        } catch {
            setPurchaseNote("Could not check reservation.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px" }}>
            <header style={{ marginBottom: 24 }}>
                <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>Flash Sale</h1>
                <p style={{ margin: 0, color: "#475569" }}>
                    One unit per identity, limited stock.
                </p>
            </header>

            <section
                style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: "0 1px 3px rgb(15 23 42 / 12%)",
                    marginBottom: 16,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                    }}
                >
                    <div>
                        <div style={{ fontSize: 13, color: "#64748b" }}>
                            Product
                        </div>
                        <div style={{ fontWeight: 600 }}>
                            {status?.productName ?? "…"}
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, color: "#64748b" }}>
                            Sale status
                        </div>
                        <div style={{ fontWeight: 700 }}>{phaseLabel}</div>
                    </div>
                </div>

                {status?.remainingStock !== null &&
                    status?.remainingStock !== undefined && (
                        <div
                            style={{
                                marginTop: 14,
                                fontSize: 14,
                                color: "#334155",
                            }}
                        >
                            Remaining stock (best-effort):{" "}
                            <strong>{status.remainingStock ?? "—"}</strong>
                        </div>
                    )}

                <div style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>
                    <div>
                        Starts:{" "}
                        {status
                            ? new Date(status.startsAt).toLocaleString()
                            : "—"}
                    </div>
                    <div>
                        Ends:{" "}
                        {status
                            ? new Date(status.endsAt).toLocaleString()
                            : "—"}
                    </div>
                </div>
            </section>

            <section
                style={{
                    background: "white",
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: "0 1px 3px rgb(15 23 42 / 12%)",
                }}
            >
                <label
                    style={{
                        display: "block",
                        fontSize: 13,
                        color: "#64748b",
                        marginBottom: 6,
                    }}
                >
                    Customer
                </label>
                <input
                    value={userId}
                    onChange={(ev) => setUserId(ev.target.value)}
                    style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 15,
                    }}
                />

                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 14,
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        type="button"
                        onClick={() => onBuy()}
                        disabled={loading}
                        style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            border: "none",
                            background: "#2563eb",
                            color: "white",
                            fontWeight: 600,
                            cursor: loading ? "wait" : "pointer",
                        }}
                    >
                        Buy now
                    </button>
                    <button
                        type="button"
                        onClick={() => checkReservation()}
                        disabled={loading}
                        style={{
                            padding: "10px 16px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            background: "white",
                            fontWeight: 600,
                            cursor: loading ? "wait" : "pointer",
                        }}
                    >
                        Check my status
                    </button>
                </div>

                {purchaseNote && (
                    <p
                        style={{
                            marginTop: 14,
                            marginBottom: 0,
                            color: "#0f172a",
                        }}
                    >
                        {purchaseNote}
                    </p>
                )}
            </section>
        </div>
    );
}
