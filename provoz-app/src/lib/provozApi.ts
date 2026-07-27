import { apiFetch } from './api';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  permissions: string[];
};

export type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  note: string | null;
  active: boolean;
};

export type SupplierItem = {
  id: string;
  supplierId: string;
  name: string;
  unit: string;
  defaultQty: string | null;
  active: boolean;
};

export type ApiReceipt = {
  id: string;
  category: 'nafta' | 'suroviny' | 'ostatni';
  status: string;
  amountCents: number | null;
  note: string | null;
  storageKey: string | null;
  accountingEmailedAt: string | null;
  createdAt: string;
};

export type ReceiptUiCategory = 'Suroviny' | 'Nafta' | 'Ostatní';

const CAT_TO_API: Record<ReceiptUiCategory, ApiReceipt['category']> = {
  Suroviny: 'suroviny',
  Nafta: 'nafta',
  Ostatní: 'ostatni',
};

const CAT_FROM_API: Record<ApiReceipt['category'], ReceiptUiCategory> = {
  suroviny: 'Suroviny',
  nafta: 'Nafta',
  ostatni: 'Ostatní',
};

export function categoryToApi(c: ReceiptUiCategory): ApiReceipt['category'] {
  return CAT_TO_API[c];
}

export function categoryFromApi(c: ApiReceipt['category']): ReceiptUiCategory {
  return CAT_FROM_API[c] ?? 'Ostatní';
}

export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/Kč/gi, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function formatCents(cents: number | null): string {
  if (cents == null) return '';
  return `${(cents / 100).toLocaleString('cs-CZ')} Kč`;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await apiFetch<{ user: AuthUser | null }>('/api/auth/me');
  return res.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiFetch<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.user;
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const res = await apiFetch<{ suppliers: Supplier[] }>('/api/provoz/suppliers');
  return res.suppliers;
}

export async function fetchSupplierItems(supplierId: string): Promise<SupplierItem[]> {
  const res = await apiFetch<{ items: SupplierItem[] }>(
    `/api/provoz/suppliers/${supplierId}/items`
  );
  return res.items;
}

export async function createOrder(input: {
  supplierId: string;
  note: string | null;
  lines: { supplierItemId: string; quantity: string; lineNote: string | null }[];
}): Promise<{ orderId: string }> {
  const res = await apiFetch<{ order: { id: string } }>('/api/provoz/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { orderId: res.order.id };
}

export async function previewOrder(
  orderId: string
): Promise<{ to: string; subject: string; body: string }> {
  return apiFetch(`/api/provoz/orders/${orderId}/preview`, {
    method: 'POST',
    body: '{}',
  });
}

export async function sendOrder(
  orderId: string
): Promise<{ emailed: boolean; error?: string }> {
  return apiFetch(`/api/provoz/orders/${orderId}/send`, {
    method: 'POST',
    body: '{}',
  });
}

export type OpenOrderLine = {
  id: string;
  nameSnapshot: string;
  unitSnapshot: string;
  quantity: string;
  lineNote: string | null;
  quantityReceived?: string;
  quantityRemaining?: string;
};

export type OpenOrder = {
  id: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  supplier: Supplier | null;
  lines: OpenOrderLine[];
};

export async function fetchOpenOrders(): Promise<OpenOrder[]> {
  const res = await apiFetch<{ orders: OpenOrder[] }>(
    '/api/provoz/orders?status=open&limit=50'
  );
  return res.orders;
}

export async function receiveOrder(
  orderId: string,
  input: {
    note: string | null;
    lines: { orderLineId: string; quantityReceived: string }[];
  }
): Promise<void> {
  await apiFetch(`/api/provoz/orders/${orderId}/receive`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type MenuAvailabilityItem = {
  id: string;
  nameCz: string;
  active: boolean;
  categoryNameCz: string | null;
  sellableCount: number | null;
  hasRecipe: boolean;
};

export async function fetchMenuAvailability(): Promise<MenuAvailabilityItem[]> {
  const res = await apiFetch<{ items: MenuAvailabilityItem[] }>(
    '/api/provoz/menu-availability'
  );
  return res.items;
}

export async function setMenuItemVisibility(id: string, active: boolean): Promise<void> {
  await apiFetch(`/api/provoz/menu-items/${id}/visibility`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

export type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  qtyOnHand: string;
  minQty: string | null;
  active: boolean;
};

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const res = await apiFetch<{ items: InventoryItem[] }>('/api/provoz/inventory-items');
  return res.items;
}

export async function submitInventoryCount(input: {
  note: string | null;
  lines: { inventoryItemId: string; countedQty: string }[];
}): Promise<void> {
  await apiFetch('/api/provoz/inventory-counts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchReceipts(): Promise<ApiReceipt[]> {
  const res = await apiFetch<{ receipts: ApiReceipt[] }>('/api/provoz/receipts');
  return res.receipts;
}

export async function uploadReceipt(input: {
  file: Blob;
  category: ReceiptUiCategory;
  amount: string;
  note: string;
}): Promise<{ emailed: boolean }> {
  const mime = input.file.type || 'image/jpeg';
  const created = await apiFetch<{ receipt: { id: string } }>('/api/provoz/receipts', {
    method: 'POST',
    body: JSON.stringify({
      category: categoryToApi(input.category),
      businessDate: new Date().toISOString().slice(0, 10),
      amountCents: parseAmountToCents(input.amount),
      note: input.note.trim() || null,
    }),
  });
  const id = created.receipt.id;
  const presign = await apiFetch<{ uploadUrl: string; storageKey: string; mime: string }>(
    `/api/provoz/receipts/${id}/presign`,
    { method: 'POST', body: JSON.stringify({ mime }) }
  );
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: input.file,
  });
  if (!put.ok) throw new Error('Upload do úložiště selhal');
  const completed = await apiFetch<{ emailed: boolean }>(`/api/provoz/receipts/${id}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ storageKey: presign.storageKey, mime }),
  });
  return { emailed: completed.emailed };
}

export type StaffWorker = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
};

export type CalendarAssignment = {
  id: string;
  workerId: string;
  firstName: string;
  lastName: string;
  businessDate: string;
  plannedStart: string;
  plannedEnd: string;
  attendanceStatus: 'open' | 'confirmed' | null;
};

export type CalendarDay = {
  date: string | null;
  dayOfMonth: number | null;
  events: { id: string; titleCz: string; timeText: string | null }[];
  assignments: CalendarAssignment[];
};

export type MonthCalendar = {
  year: number;
  month: number;
  days: CalendarDay[];
};

export async function fetchActiveWorkers(): Promise<StaffWorker[]> {
  const res = await apiFetch<{ workers: StaffWorker[] }>('/api/provoz/workers');
  return res.workers.filter((w) => w.status === 'active');
}

export async function fetchMonthCalendar(year: number, month: number): Promise<MonthCalendar> {
  const res = await apiFetch<{ calendar: MonthCalendar }>(
    `/api/provoz/calendar/${year}/${month}`
  );
  return res.calendar;
}

export async function saveMonthPlan(input: {
  workerId: string;
  year: number;
  month: number;
  plannedStart: string;
  plannedEnd: string;
  dates: string[];
}): Promise<{
  created: string[];
  cancelled: string[];
  updated: string[];
  skipped: { date: string; reason: string }[];
}> {
  return apiFetch('/api/provoz/shifts/month-plan', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function hasPermission(permissions: string[] | undefined, key: string): boolean {
  return Boolean(permissions?.includes(key) || permissions?.includes('*'));
}
