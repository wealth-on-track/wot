/**
 * Number Formatting Utilities
 *
 * TR/EU Format Standard:
 * - Thousands separator: "." (dot)
 * - Decimal separator: "," (comma)
 *
 * Examples:
 * - 1234567.89 → "1.234.567,89"
 * - 0.089545 → "0,089545"
 * - 10423485 → "10.423.485"
 */

/**
 * Format a number to TR/EU format string with thousands separator
 * @param value - Number to format
 * @param minDecimals - Minimum decimal places (default: 0)
 * @param maxDecimals - Maximum decimal places (default: 6)
 * @returns Formatted string (e.g., "1.234.567,89")
 */
export function formatNumber(
    value: number | string,
    minDecimals: number = 0,
    maxDecimals: number = 6
): string {
    if (value === null || value === undefined || value === '') return '';

    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '';

    // Format with Intl
    const formatted = new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
        useGrouping: true
    }).format(num);

    return formatted;
}

/**
 * Parse a TR/EU formatted string to a standard number
 * Handles both user input (with separators) and raw numbers
 * @param value - Formatted string (e.g., "1.234.567,89" or "0,089545")
 * @returns Standard number (e.g., 1234567.89)
 */
export function parseFormattedNumber(value: string): number {
    if (!value || value === '') return 0;

    // Remove thousands separators (dots)
    // Replace decimal separator (comma) with dot
    const cleaned = value.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format number for display in input fields
 * Preserves user's decimal precision while adding thousands separators
 * @param value - Current input value
 * @returns Formatted value with separators
 */
export function formatInputNumber(value: string): string {
    if (!value || value === '') return '';

    // Remove all dots (thousands separators)
    const cleanValue = value.replace(/\./g, '');

    // Split by comma (decimal separator)
    const parts = cleanValue.split(',');

    if (parts.length > 2) return value; // Invalid format, return as-is

    // Format integer part with dots every 3 digits
    const integerPart = parts[0];
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    // Reconstruct the value
    const formattedValue = parts.length === 2
        ? `${formattedInteger},${parts[1]}`
        : formattedInteger;

    return formattedValue;
}

/**
 * Validate if a string contains only valid number characters for TR/EU format
 * @param value - String to validate
 * @returns true if valid, false otherwise
 */
export function isValidNumberInput(value: string): boolean {
    return /^[0-9.,]*$/.test(value);
}
