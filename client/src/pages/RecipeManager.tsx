import { trpc } from "@/lib/trpc";
import { FormEvent, useState } from "react";

type RecipeLine = { itemId: number | ""; quantityGrams: string };

export default function RecipeManager() {
  const utils = trpc.useUtils();
  const recipeQuery = trpc.inventory.recipes.list.useQuery();
  const itemQuery = trpc.inventory.items.list.useQuery();
  const save = trpc.inventory.recipes.save.useMutation({ onSuccess: () => { utils.inventory.invalidate(); reset(); } });
  const remove = trpc.inventory.recipes.delete.useMutation({ onSuccess: () => utils.inventory.invalidate() });
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [outputItemId, setOutputItemId] = useState<number | "">("");
  const [lines, setLines] = useState<RecipeLine[]>([{ itemId: "", quantityGrams: "" }]);
  const items = itemQuery.data ?? [];
  function reset() { setEditing(null); setName(""); setOutputItemId(""); setLines([{ itemId: "", quantityGrams: "" }]); }
  function edit(recipe: any) { setEditing(recipe); setName(recipe.name); setOutputItemId(recipe.outputItemId ?? ""); setLines(recipe.lines.length ? recipe.lines.map((line: any) => ({ itemId: line.itemId, quantityGrams: String(line.quantityGrams) })) : [{ itemId: "", quantityGrams: "" }]); }
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; save.mutate({ id: editing?.id, name: name.trim(), outputItemId: outputItemId ? Number(outputItemId) : null, outputQuantityGrams: 1, note: null, active: true, lines: lines.filter(line => line.itemId && Number(line.quantityGrams) > 0).map(line => ({ itemId: Number(line.itemId), quantityGrams: Number(line.quantityGrams) })) }); }
  return <section className="erp-card more-panel"><div className="panel-heading"><span className="recipe-icon">▤</span><div><h2>Recipe storage</h2><p>Create, edit, or delete reusable recipes with multiple component quantities in grams.</p></div></div>
    <form className="recipe-editor" onSubmit={submit}><div className="recipe-top"><label>Recipe name<input required value={name} onChange={event => setName(event.target.value)} placeholder="Recipe name" /></label><label>Output item<select value={outputItemId} onChange={event => setOutputItemId(event.target.value ? Number(event.target.value) : "")}><option value="">Optional</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="recipe-lines"><div className="recipe-line-head"><strong>Components</strong><button type="button" onClick={() => setLines([...lines, { itemId: "", quantityGrams: "" }])}>+ Add component</button></div>{lines.map((line, index) => <div className="recipe-line" key={index}><select value={line.itemId} onChange={event => setLines(lines.map((current, i) => i === index ? { ...current, itemId: event.target.value ? Number(event.target.value) : "" } : current))}><option value="">Select component</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input type="number" min="0.001" step="0.001" placeholder="Quantity in g" value={line.quantityGrams} onChange={event => setLines(lines.map((current, i) => i === index ? { ...current, quantityGrams: event.target.value } : current))} /><button type="button" className="danger-button" onClick={() => setLines(lines.length === 1 ? [{ itemId: "", quantityGrams: "" }] : lines.filter((_, i) => i !== index))}>Remove</button></div>)}</div><div className="recipe-actions"><button type="button" onClick={reset}>Clear</button><button className="primary-button" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Update recipe" : "Save recipe"}</button></div></form>
    <div className="config-list">{(recipeQuery.data ?? []).map(recipe => <div key={recipe.id}><div><strong>{recipe.name}</strong><span className="recipe-meta">{recipe.outputItem?.name || "No output item"} · {recipe.lines.map((line: any) => `${line.item.name} (${line.quantityGrams} g)`).join(", ") || "No components"}</span></div><div className="row-actions"><button onClick={() => edit(recipe)}>Edit</button><button className="danger-button" onClick={() => { if (window.confirm(`Delete ${recipe.name}?`)) remove.mutate({ id: recipe.id }); }}>Delete</button></div></div>)}{!recipeQuery.data?.length && <p className="muted">No recipes stored.</p>}</div>
  </section>;
}
