-- Re-add actualPreviousClose column if missing (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PriceCache' AND column_name = 'actualPreviousClose'
    ) THEN
        ALTER TABLE "PriceCache" ADD COLUMN "actualPreviousClose" DOUBLE PRECISION;
    END IF;
END $$;
