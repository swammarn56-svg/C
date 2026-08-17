export type ReportRowWithItem = { item: { id: number } };
export type ReportMode = "daily" | "range";

export function resolveReportPeriod(mode: ReportMode, globalDate: string, from: string, to: string): { from: string; to: string } {
  return mode === "daily" ? { from: globalDate, to: globalDate } : { from, to };
}

export function filterReportRowsByItem<T extends ReportRowWithItem>(rows: T[], itemId: string): T[] {
  if (!itemId) return rows;
  return rows.filter(row => String(row.item.id) === itemId);
}
