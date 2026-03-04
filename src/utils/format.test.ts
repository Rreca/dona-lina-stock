import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber } from './format';

describe('formatCurrency', () => {
  it('should format cents to Argentine peso format without decimals', () => {
    expect(formatCurrency(1500000)).toBe('$15.000');
    expect(formatCurrency(100)).toBe('$1');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('should handle undefined and null', () => {
    expect(formatCurrency(undefined)).toBe('$0');
    expect(formatCurrency(null as any)).toBe('$0');
  });

  it('should round to nearest peso', () => {
    expect(formatCurrency(1550)).toBe('$16'); // 15.50 rounds to 16
    expect(formatCurrency(1549)).toBe('$15'); // 15.49 rounds to 15
  });

  it('should format large numbers with thousands separator', () => {
    expect(formatCurrency(100000000)).toBe('$1.000.000'); // 1 million pesos
    expect(formatCurrency(123456789)).toBe('$1.234.568'); // rounds 1,234,567.89
  });
});

describe('formatNumber', () => {
  it('should format numbers with Argentine locale', () => {
    expect(formatNumber(15000, 0)).toBe('15.000');
    expect(formatNumber(15000.5, 2)).toBe('15.000,50');
    expect(formatNumber(1234567.89, 2)).toBe('1.234.567,89');
  });

  it('should respect decimal places parameter', () => {
    expect(formatNumber(15000, 0)).toBe('15.000');
    expect(formatNumber(15000, 1)).toBe('15.000,0');
    expect(formatNumber(15000, 2)).toBe('15.000,00');
  });
});
