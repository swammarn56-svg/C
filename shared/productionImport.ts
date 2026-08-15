import { normalizeSpreadsheetBusinessDate } from "./spreadsheet";

export function businessDateFromFilename(filename: string) {
  const match = filename.match(/(?:^|[^0-9])(\d{4}-\d{2}-\d{2})(?=[^0-9]|$)/);
  return match ? match[1] : null;
}

export function resolveProductionImportDate(filename: string, rowDate: unknown, fallbackDate: string) {
  const filenameDate = businessDateFromFilename(filename);
  const parsedRowDate = normalizeSpreadsheetBusinessDate(rowDate);
  if (filenameDate && parsedRowDate && filenameDate !== parsedRowDate) {
    throw new Error(`${filename}: row date ${parsedRowDate} does not match the filename date ${filenameDate}.`);
  }
  const resolved = filenameDate || parsedRowDate || fallbackDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolved)) {
    throw new Error(`${filename}: a valid business date is required.`);
  }
  return resolved;
}

export function firstSpreadsheetValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return "";
}
