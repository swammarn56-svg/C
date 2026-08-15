import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { normalizeSpreadsheetBusinessDate, stripUtf8Bom, toUtf8BomCsv } from "../shared/spreadsheet";

const sourceRows = [{ Date: "2026-06-18", Name: "ပေါင်မုန့်", Shop: "ရန်ကုန်ဆိုင်", Note: "ချို" }];

describe("Myanmar Unicode spreadsheet round-trip", () => {
  it("preserves Myanmar text through UTF-8 BOM CSV export and the application's XLSX parser path", () => {
    const csv = toUtf8BomCsv(sourceRows);
    const workbook = XLSX.read(stripUtf8Bom(csv), { type: "string" });
    const parsed = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: false });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(normalizeSpreadsheetBusinessDate(parsed[0]?.Date)).toBe("2026-06-18");
    expect(parsed[0]).toMatchObject({ Name: "ပေါင်မုန့်", Shop: "ရန်ကုန်ဆိုင်", Note: "ချို" });
  });

  it("preserves Myanmar text through XLSX write and readback", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sourceRows), "Unicode");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const roundTripped = XLSX.read(bytes, { type: "array" });
    const parsed = XLSX.utils.sheet_to_json<Record<string, string>>(roundTripped.Sheets.Unicode, { defval: "", raw: false });

    expect(parsed).toEqual(sourceRows);
  });
});
