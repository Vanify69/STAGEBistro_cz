import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  fetchInventoryItems,
  submitInventoryCount,
  type InventoryCategory,
  type InventoryItem,
} from "@/lib/provozApi";

const BRAND: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif" };
const BODY: React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" };

type ChipId = "all" | string;

export function InventoryCountTab() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<ChipId>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchInventoryItems();
      setItems(res.items);
      setCategories(res.categories);
      const next: Record<string, string> = {};
      for (const r of res.items) next[r.id] = r.qtyOnHand;
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (chip !== "all") {
        if (chip === "none") {
          if (item.categoryId) return false;
        } else if (item.categoryId !== chip) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.categoryName ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, chip, search]);

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; sort: number; items: InventoryItem[] }>();
    for (const item of filtered) {
      const key = item.categoryId ?? "none";
      const title = item.categoryName ?? "Bez kategorie";
      const sort = categories.find((c) => c.id === item.categoryId)?.sortOrder ?? 999;
      const bucket = map.get(key) ?? { title, sort, items: [] };
      bucket.items.push(item);
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "cs"));
  }, [filtered, categories]);

  const chips: { id: ChipId; label: string }[] = useMemo(
    () => [
      { id: "all", label: "Vše" },
      ...categories.map((c) => ({ id: c.id, label: c.name })),
      { id: "none", label: "Bez kategorie" },
    ],
    [categories]
  );

  async function save() {
    setSaving(true);
    setError("");
    setDone(false);
    try {
      const changed = items
        .map((i) => ({
          inventoryItemId: i.id,
          countedQty: (draft[i.id] ?? i.qtyOnHand).trim(),
          prev: i.qtyOnHand,
        }))
        .filter((l) => l.countedQty !== "" && l.countedQty !== l.prev)
        .map(({ inventoryItemId, countedQty }) => ({ inventoryItemId, countedQty }));

      const lines =
        changed.length > 0
          ? changed
          : items.map((i) => ({
              inventoryItemId: i.id,
              countedQty: (draft[i.id] ?? i.qtyOnHand).trim(),
            }));

      await submitInventoryCount({
        note: note.trim() || null,
        lines,
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
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-border px-4 py-3 space-y-3 bg-background">
            <input
              className="w-full h-11 bg-secondary px-3 text-sm border border-border focus:outline-none focus:border-foreground/30"
              placeholder="Hledat surovinu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChip(c.id)}
                  className={`shrink-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide border ${
                    chip === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Zobrazeno {filtered.length} / {items.length}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {groups.map((group) => (
              <section key={group.title} className="space-y-3">
                <h3
                  style={{ ...BRAND, letterSpacing: "0.1em" }}
                  className="text-[11px] font-bold uppercase text-muted-foreground border-b border-border pb-1"
                >
                  {group.title} · {group.items.length}
                </h3>
                {group.items.map((item) => {
                  const changed = (draft[item.id] ?? "") !== item.qtyOnHand;
                  return (
                    <div key={item.id} className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        {item.name} ({item.unit}) · systém {item.qtyOnHand}
                        {changed ? " · změněno" : ""}
                      </label>
                      <input
                        className={`w-full h-11 bg-secondary px-3 text-sm border focus:outline-none focus:border-foreground/30 ${
                          changed ? "border-foreground/40" : "border-border"
                        }`}
                        value={draft[item.id] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [item.id]: e.target.value }))
                        }
                        inputMode="decimal"
                      />
                    </div>
                  );
                })}
              </section>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">Nic nenalezeno.</p>
            )}
            <div className="space-y-1 pt-2">
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
