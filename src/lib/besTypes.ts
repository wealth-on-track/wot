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
