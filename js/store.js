// =====================================================================
//  Talking to Owlbear, and where crafting records are kept.
//  Records are saved with the ROOM, so they follow you between scenes.
//  Character stats (ability scores, proficiency) are read from the
//  Myr'rodin System's character sheets when that extension is on.
// =====================================================================
import OBR from "../vendor/obr-sdk.js?v=1.0.1";
import { inflateSync, strFromU8 } from "../vendor/fflate.js?v=1.0.1";
import { normalizeCrafter, blankCrafter, abilityMod } from "./rules.js?v=1.0.1";

export { OBR };
export const NS = "com.emberbelle.crafting";
export const CHARS_KEY = `${NS}/chars`;
const MYR = "com.emberbelle.myrrodin";
const MYR_SHEET = `${MYR}/sheet`;
const MYR_PARTY = `${MYR}/party`;
const MYR_ROLL = `${MYR}/roll`;
export const inOBR = OBR.isAvailable;
const PREVIEW = "myrrodin-crafting-preview";

export function whenReady() {
  if (!inOBR) return Promise.resolve();
  return new Promise((resolve) => OBR.onReady(resolve));
}
export async function me() {
  if (!inOBR) return { id: "preview", name: "Preview", role: new URLSearchParams(location.search).get("as") === "player" ? "PLAYER" : "GM" };
  const [id, name, role] = await Promise.all([OBR.player.getId(), OBR.player.getName(), OBR.player.getRole()]);
  return { id, name, role };
}
export const notify = (text, variant = "DEFAULT") => (inOBR ? OBR.notification.show(text, variant).catch(() => {}) : null);

// ---- Crafting records --------------------------------------------------------
const listeners = new Set();
function previewData() {
  try { const d = JSON.parse(localStorage.getItem(PREVIEW)); if (d) return d; } catch { /* ignore */ }
  const k = blankCrafter("Kayden");
  Object.assign(k, { notoriety: 751, fans: 2042, rp: 125, manual: { int: 4, dex: 2, wis: 1, pb: 4 } });
  k.prof = { divination: 3, mechanical: 3 }; k.rank = { divination: 3, mechanical: 3 }; k.succ = { divination: 5 };
  return { kayden: k };
}
export async function getAll() {
  if (!inOBR) return previewData();
  return (await OBR.room.getMetadata())[CHARS_KEY] || {};
}
export async function saveOne(id, rec) {
  const clean = normalizeCrafter(rec);
  clean.log = clean.log.slice(0, 12);
  if (!inOBR) {
    const all = previewData(); all[id] = clean;
    try { localStorage.setItem(PREVIEW, JSON.stringify(all)); } catch { /* ignore */ }
    listeners.forEach((f) => f(all)); return;
  }
  const all = await getAll();
  all[id] = clean;
  await OBR.room.setMetadata({ [CHARS_KEY]: all });
}
export async function removeOne(id) {
  const all = await getAll();
  delete all[id];
  if (!inOBR) { try { localStorage.setItem(PREVIEW, JSON.stringify(all)); } catch { /* ignore */ } listeners.forEach((f) => f(all)); return; }
  await OBR.room.setMetadata({ [CHARS_KEY]: all });
}
export function onChange(cb) {
  if (!inOBR) { listeners.add(cb); return () => listeners.delete(cb); }
  return OBR.room.onMetadataChange((meta) => cb(meta[CHARS_KEY] || {}));
}

// ---- Characters from the Myr'rodin System ---------------------------------------
const unpack = (z) => { try { return JSON.parse(strFromU8(inflateSync(Uint8Array.from(atob(z), (c) => c.charCodeAt(0))))); } catch { return null; } };
function statsFrom(sheet) {
  if (!sheet?.abilities) return null;
  return { int: abilityMod(sheet.abilities.int), dex: abilityMod(sheet.abilities.dex), wis: abilityMod(sheet.abilities.wis), pb: Number(sheet.profBonus) || 0 };
}

// Everyone who could craft: the Myr'rodin party, owned sheets on the map,
// and anyone the GM added by hand. Returns [{ id, name, owner, stats, from }]
export async function characters(records) {
  const out = new Map();
  if (inOBR) {
    let meta = {};
    try { meta = await OBR.room.getMetadata(); } catch { /* ignore */ }
    for (const m of Object.values(meta[MYR_PARTY]?.members || {})) {
      const sheet = m.z ? unpack(m.z) : null;
      out.set(m.id, { id: m.id, name: m.name, owner: m.ownerId || "", stats: statsFrom(sheet), from: "party" });
    }
    try {
      if (await OBR.scene.isReady()) {
        const items = await OBR.scene.items.getItems((i) => !!i.metadata?.[MYR_SHEET]);
        for (const i of items) {
          const s = i.metadata[MYR_SHEET];
          if (!s.ownerId && !s.partyId) continue;
          const id = s.partyId || `tok-${i.id}`;
          out.set(id, { id, name: s.name || out.get(id)?.name || "Character", owner: s.ownerId || out.get(id)?.owner || "", stats: statsFrom(s) || out.get(id)?.stats || null, from: "map" });
        }
      }
    } catch { /* no scene */ }
  }
  for (const [id, r] of Object.entries(records || {})) {
    if (!out.has(id)) out.set(id, { id, name: r.name, owner: r.owner || "", stats: null, from: "manual" });
    else if (!out.get(id).owner && r.owner) out.get(id).owner = r.owner;
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export async function players() {
  if (!inOBR) return [];
  try { return (await OBR.party.getPlayers()).map((p) => ({ id: p.id, name: p.name })); } catch { return []; }
}

// ---- Rolls show in the Myr'rodin roll log and dice animation (if it's on) ----------
export async function shareRoll(event) {
  if (!inOBR) return;
  await OBR.broadcast.sendMessage(MYR_ROLL, event, { destination: "ALL" }).catch(() => {});
}
