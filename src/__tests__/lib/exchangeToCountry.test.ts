import { describe, it, expect } from 'vitest';
import { getCountryFromExchange } from '@/lib/exchangeToCountry';

describe('Exchange to Country Mapping', () => {
  describe('getCountryFromExchange', () => {
    describe('Exchange name matching', () => {
      it('should map NYSE to United States', () => {
        expect(getCountryFromExchange('NYSE')).toBe('United States');
        expect(getCountryFromExchange('NASDAQ')).toBe('United States');
      });

      it('should map European exchanges correctly', () => {
        expect(getCountryFromExchange('BIST')).toBe('Turkey');
        expect(getCountryFromExchange('AMS')).toBe('Netherlands');
        expect(getCountryFromExchange('FRA')).toBe('Germany');
        expect(getCountryFromExchange('LSE')).toBe('United Kingdom');
        expect(getCountryFromExchange('EPA')).toBe('France');
      });

      it('should be case insensitive for exchange names', () => {
        expect(getCountryFromExchange('nyse')).toBe('United States');
        expect(getCountryFromExchange('Nasdaq')).toBe('United States');
        expect(getCountryFromExchange('bist')).toBe('Turkey');
      });

      it('should handle exchange names with extra spaces', () => {
        expect(getCountryFromExchange('  NYSE  ')).toBe('United States');
        expect(getCountryFromExchange('BIST ')).toBe('Turkey');
      });
    });

    describe('Symbol suffix matching', () => {
      it('should map European symbol suffixes correctly', () => {
        expect(getCountryFromExchange(undefined, 'INGA.AS')).toBe('Netherlands');
        expect(getCountryFromExchange(undefined, 'THYAO.IS')).toBe('Turkey');
        expect(getCountryFromExchange(undefined, 'SIE.DE')).toBe('Germany');
        expect(getCountryFromExchange(undefined, 'BP.L')).toBe('United Kingdom');
        expect(getCountryFromExchange(undefined, 'MC.PA')).toBe('France');
      });

      it('should map Asian symbol suffixes correctly', () => {
        expect(getCountryFromExchange(undefined, 'BABA.HK')).toBe('Hong Kong');
        expect(getCountryFromExchange(undefined, 'SAMSUNG.KS')).toBe('South Korea');
        expect(getCountryFromExchange(undefined, 'RELIANCE.NS')).toBe('India');
      });

      it('should be case insensitive for suffixes', () => {
        expect(getCountryFromExchange(undefined, 'INGA.as')).toBe('Netherlands');
        expect(getCountryFromExchange(undefined, 'thyao.is')).toBe('Turkey');
      });

      it('should handle symbols without suffix', () => {
        expect(getCountryFromExchange(undefined, 'AAPL')).toBeUndefined();
        expect(getCountryFromExchange(undefined, 'TSLA')).toBeUndefined();
      });
    });

    describe('Priority: Exchange name over suffix', () => {
      it('should prefer exchange name when both are provided', () => {
        // If exchange name is provided and valid, use it
        expect(getCountryFromExchange('NYSE', 'SOMETHING.AS')).toBe('United States');
        expect(getCountryFromExchange('BIST', 'SYMBOL.DE')).toBe('Turkey');
      });

      it('should fallback to suffix if exchange name is invalid', () => {
        expect(getCountryFromExchange('UNKNOWN_EXCHANGE', 'INGA.AS')).toBe('Netherlands');
        expect(getCountryFromExchange('', 'THYAO.IS')).toBe('Turkey');
      });
    });

    describe('Edge cases', () => {
      it('should return undefined when no match is found', () => {
        expect(getCountryFromExchange('UNKNOWN')).toBeUndefined();
        expect(getCountryFromExchange(undefined, 'SYMBOL')).toBeUndefined();
        expect(getCountryFromExchange('', '')).toBeUndefined();
      });

      it('should handle undefined inputs gracefully', () => {
        expect(getCountryFromExchange(undefined, undefined)).toBeUndefined();
        expect(getCountryFromExchange()).toBeUndefined();
      });

      it('should handle partial exchange name matches', () => {
        // If exchange contains "NASDAQ" somewhere, should match
        expect(getCountryFromExchange('NASDAQ-GS')).toBe('United States');
        expect(getCountryFromExchange('Frankfurt Stock Exchange')).toBe('Germany');
      });
    });

    describe('Real-world examples', () => {
      it('should handle ING Groep correctly', () => {
        expect(getCountryFromExchange('AMS', 'INGA.AS')).toBe('Netherlands');
        expect(getCountryFromExchange(undefined, 'INGA.AS')).toBe('Netherlands');
      });

      it('should handle Turkish Airlines correctly', () => {
        expect(getCountryFromExchange('BIST', 'THYAO.IS')).toBe('Turkey');
        expect(getCountryFromExchange(undefined, 'THYAO.IS')).toBe('Turkey');
      });

      it('should handle Siemens correctly', () => {
        expect(getCountryFromExchange('XETRA', 'SIE.DE')).toBe('Germany');
        expect(getCountryFromExchange(undefined, 'SIE.DE')).toBe('Germany');
      });

      it('should handle Shell correctly', () => {
        expect(getCountryFromExchange('LSE', 'SHEL.L')).toBe('United Kingdom');
        expect(getCountryFromExchange(undefined, 'SHEL.L')).toBe('United Kingdom');
      });
    });
  });
});
