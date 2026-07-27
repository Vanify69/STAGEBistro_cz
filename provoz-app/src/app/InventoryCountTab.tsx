import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchInventoryItems, submitInventoryCount, type InventoryItem } from "@/lib/provozApi";

const BRAND: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif" };
const BODY: React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" };

export function InventoryCountTab() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchInventoryItems();
      setItems(rows);
      const next: Record<string, string> = {};
      for (const r of rows) next[r.id] = r.qtyOnHand;
      setDraft(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Načtení selhalo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    setSaving(true);
    setError("");
    setDone(false);
    try {
      await submitInventoryCount({
        note: note.trim() || null,
        lines: items.map((i) => ({
          inventoryItemId: i.id,
          countedQty: (draft[i.id] ?? i.qtyOnHand).trim(),
        })),
      });
      setDone(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full" style={BODY}>
      <div className="flex items-center h-14 border-b border-border px-4 shrink-0">
        <p style={{ ...BRAND, letterSpacing: "0.08em" }} className="text-sm font-bold uppercase">
          Inventura
        </p>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Zadejte skutečné stavy po směně. Rozdíl se zapíše do skladu.
            </p>
            {items.map((item) => (
              <div key={item.id} className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  {item.name} ({item.unit}) · systém {item.qtyOnHand}
                </label>
                <input
                  className="w-full h-11 bg-secondary px-3 text-sm border border-border focus:outline-none focus:border-foreground/30"
                  value={draft[item.id] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                  inputMode="decimal"
                />
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Zatím žádné suroviny na skladu.</p>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Poznámka</label>
              <input
                className="w-full h-11 bg-secondary px-3 text-sm border border-border focus:outline-none"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {done && <p className="text-sm text-foreground">Inventura uložena.</p>}
          </div>
          <div className="px-4 pb-6 pt-3 border-t border-border shrink-0">
            <button
              type="button"
              disabled={saving || items.length === 0}
              onClick={() => void save()}
              className="w-full h-12 bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
            >
              {saving ? "Ukládám…" : "Uložit inventuru"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
