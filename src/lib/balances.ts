import type { Balances, BalanceItem, Claim } from './api';
import { toUnits } from './money';

// Display balances = server snapshot + local adjustments for claims we created.
// The snapshot is never modified; adjustments are derived from server timestamps only
// (snapshot.asOf vs claim.createdAt / claim.updatedAt), so the device clock is not involved.
//
// Assumption (from the API docs): a snapshot reflects every change that happened before its asOf.
// So a claim is "in" the snapshot once asOf > createdAt, and its settlement once asOf > updatedAt.

const after = (a: string, b: string) => Date.parse(a) > Date.parse(b);

export function creationReflected(c: Claim, asOf: string) {
  return after(asOf, c.createdAt);
}

export function settlementReflected(c: Claim, asOf: string) {
  return c.status !== 'pending' && after(asOf, c.updatedAt);
}

/** Done = settled and the snapshot already shows the final state. No adjustment left. */
export function claimResolved(c: Claim, asOf: string | undefined) {
  return asOf !== undefined && settlementReflected(c, asOf);
}

export function claimAdjustment(c: Claim, decimals: number, asOf: string) {
  const amount = toUnits(c.amount, decimals);
  let available = 0n;
  let claiming = 0n;
  if (!creationReflected(c, asOf)) {
    // Snapshot predates the claim: move the amount out of available ourselves.
    available -= amount;
    claiming += amount;
  }
  if (c.status !== 'pending' && !settlementReflected(c, asOf)) {
    // Snapshot predates the settlement: the amount has left `claiming`...
    claiming -= amount;
    // ...and on failure it went back to available.
    if (c.status === 'failed') available += amount;
  }
  return { available, claiming };
}

export type DisplayBalance = BalanceItem & {
  availableUnits: bigint;
  pendingUnits: bigint;
  claimingUnits: bigint;
  adjusted: boolean;
};

export function displayBalances(snapshot: Balances, claims: Claim[]): DisplayBalance[] {
  return snapshot.items.map((item) => {
    let available = toUnits(item.available, item.decimals);
    let claiming = toUnits(item.claiming, item.decimals);
    let adjusted = false;
    for (const c of claims) {
      if (c.asset !== item.asset) continue;
      const adj = claimAdjustment(c, item.decimals, snapshot.asOf);
      if (adj.available !== 0n || adj.claiming !== 0n) adjusted = true;
      available += adj.available;
      claiming += adj.claiming;
    }
    return {
      ...item,
      availableUnits: available,
      pendingUnits: toUnits(item.pending, item.decimals),
      claimingUnits: claiming,
      adjusted,
    };
  });
}
