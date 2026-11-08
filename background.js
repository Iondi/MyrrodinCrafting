// Runs quietly in every player's Owlbear. On the GM's computer it keeps the
// Craft Master Sheet up to date whenever crafting changes in the room.
import * as S from "./store.js?v=1.5.0";
import { syncNow, sheetConfig } from "./sheetsync.js?v=1.5.0";

(async () => {
  await S.whenReady();
  const self = await S.me();
  if (self.role !== "GM") return;
  let timer = null, latest = await S.getAll().catch(() => ({}));
  const later = () => { clearTimeout(timer); timer = setTimeout(() => { if (sheetConfig().url) syncNow(latest).catch(() => {}); }, 3000); };
  S.onChange((all) => { latest = all; later(); });
  // When the GM connects the sheet (in the panel), send everything.
  window.addEventListener("storage", (e) => { if (e.key === "myrrodin-crafting-sheet") later(); });
  later();
})();
