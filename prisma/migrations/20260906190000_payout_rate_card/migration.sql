CREATE TABLE "payout_rate_card_entries" (
    "id" UUID NOT NULL,
    "source_key" VARCHAR(120) NOT NULL,
    "category_id" VARCHAR(80) NOT NULL,
    "category_name" VARCHAR(120) NOT NULL,
    "provider_name" VARCHAR(240) NOT NULL,
    "product_name" VARCHAR(500) NOT NULL,
    "payout_text" VARCHAR(120) NOT NULL,
    "percentage_rate" DECIMAL(9,6),
    "notes" VARCHAR(1000),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "effective_month" VARCHAR(40) NOT NULL DEFAULT 'JULY-2025',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "payout_rate_card_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payout_rate_card_entries_source_key_key" ON "payout_rate_card_entries"("source_key");
CREATE INDEX "payout_rate_card_entries_category_id_sort_order_idx" ON "payout_rate_card_entries"("category_id", "sort_order");
