export type ReportRowWithItem = { item: { id: number } };

export function filterReportRowsByItem<T extends ReportRowWithItem>(rows: T[], itemId: string): T[] {
  if (!itemId) return rows;
  return rows.filter(row => String(row.item.id) === itemId);
}
