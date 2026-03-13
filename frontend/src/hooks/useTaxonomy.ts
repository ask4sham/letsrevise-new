import { useEffect, useState } from "react";
import { fetchTaxonomy, type SpecKey, type TaxonomyResponse } from "../api/taxonomy";

export function useTaxonomy(specKey: SpecKey) {
  const [data, setData] = useState<TaxonomyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchTaxonomy(specKey)
      .then((d) => mounted && setData(d))
      .catch((e) => mounted && setError(e))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [specKey]);

  return { data, loading, error };
}
