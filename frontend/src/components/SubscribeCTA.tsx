import React from "react";
import { fetchPricing } from "../api/pricing";
import { formatMoney } from "../utils/money";

export function SubscribeCTA() {
  const [priceText, setPriceText] = React.useState<string>("");

  React.useEffect(() => {
    let mounted = true;
    fetchPricing()
      .then((sub) => {
        if (!mounted) return;
        setPriceText(`${formatMoney(sub.monthly.amount, sub.currency)} / month`);
      })
      .catch(() => {
        if (!mounted) return;
        // Safe fallback if pricing endpoint is unavailable
        setPriceText("£9.99 / month");
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Subscribe</div>
      <div style={{ marginBottom: 10 }}>{priceText}</div>
      <button type="button">Start subscription</button>
    </div>
  );
}
