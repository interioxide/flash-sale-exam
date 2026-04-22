import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import type { FlashSaleService } from "./services/flashSaleService";
import { createSaleRouter } from "./routes/saleRoutes";
import { config } from "./config";

export function createApp(service: FlashSaleService): express.Application {
    const app = express();

    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json());

    app.use(
        rateLimit({
            windowMs: config.rateLimit.windowMs, // In milliseconds
            limit: config.rateLimit.max, // Limit each IP  per `window`
            standardHeaders: true,
            legacyHeaders: false,
        }),
    );

    app.use("/api", createSaleRouter(service));

    return app;
}
