// frontend/src/utils/money.ts
export type Currency = "GBP" | "USD" | "EUR" | string;

export function currencySymbol(currency: Currency): string {
  switch (currency) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return currency; // fallback: show currency code
  }
}

export function formatMoney(amountMinor: number, currency: Currency): string {
  const symbol = currencySymbol(currency);
  const major = (amountMinor / 100).toFixed(2);
  // For GBP, "£9.99". For unknown currency, "USD 9.99" (via fallback above)
  return symbol.length === 1 ? `${symbol}${major}` : `${symbol} ${major}`;
}
