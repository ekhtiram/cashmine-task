import { describe, expect, it } from '@jest/globals';

import type { Balances, Claim } from './api';
import { claimResolved, displayBalances } from './balances';

const snapshot = (asOf: string, available: string, claiming = '0'): Balances => ({
  asOf,
  items: [
    { asset: 'ETH', decimals: 4, available, pending: '0', claiming, usdPrice: '2000' },
  ],
});

const claim = (over: Partial<Claim> = {}): Claim => ({
  id: 'clm_1',
  asset: 'ETH',
  amount: '0.5',
  fee: '0.0012',
  receiveAmount: '0.4988',
  destinationId: 'dest_wallet',
  status: 'pending',
  failureReason: null,
  createdAt: '2026-10-20T08:00:10.000Z',
  updatedAt: '2026-10-20T08:00:10.000Z',
  ...over,
});

const show = (b: Balances, c: Claim) => {
  const [row] = displayBalances(b, [c]);
  return { available: row.availableUnits, claiming: row.claimingUnits, adjusted: row.adjusted };
};

describe('displayBalances with a claim', () => {
  it('deducts immediately when the snapshot predates the claim', () => {
    expect(show(snapshot('2026-10-20T08:00:00.000Z', '2'), claim())).toEqual({
      available: 15000n,
      claiming: 5000n,
      adjusted: true,
    });
  });

  it('does not deduct twice once the snapshot includes the claim', () => {
    expect(show(snapshot('2026-10-20T08:00:15.000Z', '1.5', '0.5'), claim())).toEqual({
      available: 15000n,
      claiming: 5000n,
      adjusted: false,
    });
  });

  it('treats a snapshot at exactly createdAt as not including the claim', () => {
    expect(show(snapshot('2026-10-20T08:00:10.000Z', '2'), claim()).available).toBe(15000n);
  });

  it('restores the amount when the claim failed but the snapshot still shows it claiming', () => {
    const failed = claim({ status: 'failed', updatedAt: '2026-10-20T08:00:25.000Z' });
    expect(show(snapshot('2026-10-20T08:00:15.000Z', '1.5', '0.5'), failed)).toEqual({
      available: 20000n,
      claiming: 0n,
      adjusted: true,
    });
  });

  it('shows no change for a failed claim when the snapshot predates the claim', () => {
    const failed = claim({ status: 'failed', updatedAt: '2026-10-20T08:00:25.000Z' });
    expect(show(snapshot('2026-10-20T08:00:00.000Z', '2'), failed)).toEqual({
      available: 20000n,
      claiming: 0n,
      adjusted: false,
    });
  });

  it('removes completed amount from claiming before the snapshot catches up', () => {
    const done = claim({ status: 'completed', updatedAt: '2026-10-20T08:00:25.000Z' });
    expect(show(snapshot('2026-10-20T08:00:15.000Z', '1.5', '0.5'), done)).toEqual({
      available: 15000n,
      claiming: 0n,
      adjusted: true,
    });
  });

  it('needs no adjustment once the settlement is in the snapshot', () => {
    const failed = claim({ status: 'failed', updatedAt: '2026-10-20T08:00:25.000Z' });
    const b = snapshot('2026-10-20T08:00:30.000Z', '2');
    expect(show(b, failed)).toEqual({ available: 20000n, claiming: 0n, adjusted: false });
    expect(claimResolved(failed, b.asOf)).toBe(true);
    expect(claimResolved(claim(), b.asOf)).toBe(false); // still pending
  });
});
