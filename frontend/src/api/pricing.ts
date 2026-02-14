// frontend/src/api/pricing.ts
export type SubscriptionPricing = {
  currency: string;
  monthly: { amount: number; interval: "month" | "year" | string };
  annual?: { amount: number; interval: "month" | "year" | string };
};

export async function fetchPricing(): Promise<SubscriptionPricing> {
  const res = await fetch("/api/pricing");
  if (!res.ok) throw new Error("Failed to load pricing");
  const json = await res.json();
  return json.subscription;
}
