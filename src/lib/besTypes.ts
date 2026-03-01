// BES (Bireysel Emeklilik Sistemi) Types

export interface BESFund {
  code: string;      // "AH2", "AH5", "BGL", "AEA", "AET"
  name: string;      // "PPF", "Hisse Fonu", etc.
  percentage: number; // 0-100
  avgPrice?: number;  // User-entered average purchase price
  price?: number;     // Current price from TEFAS
}

export interface BESContract {
  id: string;           // "AAK1", "AAK2", etc.
  name: string;         // "AAK 1"
  contractNo?: string;  // "9055567" (optional)
  katkiPayi: number;    // Total Katki Payi value in TRY
  devletKatkisi: number; // Total Devlet Katkisi value in TRY
}

export interface BESMetadata {
  contracts: BESContract[];
  katkiPayiFunds: BESFund[];  // User-defined fund allocation for Katki Payi
  // Devlet Katkisi is always 100% AET (fixed by law)
  lastUpdated: string;  // ISO date string
}

// Default Devlet Katkisi fund (fixed by law)
export const DEVLET_KATKISI_FUND: BESFund = {
  code: 'AET',
  name: 'Katki Fonu',
  percentage: 100
};

// Common BES funds for quick selection
export const COMMON_BES_FUNDS = [
  { code: 'AH2', name: 'PPF (Para Piyasasi)' },
  { code: 'AH5', name: 'Hisse Senedi Fonu' },
  { code: 'BGL', name: 'Altin Fonu' },
  { code: 'AEA', name: 'Altin Katilim Fonu' },
  { code: 'AET', name: 'Katki Fonu' },
  { code: 'HES', name: 'Hisse Emeklilik Fonu' },
  { code: 'AH3', name: 'Dengeli Fon' },
  { code: 'AH4', name: 'Agressif Fon' },
];

// Calculate total values from BES metadata
export function calculateBESTotals(metadata: BESMetadata) {
  const totalKatkiPayi = metadata.contracts.reduce((sum, c) => sum + c.katkiPayi, 0);
  const totalDevletKatkisi = metadata.contracts.reduce((sum, c) => sum + c.devletKatkisi, 0);
  const grandTotal = totalKatkiPayi + totalDevletKatkisi;

  // Calculate fund breakdown for Katki Payi
  const katkiPayiFundBreakdown = metadata.katkiPayiFunds.map(fund => ({
    ...fund,
    value: (fund.percentage / 100) * totalKatkiPayi
  }));

  // Devlet Katkisi is always 100% AET
  const devletKatkisiFundBreakdown = [{
    ...DEVLET_KATKISI_FUND,
    value: totalDevletKatkisi
  }];

  return {
    totalKatkiPayi,
    totalDevletKatkisi,
    grandTotal,
    katkiPayiFundBreakdown,
    devletKatkisiFundBreakdown,
    contractCount: metadata.contracts.length
  };
}

// Validate that fund percentages sum to 100
export function validateFundPercentages(funds: BESFund[]): boolean {
  const total = funds.reduce((sum, f) => sum + f.percentage, 0);
  return Math.abs(total - 100) < 0.01; // Allow small floating point errors
}

// Create empty BES metadata
export function createEmptyBESMetadata(): BESMetadata {
  return {
    contracts: [],
    katkiPayiFunds: [
      { code: 'AH2', name: 'PPF', percentage: 60 },
      { code: 'AH5', name: 'Hisse Fonu', percentage: 10 },
      { code: 'BGL', name: 'Altin Fonu', percentage: 15 },
      { code: 'AEA', name: 'Altin Katilim', percentage: 15 },
    ],
    lastUpdated: new Date().toISOString()
  };
}

// BES Fund with fetched price data
export interface BESFundWithPrice extends BESFund {
  currentPrice?: number;
  priceDate?: string;
  change24h?: number;
  changePercent?: number;
}

// Asset class types for allocation breakdown
export type AllocationClass = 'STOCK' | 'BOND' | 'GOLD' | 'CASH' | 'MIXED';

// BES Fund to Asset Class mapping
// Each fund can be split into multiple asset classes
export interface FundAllocation {
  STOCK?: number;  // Percentage allocated to stocks (0-100)
  BOND?: number;   // Percentage allocated to bonds/fixed income
  GOLD?: number;   // Percentage allocated to gold/precious metals
  CASH?: number;   // Percentage allocated to money market/cash
}

// Known BES fund allocations based on fund characteristics
export const BES_FUND_ALLOCATIONS: Record<string, FundAllocation> = {
  // Para Piyasası / Money Market funds - mostly cash/short-term bonds
  'AH2': { BOND: 80, CASH: 20 },
  'PPF': { BOND: 80, CASH: 20 },

  // Hisse Senedi / Stock funds - 100% equities
  'AH5': { STOCK: 100 },
  'HES': { STOCK: 100 },
  'HSE': { STOCK: 100 },
  'AH1': { STOCK: 100 },

  // Altın / Gold funds - 100% gold
  'BGL': { GOLD: 100 },
  'AEA': { GOLD: 100 },
  'GLD': { GOLD: 100 },
  'ALT': { GOLD: 100 },

  // Dengeli / Balanced funds - mixed allocation
  'AH3': { STOCK: 50, BOND: 50 },
  'DNG': { STOCK: 50, BOND: 50 },

  // Agressif / Aggressive funds - heavy equities
  'AH4': { STOCK: 80, BOND: 20 },
  'AGR': { STOCK: 80, BOND: 20 },

  // Devlet Katkısı / Government Contribution - legally mandated: 50% BIST stocks, 50% bonds
  'AET': { STOCK: 50, BOND: 50 },
  'DKF': { STOCK: 50, BOND: 50 },

  // Tahvil/Bono / Bond funds
  'THB': { BOND: 100 },
  'BON': { BOND: 100 },
  'AH6': { BOND: 100 },

  // Kira Sertifikası / Sukuk funds
  'KRS': { BOND: 100 },
  'SUK': { BOND: 100 },
};

// Get allocation for a fund (with smart fallback based on name)
export function getFundAllocation(code: string, name?: string): FundAllocation {
  const upperCode = code.toUpperCase();

  // Check exact match first
  if (BES_FUND_ALLOCATIONS[upperCode]) {
    return BES_FUND_ALLOCATIONS[upperCode];
  }

  // Smart fallback based on fund name keywords
  if (name) {
    const upperName = name.toUpperCase();

    if (upperName.includes('HİSSE') || upperName.includes('HISSE') || upperName.includes('STOCK') || upperName.includes('EQUITY')) {
      return { STOCK: 100 };
    }
    if (upperName.includes('ALTIN') || upperName.includes('GOLD') || upperName.includes('KIYMETLİ')) {
      return { GOLD: 100 };
    }
    if (upperName.includes('PARA PİYASASI') || upperName.includes('PARA PIYASASI') || upperName.includes('LİKİT') || upperName.includes('LIKIT') || upperName.includes('PPF')) {
      return { BOND: 80, CASH: 20 };
    }
    if (upperName.includes('TAHVİL') || upperName.includes('TAHVIL') || upperName.includes('BONO') || upperName.includes('BOND')) {
      return { BOND: 100 };
    }
    if (upperName.includes('DENGELİ') || upperName.includes('DENGELI') || upperName.includes('BALANCED')) {
      return { STOCK: 50, BOND: 50 };
    }
    if (upperName.includes('AGRESİF') || upperName.includes('AGRESIF') || upperName.includes('AGGRESSIVE')) {
      return { STOCK: 80, BOND: 20 };
    }
    if (upperName.includes('KATKI') || upperName.includes('DEVLET')) {
      return { STOCK: 50, BOND: 50 };
    }
  }

  // Default: treat as balanced fund
  return { STOCK: 40, BOND: 40, CASH: 20 };
}

// Calculate BES allocation breakdown for portfolio allocation charts
export function calculateBESAllocationBreakdown(metadata: BESMetadata): {
  STOCK: number;
  BOND: number;
  GOLD: number;
  CASH: number;
} {
  const totals = calculateBESTotals(metadata);
  const result = { STOCK: 0, BOND: 0, GOLD: 0, CASH: 0 };

  // Process Katkı Payı funds
  for (const fund of totals.katkiPayiFundBreakdown) {
    const allocation = getFundAllocation(fund.code, fund.name);
    const fundValue = fund.value;

    if (allocation.STOCK) result.STOCK += fundValue * (allocation.STOCK / 100);
    if (allocation.BOND) result.BOND += fundValue * (allocation.BOND / 100);
    if (allocation.GOLD) result.GOLD += fundValue * (allocation.GOLD / 100);
    if (allocation.CASH) result.CASH += fundValue * (allocation.CASH / 100);
  }

  // Process Devlet Katkısı (always AET fund: 50% BIST stocks, 50% bonds)
  const devletKatkisiValue = totals.totalDevletKatkisi;
  result.STOCK += devletKatkisiValue * 0.5;  // 50% BIST stocks
  result.BOND += devletKatkisiValue * 0.5;   // 50% bonds

  return result;
}

// Calculate totals with current prices
export interface BESTotalsWithPrices {
  totalKatkiPayi: number;
  totalDevletKatkisi: number;
  grandTotal: number;
  katkiPayiFundBreakdown: (BESFundWithPrice & { value: number })[];
  devletKatkisiFundBreakdown: (BESFundWithPrice & { value: number })[];
  contractCount: number;
}
