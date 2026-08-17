import { trpc } from "@/lib/trpc";
import { Download, Printer } from "lucide-react";
import { filterReportRowsByItem, resolveReportPeriod } from "../../../shared/reporting";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ReportView = "purchases" | "production" | "packaging" | "sales" | "damage";
type ReportMode = "daily" | "range";

type ReportItem = {
  id: number;
  name: string;
  itemType: string;
  category?: string | null;
  displayUnit?: string | null;
};

const number = (value: unknown) => Number(value ?? 0);
const qty = (value: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(number(value));
const money = (value: unknown) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value));

function exportRows(filename: string, rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Report");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export default function DetailedReports({
  date,
  setDate,
  from,
  to,
  setFrom,
  setTo,
}: {
  date: string;
  setDate: (value: string) => void;
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
}) {
  const [view, setView] = useState<ReportView>("purchases");
  const [mode, setMode] = useState<ReportMode>("daily");
  const [selectedItemId, setSelectedItemId] = useState("");
  const { from: effectiveFrom, to: effectiveTo } = resolveReportPeriod(mode, date, from, to);
  const query = trpc.inventory.reports.summary.useQuery(
    { from: effectiveFrom, to: effectiveTo },
    { placeholderData: previous => previous },
  );
  const itemQuery = trpc.inventory.items.list.useQuery(
    { date: mode === "daily" ? date : to },
    { placeholderData: previous => previous },
  );
  const rows = query.data?.perItem ?? [];
  const items = (itemQuery.data ?? []) as ReportItem[];
  const relevantItems = useMemo(() => {
    if (view === "production" || view === "packaging" || view === "sales") {
      return items.filter(item => item.itemType === view);
    }
    if (view === "damage") return items.filter(item => item.itemType === "production" || item.itemType === "packaging");
    return items;
  }, [items, view]);
  const selected = selectedItemId ? relevantItems.some(item => String(item.id) === selectedItemId) : true;

  useEffect(() => {
    if (selectedItemId && !selected) setSelectedItemId("");
  }, [selected, selectedItemId]);

  const filtered = useMemo(() => {
    const byView = view === "production" || view === "packaging"
      ? rows.filter(row => row.item.itemType === view)
      : view === "sales"
        ? rows.filter(row => row.item.itemType === "sales")
        : view === "damage"
          ? rows.filter(row => number(row.damageQtyGrams) !== 0)
          : rows;
    return filterReportRowsByItem(byView, selectedItemId);
  }, [rows, view, selectedItemId]);

  const exportCurrent = () => {
    const exported = filtered.map(row => ({
      Item: row.item.name,
      Category: row.item.category || "",
      "Purchase Qty g": row.purchaseQtyGrams,
      "Purchase Cost": row.purchaseCost,
      Opening: row.openingQty,
      In: row.inQty,
      Issued: row.issuedQty,
      Return: row.returnQty,
      Closing: row.closingQty,
      "Average Cost": row.averageCost,
      "Used Qty g": row.usedQtyGrams,
      "Used Value": row.usedValue,
      "Damage Qty g": row.damageQtyGrams,
      "Damage Value": row.damageValue,
      "Produce Qty g": row.produceQtyGrams,
      "Sell Qty g": row.sellQtyGrams,
      "Sales Value": row.salesValue,
      "Closing Value": row.closingValue,
      "Sales by Shop": (row.salesByShop ?? []).map((sale: any) => `${sale.shopName}: ${sale.salesValue}`).join(" | "),
    }));
    exportRows(`bakery-${view}-report-${effectiveFrom}-to-${effectiveTo}`, exported);
  };

  const purchaseTotal = filtered.reduce((sum, row) => sum + number(row.purchaseCost), 0);
  const title: Record<ReportView, string> = {
    purchases: "Total Purchase Report",
    production: "Production Item Report",
    packaging: "Packaging Item Report",
    sales: "Sales Item Report",
    damage: "Damage Report",
  };
  const reportError = query.error?.message || itemQuery.error?.message;
  const hasError = Boolean(reportError);
  const isLoading = query.isLoading || itemQuery.isLoading;

  return <>
    <div className="page-header">
      <div><h1>Reports</h1><p>{mode === "daily" ? `Daily report for ${date}.` : `Date-range report from ${from} to ${to}.`} Cost valuation uses purchase averages within each calendar month.</p></div>
      <span className="header-actions"><button onClick={() => window.print()} disabled={!filtered.length}><Printer size={15} /> Print summary</button><button onClick={exportCurrent} disabled={!filtered.length}><Download size={15} /> Export report</button></span>
    </div>
    <section className="toolbar-card report-filters">
      <label>Basis<select value={mode} onChange={event => setMode(event.target.value as ReportMode)}><option value="daily">Daily</option><option value="range">Date range</option></select></label>
      {mode === "daily" ? <label>Business date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label> : <><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></>}
      <label>Item<select value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)}><option value="">All items</option>{relevantItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {selectedItemId && <button type="button" onClick={() => setSelectedItemId("")}>Clear item</button>}
    </section>
    <nav className="section-tabs" aria-label="Report types">{(["purchases", "production", "packaging", "sales", "damage"] as ReportView[]).map(value => <button key={value} className={value === view ? "active" : ""} onClick={() => setView(value)}>{title[value]}</button>)}</nav>
    {view === "purchases" && <section className="erp-card report-total"><strong>{money(purchaseTotal)}</strong><span>Total purchase value in selected period</span></section>}
    <section className="erp-card table-card"><table><thead>{view === "purchases" ? <tr><th>Item</th><th>Category</th><th>Purchase qty</th><th>Purchase total</th></tr> : view === "production" || view === "packaging" ? <tr><th>Item</th><th>Opening</th><th>In</th><th>Issued</th><th>Return</th><th>Damage</th><th>Used</th><th>Closing</th><th>Avg cost</th><th>Used value</th><th>Closing value</th></tr> : view === "sales" ? <tr><th>Item</th><th>Opening</th><th>Produce</th><th>Sell</th><th>Closing</th><th>Sales value</th><th>Shop sales</th></tr> : <tr><th>Item</th><th>Damage qty</th><th>Average purchase cost</th><th>Damage total price</th></tr>}</thead><tbody>
      {isLoading && !query.data && <tr><td colSpan={11}><div className="empty-state">Loading report data…</div></td></tr>}
      {!isLoading && hasError && <tr><td colSpan={11}><div className="empty-state">{reportError}<button onClick={() => { query.refetch(); itemQuery.refetch(); }}>Retry</button></div></td></tr>}
      {!isLoading && !hasError && filtered.map(row => view === "purchases" ? <tr key={row.item.id}><td><strong>{row.item.name}</strong></td><td>{row.item.category || "—"}</td><td>{qty(row.purchaseQtyGrams)} {row.item.displayUnit}</td><td>{money(row.purchaseCost)}</td></tr> : view === "production" || view === "packaging" ? <tr key={row.item.id}><td><strong>{row.item.name}</strong></td><td>{qty(row.openingQty)} {row.item.displayUnit}</td><td>{qty(row.inQty)} {row.item.displayUnit}</td><td>{qty(row.issuedQty)} {row.item.displayUnit}</td><td>{qty(row.returnQty)} {row.item.displayUnit}</td><td>{qty(row.damageQtyGrams)} {row.item.displayUnit}</td><td>{qty(row.usedQtyGrams)} {row.item.displayUnit}</td><td>{qty(row.closingQty)} {row.item.displayUnit}</td><td>{money(row.averageCost)}</td><td>{money(row.usedValue)}</td><td>{money(row.closingValue)}</td></tr> : view === "sales" ? <tr key={row.item.id}><td><strong>{row.item.name}</strong></td><td>{qty(row.openingQty)} {row.item.displayUnit}</td><td>{qty(row.produceQtyGrams)} {row.item.displayUnit}</td><td>{qty(row.sellQtyGrams)} {row.item.displayUnit}</td><td>{qty(row.closingQty)} {row.item.displayUnit}</td><td>{money(row.salesValue)}</td><td>{(row.salesByShop ?? []).map((sale: any) => <span key={sale.shopId}>{sale.shopName}: {money(sale.salesValue)}<br /></span>) || "—"}</td></tr> : <tr key={row.item.id}><td><strong>{row.item.name}</strong></td><td>{qty(row.damageQtyGrams)} {row.item.displayUnit}</td><td>{money(row.averageCost)}</td><td>{money(row.damageValue)}</td></tr>)}
      {!isLoading && !hasError && !filtered.length && <tr><td colSpan={11}><div className="empty-state">No {title[view].toLowerCase()} data in the selected period.</div></td></tr>}
    </tbody></table></section>
  </>;
}

