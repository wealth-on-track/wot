/**
 * Parse European number format (DeGiro specific)
 * DeGiro uses comma as decimal separator ALWAYS, dot as thousands separator
 * Examples: "79005,6400" → 79005.64, "184,4300" → 184.43, "1.234,56" → 1234.56
 */
export function parseEuropeanNumber(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;

    const str = String(value).trim();
    if (str === '') return 0;

    // Remove quotes if present
    let cleaned = str.replace(/^[\"']|[\"']$/g, '');

    // DeGiro format: comma is ALWAYS decimal separator, dot is ALWAYS thousands
    const hasComma = cleaned.includes(',');

    if (hasComma) {
        // European/DeGiro format: remove dots (thousands), replace comma with dot (decimal)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // No comma: US format or simple number - remove commas (thousands)
        cleaned = cleaned.replace(/,/g, '');
    }

    // Remove any remaining non-numeric chars except . and -
    cleaned = cleaned.replace(/[^\d.\-]/g, '');

    const result = parseFloat(cleaned);
    return isNaN(result) ? 0 : result;
}
