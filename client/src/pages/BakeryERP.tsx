import { useAuth, withAuthTimeout } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { normalizeSpreadsheetBusinessDate, stripUtf8Bom, toUtf8BomCsv } from "../../../shared/spreadsheet";
import { firstSpreadsheetValue, resolveProductionImportDate } from "../../../shared/productionImport";
import { filterReportRowsByItem } from "../../../shared/reporting";
import DetailedReports from "./DetailedReports";
import RecipeManager from "./RecipeManager";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./BakeryERP-more.css";
import {
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Box,
  Boxes,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  History,
  LogOut,
  Package,
  Plus,
  ReceiptText,
  Settings2,
  Search,
  ShoppingCart,
  Store,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";

type Page = "dashboard" | "items" | "purchases" | "production" | "packaging" | "sales" | "reports" | "more";
type ItemType = "production" | "packaging" | "sales";
type OperationType = "production" | "packaging";

const today = () => new Date().toISOString().slice(0, 10);
const monthFirst = () => `${today().slice(0, 7)}-01`;
const asNumber = (value: unknown) => Number(value ?? 0);
const qty = (value: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(asNumber(value));
const money = (value: unknown) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(asNumber(value));
const unitLabel = (item: { displayUnit: "g" | "pcs"; gramsPerDisplayUnit: string | number }, grams: number) =>
  `${qty(grams / Math.max(asNumber(item.gramsPerDisplayUnit), 1))} ${item.displayUnit}`;

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="erp-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`erp-card ${className}`}>{children}</section>;
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function DateControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="date-control">Business date<input type="date" value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" | "dark" }) {
  return <Card className={`stat-card stat-${tone}`}><strong>{value}</strong><span>{label}</span></Card>;
}

function AccessGate({ children }: { children: ReactNode }) {
  const { loading, user, error: authError, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <main className="auth-screen"><Card><p className="muted">Loading Bakery ERP…</p></Card></main>;
  if (!user) {
    const submit = async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError("");
      if (!supabase) {
        setError("Supabase Auth is not configured for this deployment.");
      } else {
        try {
          const result = await withAuthTimeout(fetch("/api/auth/sign-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), password }),
          }).then(async response => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.error || "Unable to sign in.");
            return payload as { access_token: string; refresh_token: string };
          }), "Sign-in timed out. Check your connection and try again.");
          const sessionResult = await withAuthTimeout(
            supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token }),
            "Session installation timed out. Please refresh the page and try again.",
          );
          if (sessionResult.error) throw sessionResult.error;
        } catch (signInError) {
          setError(signInError instanceof Error ? signInError.message : "Unable to sign in. Please try again.");
        }
      }
      setBusy(false);
    };
    return <main className="auth-screen"><Card className="auth-card"><Package size={32} /><h1>Bakery ERP</h1><p>Sign in with your Supabase account to access purchase, production, packaging, sales, and reports.</p><form className="form-grid" onSubmit={submit}><label>Email<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>{(error || authError) && <p className="form-error full-width" role="alert">{error || authError?.message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>{authError && <button type="button" onClick={() => void refresh()} disabled={loading}>Retry session</button>}</form></Card></main>;
  }
  return <>{children}</>;
}

function ItemForm({ initial, onClose, onDone, isAdmin }: { initial?: any; onClose: () => void; onDone: () => void; isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const create = trpc.inventory.items.create.useMutation({ onSuccess: () => { utils.inventory.invalidate(); onDone(); } });
  const update = trpc.inventory.items.update.useMutation({ onSuccess: () => { utils.inventory.invalidate(); onDone(); } });
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    category: initial?.category ?? "",
    itemType: (initial?.itemType ?? "production") as ItemType,
    displayUnit: (initial?.displayUnit ?? "g") as "g" | "pcs",
    gramsPerDisplayUnit: asNumber(initial?.gramsPerDisplayUnit ?? 1),
    minStockGrams: asNumber(initial?.minStockGrams ?? 0),
    costPerUnit: initial?.costPerUnit === null || initial?.costPerUnit === undefined ? "" : String(initial.costPerUnit),
    effectiveFrom: initial?.effectiveFrom ? String(initial.effectiveFrom).slice(0, 10) : today(),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...form, code: form.code || null, category: form.category || null, costPerUnit: form.costPerUnit === "" ? null : Number(form.costPerUnit), gramsPerDisplayUnit: Number(form.gramsPerDisplayUnit), minStockGrams: Number(form.minStockGrams) };
    if (initial) update.mutate({ id: initial.id, name: payload.name, code: payload.code, category: payload.category, effectiveFrom: payload.effectiveFrom, gramsPerDisplayUnit: payload.gramsPerDisplayUnit, minStockGrams: payload.minStockGrams, costPerUnit: payload.costPerUnit });
    else create.mutate(payload);
  };
  const busy = create.isPending || update.isPending;
  return <Modal title={initial ? "Edit item" : "Add item"} onClose={onClose}><form className="form-grid" onSubmit={submit}>
    <label>Name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
    <label>Code<input value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /></label>
    <label>Category<input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} /></label>
    {!initial && <><label>List<select value={form.itemType} onChange={event => setForm({ ...form, itemType: event.target.value as ItemType, displayUnit: event.target.value === "packaging" ? "pcs" : form.displayUnit })}><option value="production">Production</option><option value="packaging">Packaging</option><option value="sales">Sales</option></select></label>
    <label>Display unit<select value={form.displayUnit} onChange={event => setForm({ ...form, displayUnit: event.target.value as "g" | "pcs" })}><option value="g">g</option><option value="pcs">pcs</option></select></label></>}
    <label>Effective start date<input required type="date" value={form.effectiveFrom} onChange={event => setForm({ ...form, effectiveFrom: event.target.value })} /></label>
    <label>Minimum stock ({form.displayUnit})<input required min="0" step="0.001" type="number" value={form.minStockGrams} onChange={event => setForm({ ...form, minStockGrams: Number(event.target.value) })} /></label>
    {form.displayUnit === "g" && <label>Base grams per display unit<input required min="0.001" step="0.001" type="number" value={form.gramsPerDisplayUnit} onChange={event => setForm({ ...form, gramsPerDisplayUnit: Number(event.target.value) })} /></label>}
    {isAdmin && form.itemType === "sales" && <label>Cost per unit<input min="0" step="0.01" type="number" value={form.costPerUnit} onChange={event => setForm({ ...form, costPerUnit: event.target.value })} /></label>}
    <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save item"}</button></div>
  </form></Modal>;
}

function ItemsPage({ date, isAdmin }: { date: string; isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const [includeInactive, setIncludeInactive] = useState(false);
  const query = trpc.inventory.items.list.useQuery({ date, includeInactive });
  const deactivate = trpc.inventory.items.deactivate.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const reactivate = trpc.inventory.items.reactivate.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const reorder = trpc.inventory.items.reorder.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const [type, setType] = useState<ItemType>("production");
  const [editing, setEditing] = useState<any | "new" | null>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const list = useMemo(() => (query.data ?? []).filter(item => item.itemType === type), [query.data, type]);
  const move = (index: number, direction: -1 | 1) => {
    const copy = [...list]; const target = index + direction;
    if (target < 0 || target >= copy.length) return;
    [copy[index], copy[target]] = [copy[target], copy[index]];
    reorder.mutate({ type, ids: copy.map(item => item.id) });
  };
  const showSalesCost = type === "sales" && isAdmin;
  return <>
    <PageHeader title="Item Dashboard" action={isAdmin ? <span className="header-actions"><button onClick={() => setIncludeInactive(!includeInactive)}>{includeInactive ? "Hide inactive" : "Show inactive"}</button><button className="primary-button" onClick={() => setEditing("new")}><Plus size={16} /> Add item</button></span> : <span className="read-only-label">Read-only access</span>} />
    <div className="section-tabs">{(["production", "packaging", "sales"] as ItemType[]).map(value => <button className={type === value ? "active" : ""} onClick={() => setType(value)} key={value}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <Card className="table-card"><table><thead><tr><th>{isAdmin ? "Order" : ""}</th><th>Name</th><th>Category</th><th>Created</th><th>Start</th><th>Inactive from</th><th>Status</th><th>Minimum stock</th>{showSalesCost && <th>Cost per unit</th>}{isAdmin && <th>Action</th>}</tr></thead><tbody>
      {list.map((item, index) => { const salesCost = "costPerUnit" in item ? item.costPerUnit : null; const inactive = item.inactiveFrom && String(item.inactiveFrom).slice(0, 10) <= date; return <tr key={item.id}><td className="order-actions">{isAdmin && <><button disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp size={15} /></button><button disabled={index === list.length - 1} onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown size={15} /></button></>}</td><td><strong>{item.name}</strong>{item.code && <small>{item.code}</small>}</td><td>{item.category || "—"}</td><td>{String(item.createdAt).slice(0, 10)}</td><td>{String(item.effectiveFrom).slice(0, 10)}</td><td>{item.inactiveFrom ? String(item.inactiveFrom).slice(0, 10) : "—"}</td><td><span className={inactive ? "status-muted" : "status-good"}>{inactive ? "Inactive" : "Active"}</span></td><td>{unitLabel(item, asNumber(item.minStockGrams))}</td>{showSalesCost && <td>{salesCost === null || salesCost === undefined ? "—" : money(salesCost)}</td>}{isAdmin && <td className="row-actions"><button onClick={() => setEditing(item)}>Rename / edit</button><button className="danger-button" onClick={() => setDeleting(item)}>Delete by date</button></td>}</tr>; })}
      {!list.length && <tr><td colSpan={(showSalesCost ? 1 : 0) + (isAdmin ? 10 : 8)}><EmptyState>No {type} items are active on this date.</EmptyState></td></tr>}
    </tbody></table></Card>
    {editing && <ItemForm initial={editing === "new" ? undefined : editing} isAdmin={isAdmin} onClose={() => setEditing(null)} onDone={() => setEditing(null)} />}
    {deleting && <DeactivateItem item={deleting} onClose={() => setDeleting(null)} onDone={() => setDeleting(null)} deactivate={deactivate.mutate} reactivate={reactivate.mutate} />}
  </>;
}

function DeactivateItem({ item, onClose, onDone, deactivate, reactivate }: { item: any; onClose: () => void; onDone: () => void; deactivate: (input: { id: number; inactiveFrom: string }) => void; reactivate: (input: { id: number }) => void }) {
  const [date, setDate] = useState(today());
  return <Modal title="Date-effective deletion" onClose={onClose}><form className="form-grid" onSubmit={event => { event.preventDefault(); deactivate({ id: item.id, inactiveFrom: date }); onDone(); }}><p className="form-note full-width"><strong>{item.name}</strong> will stop appearing from the selected date. Earlier records remain unchanged.</p><label className="full-width">Delete from date<input required type="date" min={String(item.effectiveFrom).slice(0, 10)} value={date} onChange={event => setDate(event.target.value)} /></label><div className="modal-actions"><button type="button" onClick={() => { reactivate({ id: item.id }); onDone(); }}>Restore active item</button><button className="danger-button">Delete from date</button></div></form></Modal>;
}

function PurchaseForm({ itemType, items, onClose, onDone }: { itemType: "production" | "packaging"; items: any[]; onClose: () => void; onDone: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.inventory.purchases.create.useMutation({ onSuccess: () => { utils.inventory.invalidate(); onDone(); } });
  const [itemId, setItemId] = useState<number>(items[0]?.id ?? 0);
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"g" | "kg" | "viss" | "pcs">(itemType === "packaging" ? "pcs" : "kg");
  const [cost, setCost] = useState("");
  const [status, setStatus] = useState<"draft" | "confirmed">("confirmed");
  const [note, setNote] = useState("");
  const selected = items.find(item => item.id === itemId);
  const preview = selected && quantity ? asNumber(quantity) * (selected.displayUnit === "pcs" ? 1 : unit === "kg" ? 1000 : unit === "viss" ? 1600 : 1) : 0;
  return <Modal title={`Add ${itemType} purchase`} onClose={onClose}><form className="form-grid" onSubmit={event => { event.preventDefault(); create.mutate({ purchaseDate: date, itemId, inputQuantity: Number(quantity), inputUnit: unit, totalCost: Number(cost), status, note: note || null }); }}>
    <label>Date<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label><label>Item<select required value={itemId} onChange={event => setItemId(Number(event.target.value))}>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Quantity<input type="number" required min="0.001" step="0.001" value={quantity} onChange={event => setQuantity(event.target.value)} /></label><label>Input unit<select value={unit} onChange={event => setUnit(event.target.value as typeof unit)}>{itemType === "packaging" ? <option value="pcs">pcs</option> : <><option value="g">g</option><option value="kg">kg</option><option value="viss">viss</option></>}</select></label>
    <label>Total price<input type="number" required min="0" step="0.01" value={cost} onChange={event => setCost(event.target.value)} /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value as "draft" | "confirmed")}><option value="confirmed">Confirmed</option><option value="draft">Draft</option></select></label><p className="form-note">Inventory base quantity: <strong>{qty(preview)} {selected?.displayUnit ?? ""}</strong>{cost && preview > 0 && <> · {money(asNumber(cost) / preview)} per {selected?.displayUnit ?? "base unit"}</>}</p>
    <label className="full-width">Note<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Optional note" /></label><div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!items.length || create.isPending}>{create.isPending ? "Saving…" : "Save purchase"}</button></div>
  </form></Modal>;
}

function PurchasesPage({ date }: { date: string }) {
  const allItems = trpc.inventory.items.list.useQuery({ date });
  const purchaseQuery = trpc.inventory.purchases.list.useQuery({ date }, { placeholderData: previous => previous });
  const [type, setType] = useState<"production" | "packaging">("production");
  const [add, setAdd] = useState(false);
  const utils = trpc.useUtils();
  const confirm = trpc.inventory.purchases.confirm.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const cancel = trpc.inventory.purchases.cancel.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const items = (allItems.data ?? []).filter(item => item.itemType === type);
  const rows = (purchaseQuery.data ?? []).filter(row => row.item.itemType === type);
  return <><PageHeader title="Purchase" subtitle={`Purchases for ${date} · confirmed quantities feed the corresponding daily In balance.`} action={<button className="primary-button" onClick={() => setAdd(true)}><Plus size={16} /> Add purchase</button>} />
    <div className="section-tabs"><button className={type === "production" ? "active" : ""} onClick={() => setType("production")}>Production (g / kg / viss)</button><button className={type === "packaging" ? "active" : ""} onClick={() => setType("packaging")}>Packaging (pcs)</button></div>
    <Card className="table-card"><table><thead><tr><th>Date</th><th>Name</th><th>Qty</th><th>Purchase unit</th><th>Base qty</th><th>Unit price</th><th>Total price</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{String(row.purchaseDate).slice(0, 10)}</td><td><strong>{row.item.name}</strong></td><td>{qty(row.inputQuantity)}</td><td>{row.inputUnit}</td><td>{qty(row.baseQuantity)} {row.baseUnit}</td><td>{money(row.unitCostPerGram)} / {row.baseUnit}</td><td>{money(row.totalCost)}</td><td><span className={row.status === "confirmed" ? "status-good" : row.status === "cancelled" ? "status-muted" : "status-muted"}>{row.status}</span></td><td>{row.note || "—"}</td><td className="row-actions">{row.status === "draft" && <button onClick={() => confirm.mutate({ id: row.id })} disabled={confirm.isPending}>Confirm</button>}{row.status === "confirmed" && <button className="danger-button" onClick={() => { const reason = window.prompt("Cancellation reason (optional)") ?? null; if (reason !== null) cancel.mutate({ id: row.id, reason }); }} disabled={cancel.isPending}>Cancel purchase</button>}</td></tr>)}{!rows.length && <tr><td colSpan={10}><EmptyState>No {type} purchases recorded.</EmptyState></td></tr>}</tbody></table></Card>
    {add && <PurchaseForm itemType={type} items={items} onClose={() => setAdd(false)} onDone={() => setAdd(false)} />}
  </>;
}

function OperationRow({ row, type, isLocked, isAdmin }: { row: any; type: OperationType; isLocked: boolean; isAdmin: boolean }) {
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const save = trpc.inventory.operations.save.useMutation({ onSuccess: () => setSaveState("saved"), onError: () => setSaveState("error") });
  const [values, setValues] = useState({ opening: row.openingQtyGrams, issued: row.issuedQtyGrams, returned: row.returnQtyGrams, damage: row.damageQtyGrams, note: row.note });
  const [inValue, setInValue] = useState(row.inQtyGrams);
  const requestKey = useRef(0);
  useEffect(() => { setSaveState("saved"); setValues({ opening: row.openingQtyGrams, issued: row.issuedQtyGrams, returned: row.returnQtyGrams, damage: row.damageQtyGrams, note: row.note }); setInValue(row.inQtyGrams); }, [row.date, row.item.id, row.openingQtyGrams, row.inQtyGrams, row.issuedQtyGrams, row.returnQtyGrams, row.damageQtyGrams, row.note]);
  const used = asNumber(values.issued) - asNumber(values.returned) - asNumber(values.damage);
  const closing = asNumber(values.opening) + asNumber(inValue) + asNumber(values.returned) - asNumber(values.issued);
  const openingChanged = String(values.opening) !== String(row.openingQtyGrams);
  const issuedChanged = String(values.issued) !== String(row.issuedQtyGrams);
  const inChanged = String(inValue) !== String(row.inQtyGrams);
  const hasChanges = inChanged || openingChanged || issuedChanged || String(values.returned) !== String(row.returnQtyGrams) || String(values.damage) !== String(row.damageQtyGrams) || String(values.note ?? "") !== String(row.note ?? "");
  const payload = { date: row.date, itemId: row.item.id, type, issuedOverrideQtyGrams: issuedChanged ? Math.max(0, asNumber(values.issued)) : (row.issuedOverrideQtyGrams == null ? null : asNumber(row.issuedOverrideQtyGrams)), inOverrideQtyGrams: inChanged ? Math.max(0, asNumber(inValue)) : (row.inOverrideQtyGrams == null ? null : asNumber(row.inOverrideQtyGrams)), openingOverrideQtyGrams: openingChanged ? Math.max(0, asNumber(values.opening)) : (row.openingOverrideQtyGrams == null ? null : asNumber(row.openingOverrideQtyGrams)), openingReason: row.openingReason || null, issuedQtyGrams: Math.max(0, asNumber(values.issued)), returnQtyGrams: Math.max(0, asNumber(values.returned)), damageQtyGrams: Math.max(0, asNumber(values.damage)), note: values.note || null };
  const payloadSignature = JSON.stringify(payload);
  useEffect(() => {
    if (isLocked || !hasChanges) return;
    const timer = window.setTimeout(() => {
      const key = ++requestKey.current;
      setSaveState("saving");
      save.mutate(payload, { onSuccess: () => { if (key === requestKey.current) setSaveState("saved"); }, onError: () => { if (key === requestKey.current) setSaveState("error"); } });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [hasChanges, isLocked, payloadSignature]);
  const change = (patch: Partial<typeof values>) => { setSaveState("pending"); setValues(current => ({ ...current, ...patch })); };
  const field = (key: "issued" | "returned" | "damage") => <input disabled={isLocked} min="0" step="0.001" type="number" value={values[key]} onChange={event => { setSaveState("pending"); setValues(current => ({ ...current, [key]: event.target.value })); }} />;
  const inField = isAdmin ? <input disabled={isLocked} min="0" step="0.001" type="number" value={inValue} onChange={event => { setSaveState("pending"); setInValue(event.target.value); }} /> : unitLabel(row.item, inValue);
  const negative = closing < 0;
  return <tr className={negative ? "negative-stock-row" : undefined}><td><strong>{row.item.name}</strong>{negative && <span className="row-warning" role="alert">Below zero</span>}<small>{row.item.displayUnit}</small></td><td><input disabled={isLocked} min="0" step="0.001" type="number" value={values.opening} onChange={event => change({ opening: event.target.value })} /></td><td>{inField}</td><td>{field("issued")}</td><td>{field("returned")}</td><td>{field("damage")}</td><td>{unitLabel(row.item, used)}</td><td>{unitLabel(row.item, closing)}</td><td><input disabled={isLocked} value={values.note} onChange={event => change({ note: event.target.value })} /></td><td><small className={saveState === "error" ? "warning-text" : "muted"} aria-live="polite">{isLocked ? "Locked" : saveState === "saving" ? "Saving…" : saveState === "pending" ? "Saving soon…" : saveState === "error" ? "Save failed" : "Saved"}</small></td></tr>;
}

function OperationsPage({ date, type }: { date: string; type: OperationType }) {
  const { user } = useAuth();
  const query = trpc.inventory.operations.daily.useQuery({ date, type }, { placeholderData: previous => previous });
  const status = trpc.inventory.daily.status.useQuery({ date, ledgerType: type }, { placeholderData: previous => previous });
  const [cachedRows, setCachedRows] = useState<any[]>([]);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => { if (query.data) { setCachedRows(query.data); setLoadTimedOut(false); } }, [query.data]);
  useEffect(() => {
    setLoadTimedOut(false);
    const timer = window.setTimeout(() => { if (query.isLoading && !query.data && !cachedRows.length) setLoadTimedOut(true); }, 8000);
    return () => window.clearTimeout(timer);
  }, [date, type]);
  const utils = trpc.useUtils();
  const lock = trpc.inventory.daily.lock.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const reopen = trpc.inventory.daily.reopen.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const label = type[0].toUpperCase() + type.slice(1);
  const isLocked = Boolean(status.data?.locked);
  const rows = query.data ?? cachedRows;
  const negativeCount = rows.filter(row => asNumber(row.closingQtyGrams) < 0).length;
  const action = user?.role === "admin" ? <span className="header-actions">{isLocked ? <button onClick={() => reopen.mutate({ date, ledgerType: type })}>Reopen day</button> : <button className="primary-button" onClick={() => lock.mutate({ date, ledgerType: type })}>Lock day</button>}</span> : undefined;
  return <><PageHeader title={`${label} daily ledger`} action={action} />
    {(negativeCount > 0 || isLocked) && <Card className="ledger-status">{negativeCount > 0 && <strong className="warning-text">{negativeCount} item balance(s) are below zero.</strong>} {isLocked && <strong>This day is locked.</strong>}</Card>}
    <Card className="table-card">{query.isFetching && <div className="ledger-refreshing" aria-live="polite">Updating {label.toLowerCase()} date…</div>}<table><thead><tr><th>Name</th><th>Opening</th><th>In</th><th>Issued</th><th>Return</th><th>Damage</th><th>Used</th><th>Closing</th><th>Note</th><th>Status</th></tr></thead><tbody>{!rows.length && (query.isError || loadTimedOut) ? <tr><td colSpan={10}><EmptyState>{query.error?.message || `Could not load ${label.toLowerCase()} rows for ${date}.`} <button onClick={() => { setLoadTimedOut(false); query.refetch(); }}>Retry</button></EmptyState></td></tr> : query.isLoading && !query.data && !rows.length ? <tr><td colSpan={10}><EmptyState>Loading {label.toLowerCase()} rows for {date}…</EmptyState></td></tr> : rows.map(row => <OperationRow key={`${row.date}-${row.item.id}`} row={row} type={type} isLocked={isLocked} isAdmin={user?.role === "admin"} />)}{!query.isLoading && !query.isError && !loadTimedOut && !rows.length && <tr><td colSpan={10}><EmptyState>No active {type} items on this date.</EmptyState></td></tr>}</tbody></table></Card>
  </>;
}

function SalesRow({ row, shopId, isLocked }: { row: any; shopId: number; isLocked: boolean }) {
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const save = trpc.inventory.sales.save.useMutation({ onSuccess: () => setSaveState("saved"), onError: () => setSaveState("error") });
  const [values, setValues] = useState({ opening: row.openingQtyGrams, produce: row.produceQtyGrams, sell: row.sellQtyGrams, note: row.note });
  const requestKey = useRef(0);
  useEffect(() => { setSaveState("saved"); setValues({ opening: row.openingQtyGrams, produce: row.produceQtyGrams, sell: row.sellQtyGrams, note: row.note }); }, [row.date, row.item.id, row.openingQtyGrams, row.produceQtyGrams, row.sellQtyGrams, row.note]);
  const openingChanged = String(values.opening) !== String(row.openingQtyGrams);
  const closing = asNumber(values.opening) + asNumber(values.produce) - asNumber(values.sell);
  const total = Math.max(0, asNumber(values.sell)) * asNumber(row.sellingPricePerUnit);
  const hasChanges = openingChanged || String(values.produce) !== String(row.produceQtyGrams) || String(values.sell) !== String(row.sellQtyGrams) || String(values.note ?? "") !== String(row.note ?? "");
  const payload = { date: row.date, shopId, itemId: row.item.id, openingOverrideQtyGrams: openingChanged ? Math.max(0, asNumber(values.opening)) : (row.openingOverrideQtyGrams ?? null), openingReason: row.openingReason || null, produceQtyGrams: Math.max(0, asNumber(values.produce)), sellQtyGrams: Math.max(0, asNumber(values.sell)), note: values.note || null };
  const payloadSignature = JSON.stringify(payload);
  useEffect(() => {
    if (isLocked || !hasChanges) return;
    const timer = window.setTimeout(() => {
      const key = ++requestKey.current;
      setSaveState("saving");
      save.mutate(payload, { onSuccess: () => { if (key === requestKey.current) setSaveState("saved"); }, onError: () => { if (key === requestKey.current) setSaveState("error"); } });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [hasChanges, isLocked, payloadSignature]);
  const change = (patch: Partial<typeof values>) => { setSaveState("pending"); setValues(current => ({ ...current, ...patch })); };
  return <tr><td><strong>{row.item.name}</strong></td><td><input disabled={isLocked} min="0" step="0.001" type="number" value={values.opening} onChange={event => change({ opening: event.target.value })} /></td><td><input disabled={isLocked} min="0" step="0.001" type="number" value={values.produce} onChange={event => change({ produce: event.target.value })} /></td><td><input disabled={isLocked} min="0" step="0.001" type="number" value={values.sell} onChange={event => change({ sell: event.target.value })} /></td><td>{unitLabel(row.item, closing)}</td><td>{money(row.sellingPricePerUnit)}</td><td>{money(total)}</td><td><input disabled={isLocked} value={values.note} onChange={event => change({ note: event.target.value })} /></td><td><small className={saveState === "error" ? "warning-text" : "muted"} aria-live="polite">{isLocked ? "Locked" : saveState === "saving" ? "Saving…" : saveState === "pending" ? "Saving soon…" : saveState === "error" ? "Save failed" : "Saved"}</small></td></tr>;
}

function SalesPage({ date }: { date: string }) {
  const shops = trpc.inventory.shops.list.useQuery();
  const { user } = useAuth();
  const [shopId, setShopId] = useState<number | null>(null);
  useEffect(() => { if (shopId === null && shops.data?.[0]) setShopId(shops.data[0].id); }, [shops.data, shopId]);
  const daily = trpc.inventory.sales.daily.useQuery({ date, shopId: shopId ?? 1 }, { enabled: Boolean(shopId), placeholderData: previous => previous });
  const status = trpc.inventory.daily.status.useQuery({ date, ledgerType: "sales" }, { placeholderData: previous => previous });
  const [cachedRows, setCachedRows] = useState<any[]>([]);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => { if (daily.data) { setCachedRows(daily.data); setLoadTimedOut(false); } }, [daily.data]);
  useEffect(() => {
    setLoadTimedOut(false);
    const timer = window.setTimeout(() => { if (daily.isLoading && !daily.data && !cachedRows.length) setLoadTimedOut(true); }, 8000);
    return () => window.clearTimeout(timer);
  }, [date, shopId]);
  const utils = trpc.useUtils();
  const lock = trpc.inventory.daily.lock.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const reopen = trpc.inventory.daily.reopen.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const isLocked = Boolean(status.data?.locked);
  const action = user?.role === "admin" ? <span className="header-actions">{isLocked ? <button onClick={() => reopen.mutate({ date, ledgerType: "sales" })}>Reopen day</button> : <button className="primary-button" onClick={() => lock.mutate({ date, ledgerType: "sales" })}>Lock day</button>}</span> : undefined;
  return <><PageHeader title="Sale daily ledger" action={action} />
    <Card className="toolbar-card"><label>Shop<select value={shopId ?? ""} onChange={event => setShopId(Number(event.target.value))}><option value="">Select a shop</option>{(shops.data ?? []).filter(shop => shop.active).map(shop => <option value={shop.id} key={shop.id}>{shop.name}</option>)}</select></label>{isLocked && <strong>This day is locked.</strong>}</Card>
    {!shopId ? <EmptyState>Add a shop in More before recording sales.</EmptyState> : <Card className="table-card">{daily.isFetching && <div className="ledger-refreshing" aria-live="polite">Updating sales date…</div>}<table><thead><tr><th>Name</th><th>Opening</th><th>Produce</th><th>Sell</th><th>Closing</th><th>Unit price</th><th>Total price</th><th>Note</th><th>Status</th></tr></thead><tbody>{!(daily.data ?? cachedRows).length && (daily.isError || loadTimedOut) ? <tr><td colSpan={9}><EmptyState>{daily.error?.message || `Could not load sales rows for ${date}.`} <button onClick={() => { setLoadTimedOut(false); daily.refetch(); }}>Retry</button></EmptyState></td></tr> : daily.isLoading && !daily.data && !cachedRows.length ? <tr><td colSpan={9}><EmptyState>Loading sales rows for ${date}…</EmptyState></td></tr> : (daily.data ?? cachedRows).map(row => <SalesRow key={`${row.date}-${shopId}-${row.item.id}`} row={row} shopId={shopId} isLocked={isLocked} />)}{!daily.isLoading && !daily.isError && !loadTimedOut && !(daily.data ?? cachedRows).length && <tr><td colSpan={9}><EmptyState>No active sales items on this date.</EmptyState></td></tr>}</tbody></table></Card>}
  </>;
}

function DashboardPage({ date }: { date: string }) {
  const dashboard = trpc.inventory.dashboard.useQuery({ date });
  const data = dashboard.data;
  return <><PageHeader title="Dashboard" subtitle="Daily purchasing, stock, damage, margin, and replenishment overview." />
    <div className="stats-grid"><Stat label="Daily purchase total" value={`${qty(data?.purchaseQtyGrams)} base units · ${money(data?.purchaseCost)}`} /><Stat label="Closing total value" value={money(data?.closingValue)} tone="dark" /><Stat label="Damage total" value={`${qty(data?.damageQtyGrams)} base units · ${money(data?.damageValue)}`} tone="warn" /><Stat label="Sales total" value={`${qty(data?.salesQty)} units · ${money(data?.salesRevenue)}`} tone="good" /><Stat label="Sales margin" value={money(data?.salesMargin)} tone="good" /></div>
    <Card className="low-stock-card"><div className="card-title"><div><TriangleAlert size={18} /><h2>Low stock items</h2></div><span>{data?.lowStock.length ?? 0} alerts</span></div>{data?.lowStock.length ? <div className="alert-list">{data.lowStock.map((row, index) => <div key={`${row.item.id}-${index}`}><strong>{row.item.name}</strong><span>Closing {unitLabel(row.item, row.closingQtyGrams)} · Minimum {unitLabel(row.item, asNumber(row.item.minStockGrams))}</span></div>)}</div> : <EmptyState>All active item balances are at or above their minimum stock threshold.</EmptyState>}</Card>
  </>;
}

function ReportsPage({ from, to, setFrom, setTo }: { from: string; to: string; setFrom: (value: string) => void; setTo: (value: string) => void }) {
  const query = trpc.inventory.reports.summary.useQuery({ from, to });
  const rows = query.data?.perItem ?? [];
  const [selectedItemId, setSelectedItemId] = useState("");
  const selected = rows.find(row => String(row.item.id) === selectedItemId);
  const visibleRows = filterReportRowsByItem(rows, selectedItemId);
  const exportReport = () => downloadWorkbook(`bakery-report-${from}-to-${to}`, [{ name: "Item report", rows: visibleRows.map(row => ({ Item: row.item.name, List: row.item.itemType, "Purchase Qty g": row.purchaseQtyGrams, "Purchase Cost": row.purchaseCost, "Used Qty g": row.usedQtyGrams, "Used Value": row.usedValue, "Damage Qty g": row.damageQtyGrams, "Damage Value": row.damageValue, "Produce Qty g": row.produceQtyGrams, "Sell Qty g": row.sellQtyGrams, "Sales Value": row.salesValue })) }]);
  return <><PageHeader title="Reports" subtitle="Date-range reports valued with the purchase average cost of each calendar month." action={<button onClick={exportReport} disabled={!query.data?.perItem.length}><Download size={15} /> Export report</button>} />
    <Card className="toolbar-card report-filters"><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><label>Item<select value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)}><option value="">All items</option>{rows.map(row => <option key={row.item.id} value={row.item.id}>{row.item.name}</option>)}</select></label>{selected && <button type="button" onClick={() => setSelectedItemId("")}>Clear item</button>}</Card>
    <Card className="table-card"><table><thead><tr><th>Item</th><th>Purchase qty</th><th>Purchase cost</th><th>Used qty</th><th>Used value</th><th>Damage qty</th><th>Damage value</th><th>Produce</th><th>Sell</th><th>Sales value</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.item.id}><td><strong>{row.item.name}</strong><small>{row.item.itemType}</small></td><td>{unitLabel(row.item, row.purchaseQtyGrams)}</td><td>{money(row.purchaseCost)}</td><td>{unitLabel(row.item, row.usedQtyGrams)}</td><td>{money(row.usedValue)}</td><td>{unitLabel(row.item, row.damageQtyGrams)}</td><td>{money(row.damageValue)}</td><td>{unitLabel(row.item, row.produceQtyGrams)}</td><td>{unitLabel(row.item, row.sellQtyGrams)}</td><td>{money(row.salesValue)}</td></tr>)}{!visibleRows.length && <tr><td colSpan={10}><EmptyState>No report data in this period.</EmptyState></td></tr>}</tbody></table></Card>
  </>;
}

function downloadWorkbook(filename: string, sheets: Array<{ name: string; rows: Record<string, unknown>[] }>) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows), sheet.name.slice(0, 31)));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toUtf8BomCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ShopPanel() {
  const utils = trpc.useUtils();
  const shopQuery = trpc.inventory.shops.list.useQuery();
  const priceQuery = trpc.inventory.shops.prices.useQuery();
  const itemQuery = trpc.inventory.items.list.useQuery();
  const saveShop = trpc.inventory.shops.save.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const savePrice = trpc.inventory.shops.savePrice.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const [shopName, setShopName] = useState(""); const [editingShopId, setEditingShopId] = useState<number | null>(null);
  const [shopId, setShopId] = useState<number | "">("");
  const [itemId, setItemId] = useState<number | "">("");
  const [price, setPrice] = useState("");
  const saleItems = (itemQuery.data ?? []).filter(item => item.itemType === "sales");
  return <Card className="more-panel"><div className="panel-heading"><Store size={19} /><div><h2>Shop management</h2><p>Add shops and assign a selling price for each Sales item.</p></div></div>
    <form className="inline-form" onSubmit={event => { event.preventDefault(); if (shopName.trim()) { saveShop.mutate({ id: editingShopId ?? undefined, name: shopName.trim(), active: true }); setShopName(""); setEditingShopId(null); } }}><input placeholder="New shop name" value={shopName} onChange={event => setShopName(event.target.value)} /><button className="primary-button" disabled={saveShop.isPending}>{editingShopId ? "Save shop" : "Add shop"}</button>{editingShopId && <button type="button" onClick={() => { setEditingShopId(null); setShopName(""); }}>Cancel</button>}</form>
    <div className="config-list">{(shopQuery.data ?? []).map(shop => <div key={shop.id}><strong>{shop.name}</strong><span className={shop.active ? "status-good" : "status-muted"}>{shop.active ? "Active" : "Inactive"}</span><button onClick={() => { setEditingShopId(shop.id); setShopName(shop.name); }}>Edit</button></div>)}{!shopQuery.data?.length && <p className="muted">No shops yet.</p>}</div>
    <form className="config-form" onSubmit={event => { event.preventDefault(); if (shopId && itemId && price !== "") { savePrice.mutate({ shopId: Number(shopId), itemId: Number(itemId), sellingPricePerUnit: Number(price), active: true }); setPrice(""); } }}><label>Shop<select required value={shopId} onChange={event => setShopId(event.target.value ? Number(event.target.value) : "")}><option value="">Select shop</option>{(shopQuery.data ?? []).filter(shop => shop.active).map(shop => <option value={shop.id} key={shop.id}>{shop.name}</option>)}</select></label><label>Sales item<select required value={itemId} onChange={event => setItemId(event.target.value ? Number(event.target.value) : "")}><option value="">Select item</option>{saleItems.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Price per unit<input required min="0" step="0.01" type="number" value={price} onChange={event => setPrice(event.target.value)} /></label><button className="primary-button" disabled={savePrice.isPending}>Save price</button></form>
    <div className="price-list">{(priceQuery.data ?? []).map(row => <div key={row.price.id}><strong>{row.shop.name}</strong><span>{row.item.name}</span><b>{money(row.price.sellingPricePerUnit)}</b></div>)}</div>
  </Card>;
}

function RecipePanel() {
  const utils = trpc.useUtils();
  const recipeQuery = trpc.inventory.recipes.list.useQuery();
  const itemQuery = trpc.inventory.items.list.useQuery();
  const save = trpc.inventory.recipes.save.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const [name, setName] = useState(""); const [outputItemId, setOutputItemId] = useState<number | "">(""); const [componentId, setComponentId] = useState<number | "">(""); const [componentQty, setComponentQty] = useState("");
  const items = itemQuery.data ?? [];
  return <Card className="more-panel"><div className="panel-heading"><ClipboardList size={19} /><div><h2>Recipe storage</h2><p>Store reusable recipes and their component quantity in grams.</p></div></div>
    <form className="config-form recipe-form" onSubmit={event => { event.preventDefault(); if (!name.trim()) return; save.mutate({ name: name.trim(), outputItemId: outputItemId ? Number(outputItemId) : null, outputQuantityGrams: 1, note: null, active: true, lines: componentId && componentQty ? [{ itemId: Number(componentId), quantityGrams: Number(componentQty) }] : [] }); setName(""); setComponentQty(""); }}><label>Recipe name<input required value={name} onChange={event => setName(event.target.value)} /></label><label>Output item<select value={outputItemId} onChange={event => setOutputItemId(event.target.value ? Number(event.target.value) : "")}><option value="">Optional</option>{items.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Component<select value={componentId} onChange={event => setComponentId(event.target.value ? Number(event.target.value) : "")}><option value="">Optional</option>{items.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Component grams<input min="0.001" step="0.001" type="number" value={componentQty} onChange={event => setComponentQty(event.target.value)} /></label><button className="primary-button" disabled={save.isPending}>Save recipe</button></form>
    <div className="config-list">{(recipeQuery.data ?? []).map(recipe => <div key={recipe.id}><strong>{recipe.name}</strong><span>{recipe.outputItem?.name || "No output item"} · {recipe.lines.length} component(s)</span></div>)}{!recipeQuery.data?.length && <p className="muted">No recipes stored.</p>}</div>
  </Card>;
}

function AdminPanel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const userQuery = trpc.inventory.admin.users.useQuery(undefined, { enabled: user?.role === "admin" });
  const setRole = trpc.inventory.admin.setRole.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  if (user?.role !== "admin") return <Card className="more-panel"><div className="panel-heading"><Settings2 size={19} /><div><h2>Admin panel</h2><p>Administrator access is required to manage user roles.</p></div></div></Card>;
  return <Card className="more-panel"><div className="panel-heading"><Settings2 size={19} /><div><h2>Admin panel</h2><p>Control administrator and operating-user permissions.</p></div></div><div className="config-list">{(userQuery.data ?? []).map(member => <div key={member.id}><strong>{member.name || member.email || `User ${member.id}`}</strong><select value={member.role} onChange={event => setRole.mutate({ userId: member.id, role: event.target.value as "admin" | "user" })}><option value="user">Operational user</option><option value="admin">Administrator</option></select></div>)}</div></Card>;
}

function BackupPanel() {
  const backup = trpc.inventory.admin.backup.useQuery(undefined, { enabled: false });
  const exportBackup = async () => { const result = await backup.refetch(); if (result.data) { const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bakery-erp-backup-${today()}.json`; anchor.click(); URL.revokeObjectURL(url); } };
  return <Card className="more-panel"><div className="panel-heading"><ArchiveRestore size={19} /><div><h2>Backup</h2><p>Download an administrator-only JSON export of the operational database.</p></div></div><button className="primary-button" onClick={exportBackup} disabled={backup.isFetching}><Download size={15} />{backup.isFetching ? "Preparing backup…" : "Download backup"}</button></Card>;
}

type ExchangeKind = "purchases" | "production" | "packaging" | "sales";
function SpreadsheetPanel({ date, defaultKind = "purchases", shopIdOverride, onDateChange }: { date: string; defaultKind?: ExchangeKind; shopIdOverride?: number | null; onDateChange?: (date: string) => void }) {
  const utils = trpc.useUtils();
  const itemQuery = trpc.inventory.items.list.useQuery({ date });
  const purchaseQuery = trpc.inventory.purchases.list.useQuery();
  const production = trpc.inventory.operations.daily.useQuery({ date, type: "production" });
  const packaging = trpc.inventory.operations.daily.useQuery({ date, type: "packaging" });
  const shopQuery = trpc.inventory.shops.list.useQuery();
  const [shopId, setShopId] = useState<number | null>(null);
  useEffect(() => { if (shopIdOverride !== undefined) setShopId(shopIdOverride); else if (shopId === null && shopQuery.data?.[0]) setShopId(shopQuery.data[0].id); }, [shopIdOverride, shopId, shopQuery.data]);
  const sales = trpc.inventory.sales.daily.useQuery({ date, shopId: shopId ?? 1 }, { enabled: Boolean(shopId) });
  const createPurchase = trpc.inventory.purchases.create.useMutation(); const saveOperation = trpc.inventory.operations.save.useMutation(); const saveSale = trpc.inventory.sales.save.useMutation();
  const [kind, setKind] = useState<ExchangeKind>(defaultKind); const [message, setMessage] = useState("");
  const templateRows: Record<ExchangeKind, Record<string, unknown>[]> = {
    purchases: [{ Date: date, "Item ID": "", Qty: "", Unit: "kg", "Total Price": "", Status: "confirmed", Note: "" }],
    production: [{ Date: date, "Item ID": "", "Issued g": 0, "Return g": 0, "Damage g": 0, Note: "" }],
    packaging: [{ Date: date, "Item ID": "", "Issued g": 0, "Return g": 0, "Damage g": 0, Note: "" }],
    sales: [{ Date: date, "Shop ID": shopId ?? "", "Item ID": "", "Produce Qty": 0, "Sell Qty": 0, Note: "" }],
  };
  const downloadTemplate = () => downloadWorkbook(`bakery-${kind}-template`, [{ name: "Template", rows: templateRows[kind] }]);
  const downloadCsvTemplate = () => downloadCsv(`bakery-${kind}-template`, templateRows[kind]);
  const exportTable = () => {
    const itemName = new Map((itemQuery.data ?? []).map(item => [item.id, item.name]));
    const rows = kind === "purchases" ? (purchaseQuery.data ?? []).map(row => ({ Date: String(row.purchaseDate).slice(0, 10), "Item ID": row.itemId, Name: row.item.name, Qty: row.inputQuantity, Unit: row.inputUnit, "Base Qty": row.baseQuantity, "Base Unit": row.baseUnit, "Unit Price": row.unitCostPerGram, "Total Price": row.totalCost, Status: row.status, Note: row.note || "" })) : kind === "production" ? (production.data ?? []).map(row => ({ Date: date, "Item ID": row.item.id, Name: row.item.name, Opening: row.openingQtyGrams, In: row.inQtyGrams, Issued: row.issuedQtyGrams, Return: row.returnQtyGrams, Damage: row.damageQtyGrams, Used: row.usedQtyGrams, Closing: row.closingQtyGrams, Note: row.note || "" })) : kind === "packaging" ? (packaging.data ?? []).map(row => ({ Date: date, "Item ID": row.item.id, Name: row.item.name, Opening: row.openingQtyGrams, In: row.inQtyGrams, Issued: row.issuedQtyGrams, Return: row.returnQtyGrams, Damage: row.damageQtyGrams, Used: row.usedQtyGrams, Closing: row.closingQtyGrams, Note: row.note || "" })) : (sales.data ?? []).map(row => ({ Date: date, "Shop ID": shopId, "Item ID": row.item.id, Name: itemName.get(row.item.id), Opening: row.openingQtyGrams, Produce: row.produceQtyGrams, Sell: row.sellQtyGrams, Closing: row.closingQtyGrams, "Unit Price": row.sellingPricePerUnit, "Total Price": row.totalPrice, Note: row.note || "" }));
    downloadWorkbook(`bakery-${kind}-${date}`, [{ name: kind, rows }]);
  };
  const exportCsv = () => {
    const rows = kind === "purchases" ? (purchaseQuery.data ?? []).map(row => ({ Date: String(row.purchaseDate).slice(0, 10), "Item ID": row.itemId, Name: row.item.name, Qty: row.inputQuantity, Unit: row.inputUnit, "Base Qty": row.baseQuantity, "Base Unit": row.baseUnit, "Unit Price": row.unitCostPerGram, "Total Price": row.totalCost, Status: row.status, Note: row.note || "" })) : kind === "production" ? (production.data ?? []).map(row => ({ Date: date, "Item ID": row.item.id, Name: row.item.name, Opening: row.openingQtyGrams, In: row.inQtyGrams, Issued: row.issuedQtyGrams, Return: row.returnQtyGrams, Damage: row.damageQtyGrams, Used: row.usedQtyGrams, Closing: row.closingQtyGrams, Note: row.note || "" })) : kind === "packaging" ? (packaging.data ?? []).map(row => ({ Date: date, "Item ID": row.item.id, Name: row.item.name, Opening: row.openingQtyGrams, In: row.inQtyGrams, Issued: row.issuedQtyGrams, Return: row.returnQtyGrams, Damage: row.damageQtyGrams, Used: row.usedQtyGrams, Closing: row.closingQtyGrams, Note: row.note || "" })) : (sales.data ?? []).map(row => ({ Date: date, "Shop ID": shopId, "Item ID": row.item.id, Name: row.item.name, Opening: row.openingQtyGrams, Produce: row.produceQtyGrams, Sell: row.sellQtyGrams, Closing: row.closingQtyGrams, "Unit Price": row.sellingPricePerUnit, "Total Price": row.totalPrice, Note: row.note || "" }));
    downloadCsv(`bakery-${kind}-${date}`, rows);
  };
  const importFiles = async (files: File[]) => {
    setMessage("Reading spreadsheet(s)…");
    try {
      if (!files.length) return;
      const itemById = new Map((itemQuery.data ?? []).map(item => [item.id, item]));
      const itemByName = new Map((itemQuery.data ?? []).map(item => [item.name.trim().toLocaleLowerCase(), item]));
      const importedDates = new Set<string>();
      let completed = 0;
      for (const file of files) {
        const isCsv = file.name.toLowerCase().endsWith(".csv");
        const source = isCsv ? stripUtf8Bom(await file.text()) : await file.arrayBuffer();
        const workbook = XLSX.read(source, { type: isCsv ? "string" : "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
        if (!rows.length) throw new Error(`${file.name}: the spreadsheet contains no data rows.`);
        const fileDates = new Set<string>();
        for (const row of rows) {
          const rowDate = resolveProductionImportDate(file.name, row.Date, date);
          fileDates.add(rowDate);
          const rawId = firstSpreadsheetValue(row, "Item ID", "ItemID");
          const rawName = String(firstSpreadsheetValue(row, "Item Name", "Name")).trim();
          const id = rawId !== "" ? Number(rawId) : itemByName.get(rawName.toLocaleLowerCase())?.id ?? 0;
          const item = itemById.get(id) ?? itemByName.get(rawName.toLocaleLowerCase());
          if (!Number.isInteger(id) || id <= 0 || !item) throw new Error(`${file.name}: item ${rawName || rawId || "(unknown)"} was not found for the selected date.`);
          if (kind === "purchases") await createPurchase.mutateAsync({ purchaseDate: rowDate, itemId: id, inputQuantity: Number(row.Qty), inputUnit: String(row.Unit) as "g" | "kg" | "viss" | "pcs", totalCost: Number(row["Total Price"] ?? row["Total Cost"]), status: String(row.Status || "confirmed") === "draft" ? "draft" : "confirmed", note: String(row.Note || "") || null });
          if (kind === "production" || kind === "packaging") {
            const issued = Number(firstSpreadsheetValue(row, "Issued g", "Issued"));
            const returned = Number(firstSpreadsheetValue(row, "Return g", "Return"));
            const damage = Number(firstSpreadsheetValue(row, "Damage g", "Damage"));
            if (![issued, returned, damage].every(value => Number.isFinite(value) && value >= 0)) throw new Error(`${file.name}: Issued, Return, and Damage must be non-negative numbers.`);
            await saveOperation.mutateAsync({ date: rowDate, itemId: id, type: kind, issuedQtyGrams: issued, returnQtyGrams: returned, damageQtyGrams: damage, note: String(row.Note || "") || null });
          }
          if (kind === "sales") await saveSale.mutateAsync({ date: rowDate, shopId: Number(row["Shop ID"]), itemId: id, produceQtyGrams: Number(row["Produce Qty"] ?? row["Produce g"] ?? 0), sellQtyGrams: Number(row["Sell Qty"] ?? row["Sell g"] ?? 0), note: String(row.Note || "") || null });
          completed++;
        }
        fileDates.forEach(importedDate => importedDates.add(importedDate));
      }
      await utils.inventory.invalidate();
      setMessage(`Imported ${completed} ${kind} record(s) for ${Array.from(importedDates).sort().join(", ")}. Opening, Used, and Closing remain system-calculated.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed. Check the template and row values."); }
  };
  return <Card className="more-panel"><div className="panel-heading"><FileSpreadsheet size={19} /><div><h2>Import / export</h2><p>Choose a date and table, then import or export daily records from one place.</p></div></div><div className="exchange-actions">{onDateChange && <label>Date<input type="date" value={date} onChange={event => onDateChange(event.target.value)} /></label>}<label>Table<select value={kind} onChange={event => setKind(event.target.value as ExchangeKind)}><option value="purchases">Purchase</option><option value="production">Production</option><option value="packaging">Packaging</option><option value="sales">Sales</option></select></label><button onClick={downloadTemplate}><Download size={15} />XLSX template</button><button onClick={downloadCsvTemplate}><Download size={15} />CSV template</button><button onClick={exportTable}><Download size={15} />Export XLSX</button><button onClick={exportCsv}><Download size={15} />Export CSV</button><label className="file-button"><UploadIcon />Import XLSX / CSV<input type="file" multiple accept=".xlsx,.xls,.csv" onChange={event => event.target.files?.length && importFiles(Array.from(event.target.files))} /></label></div>{message && <p className="exchange-message">{message}</p>}</Card>;
}

function UploadIcon() { return <span aria-hidden="true">↑</span>; }

function OrderTable({ date }: { date: string }) {
  const utils = trpc.useUtils();
  const query = trpc.inventory.orders.daily.useQuery({ date });
  const save = trpc.inventory.orders.save.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const [drafts, setDrafts] = useState<Record<number, { quantity: string; note: string }>>({});
  const rows = query.data ?? [];
  function draftFor(row: any) { return drafts[row.item.id] ?? { quantity: row.order ? String(row.order.quantity) : "", note: row.order?.note ?? "" }; }
  return <Card className="more-panel"><div className="panel-heading"><ClipboardList size={19} /><div><h2>Order Table</h2><p>Only Sale items from Item Dashboard appear here. Saved quantities use the recipe effective on this date and feed Production/Packaging Issued automatically.</p></div></div><div className="table-scroll"><table><thead><tr><th>Sale item</th><th>Order Qty</th><th>Note</th><th></th></tr></thead><tbody>{rows.map(row => { const draft = draftFor(row); return <tr key={row.item.id}><td><strong>{row.item.name}</strong><small>{row.item.displayUnit}</small></td><td><input type="number" min="0" step="0.001" value={draft.quantity} onChange={event => setDrafts({ ...drafts, [row.item.id]: { ...draft, quantity: event.target.value } })} /></td><td><input value={draft.note} onChange={event => setDrafts({ ...drafts, [row.item.id]: { ...draft, note: event.target.value } })} placeholder="Order note" /></td><td><button disabled={save.isPending} onClick={() => save.mutate({ date, salesItemId: row.item.id, quantity: Math.max(0, asNumber(draft.quantity)), note: draft.note || null })}>Save</button></td></tr>; })}{!rows.length && <tr><td colSpan={4}><EmptyState>No Sale items are active on this date. Add them in Item Dashboard first.</EmptyState></td></tr>}</tbody></table></div></Card>;
}

function GlobalSearchPanel({ goTo, openMore }: { goTo: (page: Page, date?: string) => void; openMore: (section: "shops" | "recipes") => void }) {
  const [term, setTerm] = useState("");
  const query = trpc.inventory.search.useQuery({ query: term.trim() }, { enabled: term.trim().length > 0 });
  const data = query.data;
  return <Card className="more-panel"><div className="panel-heading"><Search size={19} /><div><h2>Global search</h2><p>Find items, shops, recipes, and operational notes across the ERP.</p></div></div><label className="search-field"><span>Search by name, code, category, or note</span><input autoFocus value={term} onChange={event => setTerm(event.target.value)} placeholder="e.g. flour, market, damaged" /></label>{query.isFetching && <p className="muted">Searching…</p>}{term.trim() && data && <div className="search-results"><div><h3>Items</h3>{data.items.length ? data.items.map(item => <button className="search-result" key={`item-${item.id}`} onClick={() => goTo("items")}><strong>{item.name}</strong><span>{item.code || item.category || "Item Dashboard"}</span></button>) : <p className="muted">No matching items.</p>}</div><div><h3>Shops</h3>{data.shops.length ? data.shops.map(shop => <button className="search-result" key={`shop-${shop.id}`} onClick={() => openMore("shops")}><strong>{shop.name}</strong><span>Shops & prices</span></button>) : <p className="muted">No matching shops.</p>}</div><div><h3>Recipes</h3>{data.recipes.length ? data.recipes.map(recipe => <button className="search-result" key={`recipe-${recipe.id}`} onClick={() => openMore("recipes")}><strong>{recipe.name}</strong><span>{recipe.note || "Recipes"}</span></button>) : <p className="muted">No matching recipes.</p>}</div><div><h3>Operational records</h3>{data.records.length ? data.records.map(record => <button className="search-result" key={`${record.kind}-${record.id}`} onClick={() => goTo(record.kind === "Purchase" ? "purchases" : record.kind === "Sale" ? "sales" : record.kind.startsWith("packaging") ? "packaging" : "production", String(record.date).slice(0, 10))}><strong>{record.kind} · {String(record.date).slice(0, 10)}</strong><span>{record.note || `Item ${record.itemId}`}</span></button>) : <p className="muted">No matching operational notes.</p>}</div></div>}</Card>;
}

function AuditLogPanel({ from, to }: { from: string; to: string }) {
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [entity, setEntity] = useState("");
  const [details, setDetails] = useState("");
  const query = trpc.inventory.audit.list.useQuery({ from, to, action: action || undefined, actor: actor || undefined, entity: entity || undefined, details: details || undefined, limit: 100 });
  const rows = query.data ?? [];
  return <Card className="more-panel"><div className="panel-heading"><History size={19} /><div><h2>Audit log</h2><p>Administrator-only history of operational changes and control actions.</p></div></div><div className="audit-filters"><label>From<input type="date" value={from} readOnly /></label><label>To<input type="date" value={to} readOnly /></label><label>Action<select value={action} onChange={event => setAction(event.target.value)}><option value="">All actions</option><option value="operation_save">Operation save</option><option value="sales_save">Sales save</option><option value="opening_override">Opening override</option><option value="daily_lock">Daily lock</option><option value="daily_reopen">Daily reopen</option></select></label><label>Actor<input value={actor} onChange={event => setActor(event.target.value)} placeholder="Name or email" /></label><label>Entity<input value={entity} onChange={event => setEntity(event.target.value)} placeholder="operations" /></label><label>Details<input value={details} onChange={event => setDetails(event.target.value)} placeholder="item or reason" /></label></div><div className="table-scroll"><table><thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Business date</th><th>Actor</th><th>Details</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td><strong>{row.action}</strong></td><td>{row.entityType}{row.entityId ? ` #${row.entityId}` : ""}</td><td>{row.businessDate ? String(row.businessDate).slice(0, 10) : "—"}</td><td>{row.actorName || row.actorEmail || "System"}</td><td><code>{row.details || "—"}</code></td></tr>)}{!rows.length && <tr><td colSpan={6}><EmptyState>No audit entries for this range.</EmptyState></td></tr>}</tbody></table></div></Card>;
}

type MoreSection = "shops" | "recipes" | "exchange" | "admin" | "backup" | "search" | "audit" | "orders";
function MorePage({ date, from, to, goTo, setDate, isAdmin }: { date: string; from: string; to: string; goTo: (page: Page, date?: string) => void; setDate: (date: string) => void; isAdmin: boolean }) {
  const [section, setSection] = useState<MoreSection>("shops");
  const buttons: Array<{ key: MoreSection; label: string; icon: typeof Store }> = [
    { key: "orders", label: "Order Table", icon: ClipboardList },
    { key: "search", label: "Global search", icon: Search },
    ...(isAdmin ? [{ key: "audit" as MoreSection, label: "Audit log", icon: History }] : []),
    { key: "shops", label: "Shops & prices", icon: Store },
    { key: "recipes", label: "Recipes", icon: ClipboardList },
    { key: "exchange", label: "Import / export", icon: FileSpreadsheet },
    { key: "admin", label: "Admin panel", icon: Settings2 },
    { key: "backup", label: "Backup", icon: ArchiveRestore },
  ];
  return <><PageHeader title="More" /><div className="more-menu-grid"><button onClick={() => goTo("items")}><Boxes size={19} /><strong>Item Dashboard</strong></button>{buttons.map(({ key, label, icon: Icon }) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}><Icon size={19} /><strong>{label}</strong></button>)}</div><div className="more-stack">{section === "orders" && <OrderTable date={date} />}{section === "shops" && <ShopPanel />}{section === "recipes" && <RecipeManager />}{section === "exchange" && <SpreadsheetPanel date={date} onDateChange={setDate} />}{section === "admin" && <AdminPanel />}{section === "backup" && <BackupPanel />}{section === "search" && <GlobalSearchPanel goTo={(page, matchedDate) => { if (matchedDate) setDate(matchedDate); goTo(page, matchedDate); }} openMore={sectionName => setSection(sectionName)} />}{section === "audit" && isAdmin && <AuditLogPanel from={from} to={to} />}</div></>;
}

const navigation: Array<{ page: Page; label: string; icon: typeof Package }> = [
  { page: "dashboard", label: "Dashboard", icon: BarChart3 }, { page: "items", label: "Item Dashboard", icon: Boxes }, { page: "purchases", label: "Purchase", icon: ShoppingCart }, { page: "production", label: "Production", icon: Box }, { page: "packaging", label: "Packaging", icon: Package }, { page: "sales", label: "Sale", icon: TrendingUp }, { page: "reports", label: "Reports", icon: ReceiptText }, { page: "more", label: "More", icon: ChevronRight },
];

function ERPWorkspace() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState(monthFirst());
  const [to, setTo] = useState(today());
  const heading = navigation.find(item => item.page === page)?.label ?? "Bakery ERP";
  const content = page === "dashboard" ? <DashboardPage date={date} /> : page === "items" ? <ItemsPage date={date} isAdmin={user?.role === "admin"} /> : page === "purchases" ? <PurchasesPage date={date} /> : page === "production" ? <OperationsPage date={date} type="production" /> : page === "packaging" ? <OperationsPage date={date} type="packaging" /> : page === "sales" ? <SalesPage date={date} /> : page === "reports" ? <DetailedReports date={date} setDate={setDate} from={from} to={to} setFrom={setFrom} setTo={setTo} /> : <MorePage date={date} from={from} to={to} goTo={setPage} setDate={setDate} isAdmin={user?.role === "admin"} />;
  return <div className="erp-shell"><header className="erp-topbar"><div><span className="brand-mark">B</span><div className="brand-copy"><strong>Bakery ERP</strong><small>{heading} · operational control</small></div></div><div className="top-actions"><DateControl value={date} onChange={setDate} /><button className="user-button" onClick={logout} title="Sign out"><span>{user?.name?.slice(0, 1).toUpperCase() || "U"}</span><LogOut size={15} /></button></div></header><main className="erp-main"><nav className="page-tabs" aria-label="Main navigation">{navigation.map(item => { const Icon = item.icon; return <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => setPage(item.page)}><Icon size={15} />{item.label}</button>; })}</nav><div className="page-content">{content}</div></main></div>;
}

export default function BakeryERP() { return <AccessGate><ERPWorkspace /></AccessGate>; }
