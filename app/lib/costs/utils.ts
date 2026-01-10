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

export function parseOptionalAmountToCents(rawAmount?: string | null) {
  if (typeof rawAmount !== "string") {
    return null;
  }
  const normalized = rawAmount.trim();
  if (!normalized) {
    return null;
  }
  return parseAmountToCents(normalized);
}

export function parseOptionalQuantity(rawQuantity?: string | null) {
  if (typeof rawQuantity !== "string") {
    return null;
  }
  const normalized = rawQuantity.trim();
  if (!normalized) {
    return null;
  }
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return null;
  }
  return quantity;
}
