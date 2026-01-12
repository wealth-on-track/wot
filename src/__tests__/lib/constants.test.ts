import { describe, it, expect } from 'vitest';
import { ASSET_COLORS } from '@/lib/constants';

describe('Constants', () => {
  describe('ASSET_COLORS', () => {
    it('should have colors for all asset types', () => {
      expect(ASSET_COLORS.STOCK).toBeDefined();
      expect(ASSET_COLORS.CRYPTO).toBeDefined();
      expect(ASSET_COLORS.GOLD).toBeDefined();
      expect(ASSET_COLORS.BOND).toBeDefined();
      expect(ASSET_COLORS.FUND).toBeDefined();
      expect(ASSET_COLORS.CASH).toBeDefined();
      expect(ASSET_COLORS.COMMODITY).toBeDefined();
    });

    it('should use valid hex color codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      Object.values(ASSET_COLORS).forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have unique colors for each asset type', () => {
      const colors = Object.values(ASSET_COLORS);
      const uniqueColors = new Set(colors);

      expect(uniqueColors.size).toBe(colors.length);
    });
  });
});
