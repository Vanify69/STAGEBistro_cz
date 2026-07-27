import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  fetchMenuAvailability,
  setMenuItemVisibility,
  type MenuAvailabilityItem,
} from "@/lib/provozApi";

const BODY: React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" };

export function MenuAvailabilityTab() {
  const [items, setItems] = useState<MenuAvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchMenuAvailability());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Načtení selhalo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function toggle(item: MenuAvailabilityItem) {
    setBusyId(item.id);
    setError("");
    try {
      await setMenuItemVisibility(item.id, !item.active);
      setItems((rows) =>
        rows.map((r) => (r.id === item.id ? { ...r, active: !item.active } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uložení selhalo");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col h-full" style={BODY}>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {error && <p className="px-4 py-2 text-sm text-destructive">{error}</p>}
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.nameCz}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.categoryNameCz ?? "—"}
                    {" · "}
                    {item.hasRecipe
                      ? item.sellableCount == null
                        ? "—"
                        : `ještě ${item.sellableCount}`
                      : "bez receptury"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void toggle(item)}
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-3 py-2 border ${
                    item.active
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {item.active ? "Na webu" : "Skryté"}
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-4 py-8 text-sm text-muted-foreground">Žádné položky menu.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
