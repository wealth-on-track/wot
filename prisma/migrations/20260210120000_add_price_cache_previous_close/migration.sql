-- Add actualPreviousClose column to PriceCache
-- This stores the real regularMarketPreviousClose from Yahoo Finance
-- Needed for accurate 1D return calculations

ALTER TABLE "PriceCache" ADD COLUMN "actualPreviousClose" DOUBLE PRECISION;
