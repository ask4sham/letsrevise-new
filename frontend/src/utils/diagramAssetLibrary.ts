type AssetSearchRow = {
  title: string;
  subject: string;
  topic: string;
  examBoard: string;
  tier: string;
  keywords?: string[];
};

export function filterDiagramAssets<T extends AssetSearchRow>(
  assets: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return assets;
  return assets.filter((a) => {
    const hay = [
      a.title,
      a.subject,
      a.topic,
      a.examBoard,
      a.tier,
      ...(a.keywords || []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
