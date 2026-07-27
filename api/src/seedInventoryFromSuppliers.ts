import './loadEnv.js';
import { syncInventoryFromSupplierItems } from './lib/syncInventoryFromSuppliers.js';

async function main() {
  const result = await syncInventoryFromSupplierItems();
  console.log('Sync inventory from suppliers:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
