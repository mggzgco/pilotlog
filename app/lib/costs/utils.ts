export function parseAmountToCents(rawAmount: string) {
  const normalized = rawAmount.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100);
}
