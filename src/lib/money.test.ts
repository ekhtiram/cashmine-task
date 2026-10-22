import { describe, expect, it } from '@jest/globals';

import {
  formatUnits,
  formatUsd,
  parseUserAmount,
  toUnits,
  usdCents,
  validateClaim,
} from './money';

describe('toUnits / formatUnits', () => {
  it('converts API strings exactly', () => {
    expect(toUnits('0.0005', 8)).toBe(50_000n);
    expect(toUnits('820.413207', 6)).toBe(820_413_207n);
    expect(toUnits('12', 2)).toBe(1200n);
    expect(toUnits('0', 6)).toBe(0n);
  });

  it('rejects malformed or over-precise API strings', () => {
    for (const bad of ['.5', '1.', '05', '1e-3', '-1', '', ' 1', '1,5']) {
      expect(() => toUnits(bad, 8)).toThrow();
    }
    expect(() => toUnits('0.1234567', 6)).toThrow();
  });

  it('formats without trailing zeros and without float error', () => {
    expect(formatUnits(50_000n, 8)).toBe('0.0005');
    expect(formatUnits(1200n, 2)).toBe('12');
    expect(formatUnits(0n, 6)).toBe('0');
    expect(formatUnits(-150n, 2)).toBe('-1.5');
    expect(formatUnits(5n, 0)).toBe('5');
    // 0.1 + 0.2 in units: exact
    expect(formatUnits(toUnits('0.1', 18) + toUnits('0.2', 18), 18)).toBe('0.3');
  });

  it('round-trips large values beyond Number precision', () => {
    const s = '123456789012.123456789012345678';
    expect(formatUnits(toUnits(s, 18), 18)).toBe(s);
  });
});

describe('parseUserAmount', () => {
  it('accepts valid input', () => {
    expect(parseUserAmount('0.5', 6)).toEqual({ ok: true, units: 500_000n });
    expect(parseUserAmount(' 12 ', 2)).toEqual({ ok: true, units: 1200n });
    expect(parseUserAmount('0.50', 2)).toEqual({ ok: true, units: 50n });
  });

  it('rejects invalid input with a message', () => {
    for (const bad of ['', '.5', '1.', '05', '1e-3', 'abc', '-1', '1.2.3']) {
      expect(parseUserAmount(bad, 6).ok).toBe(false);
    }
    expect(parseUserAmount('1,5', 6)).toEqual({
      ok: false,
      error: 'Use a dot as the decimal separator',
    });
    expect(parseUserAmount('0.123', 2)).toEqual({ ok: false, error: 'At most 2 decimal places' });
  });
});

describe('validateClaim', () => {
  const base = { decimals: 4, minAmount: 100n, fee: 12n, available: 5000n }; // min 0.01, fee 0.0012, avail 0.5

  it('computes receive = amount - fee', () => {
    expect(validateClaim({ ...base, input: '0.5' })).toEqual({
      ok: true,
      units: 5000n,
      receive: 4988n,
    });
  });

  it('accepts exactly min and exactly available', () => {
    expect(validateClaim({ ...base, input: '0.01' }).ok).toBe(true);
    expect(validateClaim({ ...base, input: '0.5000' }).ok).toBe(true);
  });

  it('enforces min, available and decimals', () => {
    expect(validateClaim({ ...base, input: '0.0099' })).toEqual({
      ok: false,
      error: 'Minimum is 0.01',
    });
    expect(validateClaim({ ...base, input: '0.5001' })).toEqual({
      ok: false,
      error: 'Only 0.5 available',
    });
    expect(validateClaim({ ...base, input: '0.00001' }).ok).toBe(false);
  });

  it('rejects amounts that would pay out nothing', () => {
    expect(validateClaim({ ...base, minAmount: 0n, input: '0.0012' }).ok).toBe(false);
  });
});

describe('usdCents', () => {
  it('multiplies and rounds once, half-up', () => {
    // 820.413207 * 1.0002 = 820.5772896414 -> 820.58
    expect(
      usdCents([{ units: toUnits('820.413207', 6), decimals: 6, usdPrice: '1.0002' }]),
    ).toBe(82058n);
    expect(usdCents([{ units: toUnits('0.005', 3), decimals: 3, usdPrice: '1' }])).toBe(1n);
    expect(usdCents([{ units: toUnits('0.004', 3), decimals: 3, usdPrice: '1' }])).toBe(0n);
  });

  it('sums exactly before rounding', () => {
    // each 0.004 rounds to 0, but the sum 0.008 rounds to 0.01
    const item = { units: toUnits('0.004', 3), decimals: 3, usdPrice: '1' };
    expect(usdCents([item, item])).toBe(1n);
  });

  it('handles mixed decimals and prices', () => {
    expect(
      usdCents([
        { units: toUnits('0.0005', 8), decimals: 8, usdPrice: '67000.5' }, // 33.50025
        { units: toUnits('1.5', 18), decimals: 18, usdPrice: '2400.10' }, // 3600.15
      ]),
    ).toBe(363365n);
  });

  it('formats dollars', () => {
    expect(formatUsd(123456789n)).toBe('$1,234,567.89');
    expect(formatUsd(5n)).toBe('$0.05');
    expect(formatUsd(0n)).toBe('$0.00');
  });
});
