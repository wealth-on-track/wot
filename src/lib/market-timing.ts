
/**
 * Standardized Market Status Logic
 * Handles checking if a market is currently open based on Timezone aware checks.
 */

type MarketSchedule = {
    timezone: string;
    openHour: number;
    openMinute: number;
    closeHour: number;
    closeMinute: number;
};

// Configuration for Exchanges
const MARKET_HOURS: Record<string, MarketSchedule> = {
    // Turkey (BIST) - 10:00 to 18:00
    // Note: BIST 100 has a lunch break 12:30-13:30 sometimes? 
    // Actually current BIST trading is continuous 10:00 - 18:00 for equities.
    'IST': { timezone: 'Europe/Istanbul', openHour: 10, openMinute: 0, closeHour: 18, closeMinute: 0 },
    'BIST': { timezone: 'Europe/Istanbul', openHour: 10, openMinute: 0, closeHour: 18, closeMinute: 0 },
    'TEFAS': { timezone: 'Europe/Istanbul', openHour: 9, openMinute: 0, closeHour: 18, closeMinute: 0 }, // TEFAS roughly business hours

    // US (NYSE/NASDAQ) - 09:30 to 16:00
    'US': { timezone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 },
    'NYSE': { timezone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 },
    'NASDAQ': { timezone: 'America/New_York', openHour: 9, openMinute: 30, closeHour: 16, closeMinute: 0 },

    // Europe (Euronext - Amsterdam, Paris, Brussels, etc.) - 09:00 to 17:30
    'EU': { timezone: 'Europe/Amsterdam', openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30 },
    'AMS': { timezone: 'Europe/Amsterdam', openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30 },
    'PAR': { timezone: 'Europe/Paris', openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30 },
    'XETRA': { timezone: 'Europe/Berlin', openHour: 9, openMinute: 0, closeHour: 17, closeMinute: 30 },

    // London - 08:00 to 16:30
    'LSE': { timezone: 'Europe/London', openHour: 8, openMinute: 0, closeHour: 16, closeMinute: 30 },
};

export function inferExchange(symbol: string, type?: string): string {
    if (!symbol) return 'US';
    const s = symbol.toUpperCase();

    // Explicit Suffix Logic
    if (s.endsWith('.IS')) return 'IST';
    if (s.endsWith('.AS')) return 'AMS';
    if (s.endsWith('.PA')) return 'PAR';
    if (s.endsWith('.DE')) return 'XETRA';
    if (s.endsWith('.L')) return 'LSE';
    if (s.endsWith('.TR')) return 'IST';

    // Type based inference
    if (type === 'CRYPTO') return 'CRYPTO';

    // Default assumption for no-suffix stocks (usually US)
    if (!s.includes('.')) return 'US';

    return 'US';
}

function checkTime(schedule: MarketSchedule): boolean {
    try {
        const now = new Date();

        // Get current time in target timezone
        const timeInZone = now.toLocaleTimeString('en-US', {
            timeZone: schedule.timezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });

        // timeInZone is "HH:mm"
        const [hStr, mStr] = timeInZone.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const currentMinutes = h * 60 + m;

        const openMinutes = schedule.openHour * 60 + schedule.openMinute;
        const closeMinutes = schedule.closeHour * 60 + schedule.closeMinute;

        // Simple Day Check (0=Sun, 6=Sat)
        // We need day in target timezone too because it might be Saturday in Tokyo while Friday in NY
        const dateInZoneString = now.toLocaleString('en-US', { timeZone: schedule.timezone });
        const dayInZone = new Date(dateInZoneString).getDay();

        if (dayInZone === 0 || dayInZone === 6) return false; // Weekend

        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    } catch (e) {
        console.error("Time logic error", e);
        return false;
    }
}

export function calculateMarketStatus(symbol: string, exchange?: string, type?: string): 'REGULAR' | 'CLOSED' {
    // 1. Always Open Assets
    if (type === 'CRYPTO' || symbol.includes('-USD') || symbol.includes('-EUR')) return 'REGULAR';
    if (type === 'CASH') return 'REGULAR';

    // 2. Identify Exchange
    const targetExchange = (exchange && exchange.length > 1) ? exchange.toUpperCase() : inferExchange(symbol, type);

    // 3. Map to Schedule
    let schedule = MARKET_HOURS[targetExchange];

    // Fallback Mapping
    if (!schedule) {
        if (['IS', 'IST', 'BIST', 'TEFAS'].includes(targetExchange)) schedule = MARKET_HOURS['IST'];
        else if (['NMS', 'NGM', 'UA', 'UN'].includes(targetExchange)) schedule = MARKET_HOURS['US'];
        else if (['AS', 'BR', 'MC', 'MI', 'MA'].includes(targetExchange)) schedule = MARKET_HOURS['EU']; // Generic Europe
        else schedule = MARKET_HOURS['US']; // Default to US if unknown
    }

    return checkTime(schedule) ? 'REGULAR' : 'CLOSED';
}
