import { describe, it, expect } from 'vitest';
import {
    extractActualPreviousClose,
    validatePriceChange,
    getValidatedPriceFromChart,
    type ChartData
} from '@/lib/price-validation';

describe('Price Validation', () => {
    describe('extractActualPreviousClose', () => {
        it('should use meta.previousClose when available and reasonable', () => {
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: 100,
                    previousClose: 98,  // 2% change - reasonable
                    chartPreviousClose: 80  // Would be 25% - wrong
                },
                indicators: {
                    quote: [{
                        close: [95, 96, 97, 98, 100]
                    }]
                }
            };

            const result = extractActualPreviousClose(chartData);
            expect(result).toBe(98);
        });

        it('should calculate from chart closes when meta.previousClose is undefined', () => {
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: 255.78,
                    previousClose: undefined,
                    chartPreviousClose: 278.12  // Wrong - this is chart start
                },
                indicators: {
                    quote: [{
                        close: [274.62, 273.68, 275.50, 261.73, 255.78]
                    }]
                }
            };

            const result = extractActualPreviousClose(chartData);
            expect(result).toBe(261.73);  // Second-to-last = yesterday's close
        });

        it('should handle null values in closes array', () => {
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: 100,
                    chartPreviousClose: 50
                },
                indicators: {
                    quote: [{
                        close: [90, null, 95, null, 98, 100]
                    }]
                }
            };

            const result = extractActualPreviousClose(chartData);
            expect(result).toBe(98);  // Second-to-last valid close
        });

        it('should reject suspicious meta.previousClose and use chart data', () => {
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: 100,
                    previousClose: 50,  // 100% change - too suspicious
                    chartPreviousClose: 50
                },
                indicators: {
                    quote: [{
                        close: [95, 96, 97, 98, 100]
                    }]
                }
            };

            const result = extractActualPreviousClose(chartData);
            expect(result).toBe(98);  // Should use chart data instead
        });

        it('should return null when no valid data available', () => {
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: undefined
                }
            };

            const result = extractActualPreviousClose(chartData);
            expect(result).toBeNull();
        });
    });

    describe('validatePriceChange', () => {
        it('should calculate correct change for normal prices', () => {
            const result = validatePriceChange(102, 100, 'TEST');

            expect(result.changeAmount).toBe(2);
            expect(result.changePercent).toBeCloseTo(2, 1);
            expect(result.isValidated).toBe(true);
            expect(result.validationWarnings).toHaveLength(0);
        });

        it('should warn for suspicious large changes', () => {
            const result = validatePriceChange(150, 100, 'TEST');  // 50% change

            expect(result.changePercent).toBeCloseTo(50, 1);
            expect(result.validationWarnings.length).toBeGreaterThan(0);
            expect(result.validationWarnings[0]).toContain('exceeds');
        });

        it('should handle negative changes correctly', () => {
            const result = validatePriceChange(255.78, 261.73, 'AAPL');

            expect(result.changeAmount).toBeCloseTo(-5.95, 1);
            expect(result.changePercent).toBeCloseTo(-2.27, 1);
            expect(result.isValidated).toBe(true);
        });

        it('should warn for stale data (same price)', () => {
            const result = validatePriceChange(100, 100, 'TEST');

            expect(result.changePercent).toBe(0);
            expect(result.validationWarnings).toContain('Current price equals previous close - data may be stale');
        });

        it('should handle invalid prices', () => {
            const result = validatePriceChange(0, 100, 'TEST');

            expect(result.isValidated).toBe(false);
            expect(result.validationWarnings).toContain('Invalid current price');
        });
    });

    describe('getValidatedPriceFromChart', () => {
        it('should return complete validated result for good data', () => {
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: 255.78,
                    symbol: 'AAPL'
                },
                indicators: {
                    quote: [{
                        close: [274.62, 273.68, 275.50, 261.73, 255.78]
                    }]
                }
            };

            const result = getValidatedPriceFromChart(chartData, 'AAPL');

            expect(result).not.toBeNull();
            expect(result!.currentPrice).toBe(255.78);
            expect(result!.previousClose).toBe(261.73);
            expect(result!.changePercent).toBeCloseTo(-2.27, 1);
            expect(result!.isValidated).toBe(true);
        });

        it('should return null for missing price', () => {
            const chartData: ChartData = {
                meta: {}
            };

            const result = getValidatedPriceFromChart(chartData);
            expect(result).toBeNull();
        });

        it('should default to 0% change when previous close unavailable', () => {
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: 100
                }
            };

            const result = getValidatedPriceFromChart(chartData);

            expect(result).not.toBeNull();
            expect(result!.changePercent).toBe(0);
            expect(result!.isValidated).toBe(false);
            expect(result!.validationWarnings).toContain('Could not determine previous close - defaulting to 0% change');
        });
    });

    describe('Real-world AAPL scenario (2024-02-13)', () => {
        it('should correctly calculate AAPL 1D change as -2.27%', () => {
            // Real data from the bug report
            const chartData: ChartData = {
                meta: {
                    regularMarketPrice: 255.78,
                    previousClose: undefined,
                    chartPreviousClose: 278.12  // WRONG - this caused the bug
                },
                indicators: {
                    quote: [{
                        close: [274.62, 273.68, 275.50, 261.73, 255.78]
                    }]
                }
            };

            const result = getValidatedPriceFromChart(chartData, 'AAPL');

            expect(result).not.toBeNull();
            // Should use 261.73 (yesterday's close), NOT 278.12 (chart start)
            expect(result!.previousClose).toBe(261.73);
            expect(result!.changePercent).toBeCloseTo(-2.27, 1);

            // Should NOT use chartPreviousClose which would give -8.03%
            expect(result!.changePercent).not.toBeCloseTo(-8.03, 0);
        });
    });
});
