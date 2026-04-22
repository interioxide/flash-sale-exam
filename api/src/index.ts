import { createApp } from "./app";
import { config } from "./config";
import { createRepository } from "./createRepository";
import { FlashSaleService } from "./services/flashSaleService";

async function main(): Promise<void> {
    const dateNow = () => new Date();

    const repo = await createRepository(dateNow);
    const service = new FlashSaleService(
        repo,
        dateNow,
        config.sale.start,
        config.sale.end,
        config.sale.productName,
        true,
    );

    const app = createApp(service);

    app.listen(config.port, () => {
        console.log(
            `Flash sale API listening on http://localhost:${config.port}`,
        );
        console.log(
            `Sale window: ${config.sale.start.toISOString()} → ${config.sale.end.toISOString()} | Stock: ${config.sale.totalStock}`,
        );
        console.log(`Store:  "redis"}`);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
