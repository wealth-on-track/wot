-- CreateTable
CREATE TABLE "BenchmarkPrice" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BenchmarkPrice_symbol_date_idx" ON "BenchmarkPrice"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkPrice_symbol_date_key" ON "BenchmarkPrice"("symbol", "date");
