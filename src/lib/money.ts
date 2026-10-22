// All amounts are integers (bigint) in the asset's smallest unit, i.e. scaled by 10^decimals.
// Never use JS numbers for amounts.

// Format from the API docs: digits, optional dot + digits, no leading zeros.
const DECIMAL_RE = /^(0|[1-9]\d*)(\.\d+)?$/;

export type Decimal = { units: bigint; scale: number };

const pow10 = (n: number) => 10n ** BigInt(n);

export function parseDecimal(s: string): Decimal | null {
  if (!DECIMAL_RE.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  return { units: BigInt(int + frac), scale: frac.length };
}

/** Converts an API amount string to units. Throws if it can't be represented exactly. */
export function toUnits(s: string, decimals: number): bigint {
  const d = parseDecimal(s);
  if (!d || d.scale > decimals) {
    throw new Error(`Invalid amount "${s}" for ${decimals} decimals`);
  }
  return d.units * pow10(decimals - d.scale);
}

/** Units back to a plain decimal string without trailing zeros ("0.5", "12"). */
export function formatUnits(units: bigint, decimals: number): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const p = pow10(decimals);
  const frac = (abs % p).toString().padStart(decimals, '0').replace(/0+$/, '');
  return (neg ? '-' : '') + (abs / p).toString() + (frac ? '.' + frac : '');
}

export type ParsedInput = { ok: true; units: bigint } | { ok: false; error: string };

/** Parses what the user typed in the amount field. */
export function parseUserAmount(input: string, decimals: number): ParsedInput {
  const s = input.trim();
  if (s === '') return { ok: false, error: 'Enter an amount' };
  if (s.includes(',')) return { ok: false, error: 'Use a dot as the decimal separator' };
  const d = parseDecimal(s);
  if (!d) return { ok: false, error: 'Enter a number like 0.5 or 12' };
  if (d.scale > decimals) {
    return { ok: false, error: `At most ${decimals} decimal places` };
  }
  return { ok: true, units: d.units * pow10(decimals - d.scale) };
}

export type ClaimCheck =
  | { ok: true; units: bigint; receive: bigint }
  | { ok: false; error: string };

/** Claim rules from the API docs: minAmount <= amount <= available, max `decimals` places. */
export function validateClaim(args: {
  input: string;
  decimals: number;
  minAmount: bigint;
  fee: bigint;
  available: bigint;
}): ClaimCheck {
  const { input, decimals, minAmount, fee, available } = args;
  const parsed = parseUserAmount(input, decimals);
  if (!parsed.ok) return parsed;
  const units = parsed.units;
  if (units < minAmount) {
    return { ok: false, error: `Minimum is ${formatUnits(minAmount, decimals)}` };
  }
  if (units > available) {
    return { ok: false, error: `Only ${formatUnits(available, decimals)} available` };
  }
  const receive = units - fee;
  // Not stated in the docs, but a claim that pays out nothing makes no sense.
  if (receive <= 0n) {
    return { ok: false, error: `Amount must be more than the fee (${formatUnits(fee, decimals)})` };
  }
  return { ok: true, units, receive };
}

const CENTS_SCALE = 2;

function roundHalfUp(v: bigint, fromScale: number, toScale: number): bigint {
  if (fromScale <= toScale) return v * pow10(toScale - fromScale);
  if (v < 0n) return -roundHalfUp(-v, fromScale, toScale);
  const d = pow10(fromScale - toScale);
  const q = v / d;
  return (v % d) * 2n >= d ? q + 1n : q;
}

/** Exact sum of amount × usdPrice, rounded once (half-up) to cents. */
export function usdCents(items: { units: bigint; decimals: number; usdPrice: string }[]): bigint {
  const terms = items.map((i) => {
    const price = parseDecimal(i.usdPrice);
    if (!price) throw new Error(`Invalid price "${i.usdPrice}"`);
    return { value: i.units * price.units, scale: i.decimals + price.scale };
  });
  const scale = Math.max(CENTS_SCALE, ...terms.map((t) => t.scale));
  const sum = terms.reduce((acc, t) => acc + t.value * pow10(scale - t.scale), 0n);
  return roundHalfUp(sum, scale, CENTS_SCALE);
}

export function formatUsd(cents: bigint): string {
  const neg = cents < 0n;
  const s = formatFixed(neg ? -cents : cents, CENTS_SCALE);
  const [int, frac] = s.split('.');
  return (neg ? '-' : '') + '$' + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + frac;
}

function formatFixed(units: bigint, decimals: number): string {
  const p = pow10(decimals);
  return (units / p).toString() + '.' + (units % p).toString().padStart(decimals, '0');
}
