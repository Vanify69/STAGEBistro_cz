import { requirePermission } from '../middleware/auth.js';

/** Čtení zaměstnanců — potřebné i pro plán směn, docházku, smlouvy a výplaty */
export const permStaffWorkersRead = requirePermission(
  'staff.workers',
  'staff.shifts',
  'staff.attendance',
  'staff.contracts',
  'staff.payments'
);

export const permStaffWorkersWrite = requirePermission('staff.workers');
export const permStaffContracts = requirePermission('staff.contracts');
export const permStaffShifts = requirePermission('staff.shifts');
export const permStaffAttendance = requirePermission('staff.attendance');
export const permStaffPayments = requirePermission('staff.payments');

export const permProvozSales = requirePermission('provoz.sales');
export const permProvozReceipts = requirePermission('provoz.receipts');

export const permAccountingRead = requirePermission('accounting.read');
export const permAccountingBook = requirePermission('accounting.book');
export const permAccountingContracts = requirePermission('accounting.contracts');
