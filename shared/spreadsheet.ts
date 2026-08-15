export function toUtf8BomCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "\uFEFF";
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `\uFEFF${[columns.map(quote).join(","), ...rows.map(row => columns.map(column => quote(row[column])).join(","))].join("\r\n")}`;
}

export function stripUtf8Bom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function normalizeSpreadsheetBusinessDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
