-- Fill NULL values with defaults before making fields required
UPDATE "Asset" 
SET 
  exchange = COALESCE(exchange, 'UNKNOWN'),
  sector = COALESCE(sector, 'UNKNOWN'),
  country = COALESCE(country, 'UNKNOWN'),
  isin = COALESCE(isin, 'UNKNOWN')
WHERE 
  exchange IS NULL 
  OR sector IS NULL 
  OR country IS NULL 
  OR isin IS NULL;
