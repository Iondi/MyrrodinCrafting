// =====================================================================
//  Writing crafting back to the Craft Master Sheet (Google Sheets)
//  through the Apps Script in apps-script/Code.gs.
//  The link and password are saved in the GM's browser only.
// =====================================================================
import * as R from "./rules.js?v=1.5.0";

const PREF = "myrrodin-crafting-sheet";          // { url, key }
export const STATUS = "myrrodin-crafting-sheet-status";
const SENT = "myrrodin-crafting-sheet-sent";     // { id: json of last sent }
const LOGSEEN = "myrrodin-crafting-sheet-logseen"; // { id: newest log time sent }

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const sheetConfig = () => read(PREF, { url: "", key: "" });
export function setSheetConfig(url, key) {
  write(PREF, { url: String(url || "").trim(), key: String(key || "").trim() });
  // Only log what happens from now on.
  write(LOGSEEN, { "*": Date.now() });
}
export const sheetStatus = () => read(STATUS, null);
const setStatus = (s) => write(STATUS, { ...s, at: Date.now() });

async function call(body) {
  const { url, key } = sheetConfig();
  if (!url || !key) throw new Error("Not connected to the sheet yet.");
  // text/plain keeps the browser from asking Google for permission first.
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ key, ...body }) });
  const r = await res.json().catch(() => ({ ok: false, error: `The sheet answered ${res.status}.` }));
  if (!r.ok) throw new Error(r.error || "The sheet said no.");
  return r;
}
export const pingSheet = () => call({ action: "ping" });
export const readSheet = () => call({ action: "read" });

// Does this character use crafting yet? (Then they get a tab.)
export function usesCrafting(c) {
  if (!c) return false;
  const any = (o) => Object.values(o || {}).some((v) => Number(v) > 0);
  return any(c.prof) || any(c.rank) || any(c.succ) || any(c.mat) || Number(c.rp) > 0 || Number(c.notoriety) > 0 || Number(c.fans) > 0
    || Number(c.succBase) > 0 || (c.log || []).length > 0 || !!c.weekly;
}

// What goes on a character's tab.
export function tabData(c) {
  c = R.normalizeCrafter(c);
  const e = R.effects(c);
  const ranks = R.CATEGORIES.map((cat) => Number(c.rank[cat.key]) || 0);
  return {
    name: c.name,
    tiers: R.CATEGORIES.map((cat) => Number(c.prof[cat.key]) || 0),
    ranks: ranks.map((i) => R.RANKS[i].name),
    abilities: R.CATEGORIES.map((cat) => R.ABILITY_NAMES[cat.ability]),
    rp: Number(c.rp) || 0,
    successes: (Number(c.succBase) || 0) + Object.values(c.succ).reduce((t, n) => t + (Number(n) || 0), 0),
    materials: c.mat,
    craftingLevel: R.RANKS[Math.max(0, ...ranks)].name,
    notoriety: Number(c.notoriety) || 0,
    notorietyDie: e.notorietyDie.replace(/^1/, ""),
    fans: Number(c.fans) || 0,
    fansDie: Number(c.fansDie) || R.HOUSE.fansDieStart,
  };
}

// Send whatever changed since last time. `force` sends every crafter.
export async function syncNow(records, force = false) {
  const { url, key } = sheetConfig();
  if (!url || !key) return null;
  const sent = force ? {} : read(SENT, {});
  const seen = read(LOGSEEN, {});
  const characters = [], logs = [], nextSent = { ...sent }, nextSeen = { ...seen };
  for (const [id, raw] of Object.entries(records || {})) {
    const c = R.normalizeCrafter(raw);
    if (!usesCrafting(c)) continue;
    const data = tabData(c);
    const json = JSON.stringify(data);
    if (sent[id] !== json) { characters.push(data); nextSent[id] = json; }
    const since = seen[id] ?? seen["*"] ?? 0;
    const fresh = (c.log || []).filter((l) => Number(l.t) > since).sort((a, b) => a.t - b.t);
    fresh.forEach((l) => logs.push({ t: l.t, name: c.name, x: l.x }));
    if (fresh.length) nextSeen[id] = Math.max(...fresh.map((l) => Number(l.t)));
  }
  if (!characters.length && !logs.length) return { written: [], logged: 0 };
  try {
    const r = await call({ action: "sync", characters, logs });
    write(SENT, nextSent); write(LOGSEEN, nextSeen);
    setStatus({ ok: true, note: `${r.written.length ? `Updated ${r.written.map((w) => w.name + (w.created ? " (new tab)" : "")).join(", ")}` : ""}${r.written.length && r.logged ? " · " : ""}${r.logged ? `${r.logged} log line${r.logged === 1 ? "" : "s"}` : ""}` });
    return r;
  } catch (err) {
    setStatus({ ok: false, error: err?.message || String(err) });
    throw err;
  }
}

// Turn a tab read from the sheet into a crafting record (for importing).
export function recordFromTab(t, base) {
  const c = R.normalizeCrafter(base || R.blankCrafter(t.tab));
  const rankIndex = (name) => Math.max(0, R.RANKS.findIndex((r) => r.name.toLowerCase() === String(name || "").trim().toLowerCase()));
  R.CATEGORIES.forEach((cat, i) => {
    c.prof[cat.key] = Number(t.tiers?.[i]) || 0;
    c.rank[cat.key] = rankIndex(t.ranks?.[i]);
  });
  c.rp = Number(t.rp) || 0;
  c.notoriety = Number(t.notoriety) || 0;
  c.fans = Number(t.fans) || 0;
  if (Number(t.fansDie) > 0) c.fansDie = Number(t.fansDie);
  c.mat = { ...c.mat, ...(t.materials || {}) };
  c.succ = {};
  c.succBase = Number(t.successes) || 0;
  return c;
}
