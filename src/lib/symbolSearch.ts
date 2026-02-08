import { AssetCategory, LegacyAssetType } from './assetCategories';

export interface SymbolOption {
    symbol: string;
    fullName: string;
    exchange: string;
    category?: AssetCategory;  // New 8-category system
    type: LegacyAssetType;     // Legacy field for backward compatibility
    currency: string;
    country?: string;
    sector?: string;
    rawName?: string;
    source?: 'TEFAS' | 'YAHOO' | 'MANUAL' | 'INVESTING';
}

export function getCountryFlag(countryCode?: string): string {
    const flags: Record<string, string> = {
        'US': '🇺🇸',
        'NL': '🇳🇱',
        'CA': '🇨🇦',
        'DE': '🇩🇪',
        'GB': '🇬🇧',
        'TR': '🇹🇷',
        'FR': '🇫🇷',
        'CH': '🇨🇭',
        'JP': '🇯🇵',
        'CN': '🇨🇳',
        'HK': '🇭🇰',
        'IN': '🇮🇳',
        'AU': '🇦🇺',
        'BR': '🇧🇷',
    };
    return countryCode ? flags[countryCode] || '🌐' : '🌐';
}

export function getCountryFromExchange(exchange?: string): string | undefined {
    if (!exchange) return undefined;
    const e = exchange.toUpperCase();
    if (['NMS', 'NYQ', 'NCM', 'NGM', 'ASE', 'PNK', 'NAS'].includes(e)) return 'US';
    if (['LSE', 'IOB'].includes(e)) return 'GB';
    if (['IST'].includes(e)) return 'TR';
    if (['AMS', 'EBS'].includes(e)) return 'NL'; // EBS is swiss but often grouped
    if (['PAR'].includes(e)) return 'FR';
    if (['GER', 'BER', 'DUS', 'FRA', 'HAM', 'HAN', 'MUN', 'STU'].includes(e)) return 'DE';
    if (['SWX', 'VTX', 'EBS'].includes(e)) return 'CH'; // SIX Swiss Exchange
    if (['TOR', 'VAN', 'CNQ'].includes(e)) return 'CA';
    if (['HKG'].includes(e)) return 'HK';
    return undefined;
}

export function getExchangeName(exchange?: string): string {
    if (!exchange) return '';
    const e = exchange.toUpperCase();
    const map: Record<string, string> = {
        'NMS': 'NASDAQ',
        'NYQ': 'NYSE',
        'NAS': 'NASDAQ',
        'IST': 'Borsa Istanbul',
        'LSE': 'London',
        'AMS': 'Amsterdam',
        'PAR': 'Paris',
        'SWX': 'Switzerland',
        'TOR': 'Toronto',
        'CCC': 'Crypto',  // Yahoo returns CCC for crypto
        'CCc': 'Crypto',  // Legacy fallback
    };
    return map[e] || exchange;
}
