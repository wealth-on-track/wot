// Centralized currency rates definitions (1 EUR = X Currency)
// These are fallback rates - real-time rates are fetched from ExchangeRate table
export const RATES: Record<string, number> = {
    EUR: 1,
    USD: 1.09,
    TRY: 37.5,
    GBP: 0.85,
    CHF: 0.94,
    JPY: 162,
    CAD: 1.48,
    AUD: 1.65,
    HKD: 8.5,
    SGD: 1.45,
    ZAR: 19.5,
    CNY: 7.85,
    NZD: 1.78,
    INR: 91,
    SEK: 11.2,
    NOK: 11.5,
    DKK: 7.46,
    PLN: 4.32,
    CZK: 25.2,
    HUF: 395,
    MXN: 18.5,
    BRL: 5.35,
    KRW: 1420,
    TWD: 34,
    THB: 38,
    IDR: 17000,
    MYR: 4.8,
    PHP: 61,
    VND: 26500,
    ILS: 3.95,
    AED: 4.0,
    SAR: 4.1,
    RUB: 98
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
    'EUR': '€',
    'USD': '$',
    'TRY': '₺',
    'GBP': '£',
    'JPY': '¥',
    'CHF': 'Fr',
    'CAD': 'C$',
    'AUD': 'A$',
    'HKD': 'HK$',
    'SGD': 'S$',
    'ZAR': 'R',
    'CNY': '¥',
    'NZD': 'NZ$',
    'INR': '₹',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'CZK': 'Kč',
    'HUF': 'Ft',
    'MXN': 'Mex$',
    'BRL': 'R$',
    'KRW': '₩',
    'TWD': 'NT$',
    'THB': '฿',
    'IDR': 'Rp',
    'MYR': 'RM',
    'PHP': '₱',
    'VND': '₫',
    'ILS': '₪',
    'AED': 'د.إ',
    'SAR': '﷼',
    'RUB': '₽'
};

export const getCurrencySymbol = (currency: string): string => {
    return CURRENCY_SYMBOLS[currency] || currency;
};

// Calculate exchange rate from source currency to target currency
export const getRate = (from: string, to: string, customRates?: Record<string, number>): number => {
    const rates = customRates || RATES;
    const fromRate = rates[from];
    const toRate = rates[to];

    // Fallback if currency not found
    if (!fromRate || !toRate) return 1;

    return toRate / fromRate;
};

// Convert value
export const convertCurrency = (amount: number, from: string, to: string, customRates?: Record<string, number>): number => {
    return amount * getRate(from, to, customRates);
};
