/**
 * Measure vertical margin chain between two elements (for layout regression tests).
 */
export function marginChainPx(topEl: Element, bottomEl: Element): number {
  const topStyle = window.getComputedStyle(topEl);
  const bottomStyle = window.getComputedStyle(bottomEl);
  const topMargin = Number.parseFloat(topStyle.marginBottom) || 0;
  const bottomMargin = Number.parseFloat(bottomStyle.marginTop) || 0;
  return topMargin + bottomMargin;
}

/** Margin chain from `topEl` bottom edge to `bottomEl` top edge (margins only, not padding). */
export function verticalMarginGapPx(topEl: Element, bottomEl: Element): number {
  let total = Number.parseFloat(getComputedStyle(topEl).marginBottom) || 0;
  let node: Element | null = bottomEl.parentElement;
  while (node && node !== topEl) {
    total += Number.parseFloat(getComputedStyle(node).marginTop) || 0;
    node = node.parentElement;
  }
  return total;
}

export function headingToUploadedDiagramImageGapPx(heading: Element, image: Element): number {
  return verticalMarginGapPx(heading, image);
}
