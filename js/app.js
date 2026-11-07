// =====================================================================
//  MYR'RODIN CRAFTING — the panel
// =====================================================================
import * as S from "./store.js?v=1.0.1";
import * as R from "./rules.js?v=1.0.1";
import { roll } from "./dice.js?v=1.0.1";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
const num = (v) => Number(v) || 0;
const TAB_PREF = "myrrodin-crafting-tab", CHAR_PREF = "myrrodin-crafting-char";

const app = document.getElementById("app");
const charSel = document.getElementById("char");
let self = null, records = {}, chars = [], playersList = [];
let tab = localStorage.getItem(TAB_PREF) || "overview";
let current = localStorage.getItem(CHAR_PREF) || "";
let openCraft = "";      // category whose craft panel is open
let lastResult = null;   // { cat, text, ok }
let busy = false;

const isGM = () => self?.role === "GM";
const rec = () => R.normalizeCrafter(records[current] || { name: chars.find((c) => c.id === current)?.name || "" });
const charInfo = () => chars.find((c) => c.id === current);
const canAct = () => isGM() || (charInfo()?.owner || rec().owner) === self?.id;
const visibleChars = () => (isGM() ? chars : chars.filter((c) => c.owner === self.id));

// Roll bonuses: from the Myr'rodin sheet when there is one, otherwise typed in.
function stats() {
  const fromSheet = charInfo()?.stats;
  const m = fromSheet || rec().manual;
  const e = R.effects(rec());
  return { mods: { int: num(m.int), dex: num(m.dex), wis: num(m.wis) }, pb: num(m.pb) + e.pbBonus, fromSheet: !!fromSheet };
}
function craftBonus(cat) {
  const c = rec(), st = stats(), e = R.effects(c);
  const tier = num(c.prof[cat.key]);
  return st.mods[cat.ability] + st.pb * R.HOUSE.tierMultiplier[tier] + e.craftBonus;
}
const rankOf = (cat) => num(rec().rank[cat.key]);
const tierOf = (cat) => num(rec().prof[cat.key]);
const bestTier = () => Math.max(0, ...R.CATEGORIES.map(tierOf));
const highestRank = () => Math.max(0, ...R.CATEGORIES.map(rankOf));

async function save(mutate, note) {
  const c = rec();
  mutate(c);
  if (note) c.log = [{ t: Date.now(), x: note }, ...c.log].slice(0, 12);
  if (!c.name) c.name = charInfo()?.name || "Character";
  records[current] = c;
  render();
  await S.saveOne(current, c).catch((err) => S.notify(`Couldn't save: ${err?.message || err}`, "ERROR"));
}
function share(label, r) {
  S.shareRoll({ character: rec().name, player: self.name, label, total: r.total, detail: r.detail, crit: r.crit, fumble: r.fumble, hidden: false, dice: r.dice });
}

// ---- Pieces -------------------------------------------------------------------
const stat = (label, value, sub = "", cls = "") => `<div class="stat ${cls}"><span class="lbl">${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
const numInput = (path, value, label) => `<input type="number" class="num" data-path="${path}" value="${esc(value)}" aria-label="${esc(label)}" ${isGM() ? "" : "disabled"} />`;

function header() {
  const list = visibleChars();
  charSel.innerHTML = list.map((c) => `<option value="${esc(c.id)}" ${c.id === current ? "selected" : ""}>${esc(c.name)}</option>`).join("")
    + (isGM() ? `<option value="__add">+ Add a crafter…</option>` : "");
  charSel.hidden = !list.length && !isGM();
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
}

function overview() {
  const c = rec(), e = R.effects(c), st = stats();
  const next = (list, i) => list[i + 1];
  const nN = next(R.NOTORIETY, e.ni), nF = next(R.FANS, e.fi);
  return `
  <section class="card">
    <div class="grid3">
      ${stat("Crafting level", R.RANKS[highestRank()].name, `${R.TIERS[bestTier()]} at best`)}
      ${stat("Research Points", isGM() ? numInput("rp", c.rp, "Research Points") : c.rp, "spend to gather", "rp")}
      ${stat("Crafts made", Object.values(c.succ).reduce((t, n) => t + num(n), 0), "successful")}
    </div>
  </section>
  <section class="card">
    <div class="rank-row">
      <div><span class="lbl">Notoriety</span><div class="big">${isGM() ? numInput("notoriety", c.notoriety, "Notoriety") : c.notoriety}</div></div>
      <div class="rank-name"><b>${esc(e.notoriety.name)}</b><small class="${e.notoriety.penalty ? "bad" : ""}">${esc(e.notoriety.effect)}</small>${nN ? `<small class="faint">Next: ${esc(nN.name)} at ${nN.min}</small>` : ""}</div>
    </div>
    <div class="rank-row">
      <div><span class="lbl">Immortal Fans</span><div class="big">${isGM() ? numInput("fans", c.fans, "Immortal Fans") : c.fans.toLocaleString()}</div></div>
      <div class="rank-name"><b>${esc(e.fansTier.name)}</b><small class="${e.fansTier.penalty ? "bad" : ""}">${esc(e.fansTier.effect)}</small>${nF ? `<small class="faint">Next: ${esc(nF.name)} at ${nF.min.toLocaleString()}</small>` : ""}</div>
    </div>
    <div class="chips">
      <span class="chip">Notoriety die <b>${e.notorietyDie.slice(1)}</b></span>
      <span class="chip">Research die <b>${e.researchDie.slice(1)}</b></span>
      ${e.craftBonus ? `<span class="chip good">+${e.craftBonus} crafting</span>` : ""}
      ${e.pbBonus ? `<span class="chip good">+1 proficiency</span>` : ""}
      ${e.materialCostMultiplier > 1 ? `<span class="chip bad">Materials cost ×2</span>` : ""}
      ${e.freeUpToGrade ? `<span class="chip good">Grade A and under free</span>` : ""}
      ${e.notorietyMultiplier !== 1 ? `<span class="chip ${e.notorietyMultiplier < 1 ? "bad" : "good"}">Notoriety ×${e.notorietyMultiplier}</span>` : ""}
      ${e.researchMultiplier !== 1 ? `<span class="chip good">Research ×${e.researchMultiplier}</span>` : ""}
    </div>
  </section>
  <section class="card">
    <h3>Materials</h3>
    <div class="mats">${R.GRADES.map((g) => `<div class="mat g-${g.g}"><span>${g.g}</span><b>${isGM() ? numInput(`mat.${g.g}`, c.mat[g.g], `Grade ${g.g}`) : c.mat[g.g]}</b></div>`).join("")}</div>
  </section>
  <section class="card">
    <h3>Rolls with</h3>
    ${st.fromSheet
      ? `<p class="muted small">Int ${fmt(st.mods.int)} · Dex ${fmt(st.mods.dex)} · Wis ${fmt(st.mods.wis)} · Proficiency ${fmt(st.pb)} <span class="faint">(from the Myr'rodin sheet)</span></p>`
      : `<div class="manual">${["int", "dex", "wis", "pb"].map((k) => `<label><span>${k === "pb" ? "Prof" : k.toUpperCase()}</span><input type="number" class="num" data-path="manual.${k}" value="${esc(c.manual[k])}" ${canAct() ? "" : "disabled"} /></label>`).join("")}</div>
         <p class="muted small">No Myr'rodin sheet found for this character, so type their modifiers here.</p>`}
  </section>
  ${c.log.length ? `<section class="card"><h3>Recent</h3><ul class="log">${c.log.map((l) => `<li><small>${new Date(l.t).toLocaleDateString([], { month: "short", day: "numeric" })}</small> ${esc(l.x)}</li>`).join("")}</ul></section>` : ""}
  ${isGM() && current ? `<section class="card gm"><h3>GM</h3>
    <label class="row"><span>Player</span><select data-owner>${[`<option value="">— nobody —</option>`, ...playersList.map((p) => `<option value="${esc(p.id)}" ${(c.owner || charInfo()?.owner) === p.id ? "selected" : ""}>${esc(p.name)}</option>`)].join("")}</select></label>
    ${charInfo()?.from === "manual" ? `<button class="link danger" data-act="remove">${armed === "remove" ? "Click again to remove" : "Remove this crafter"}</button>` : ""}
  </section>` : ""}`;
}
let armed = "";
let adding = false;

function craftPanel(cat) {
  const c = rec(), r = rankOf(cat), tier = tierOf(cat), bonus = craftBonus(cat);
  const pick = Math.min(num(craftRank[cat.key] ?? r), r);
  const rank = R.RANKS[pick];
  const lacking = rank.mats ? Object.entries(rank.mats).filter(([g, n]) => num(c.mat[g]) < n) : (c.rp < rank.rp ? [["RP", rank.rp]] : []);
  const tooLow = tier < rank.need;
  const adv = tier === 3 && R.HOUSE.masteryRollsWithAdvantage;
  return `<div class="craft-panel">
    <div class="row"><label>Rank <select data-craftrank="${cat.key}">${R.RANKS.slice(0, r + 1).map((x, i) => `<option value="${i}" ${i === pick ? "selected" : ""}>${x.name} (DC ${x.dc})</option>`).join("")}</select></label>
      <span class="chip">d20 ${fmt(bonus)}${adv ? " · adv" : ""}</span></div>
    <p class="small">${rank.mats
      ? `Uses ${Object.entries(rank.mats).map(([g, n]) => `<b class="${num(c.mat[g]) < n ? "bad" : ""}">${n}× ${g}</b> <span class="faint">(have ${num(c.mat[g])})</span>`).join(", ")}`
      : `Costs <b class="${c.rp < rank.rp ? "bad" : ""}">${rank.rp} Research Points</b> <span class="faint">(have ${c.rp})</span>`}</p>
    <p class="small faint">${esc(rank.effect)}</p>
    ${tooLow ? `<p class="small bad">${rank.name} needs ${R.TIERS[rank.need]} in ${esc(cat.name)}.</p>` : ""}
    ${lacking.length && !tooLow ? `<p class="small bad">Not enough materials. Gather them first.</p>` : ""}
    <button class="primary" data-act="craft" data-cat="${cat.key}" ${tooLow || lacking.length || busy || !canAct() ? "disabled" : ""}>⚒ Craft — roll vs DC ${rank.dc}</button>
    ${lastResult?.cat === cat.key ? `<div class="result ${lastResult.ok ? "ok" : "fail"}">${lastResult.html}</div>` : ""}
  </div>`;
}
const craftRank = {};

function craftTab() {
  const c = rec();
  const groups = [...new Set(R.CATEGORIES.map((x) => x.group))];
  return `<p class="muted small pad">Pick what to make. ${isGM() ? "Set each proficiency and rank here (players can't change them)." : ""}</p>
  ${groups.map((g) => `<section class="card cats"><h3>${esc(g)}</h3>${R.CATEGORIES.filter((x) => x.group === g).map((cat) => {
    const tier = tierOf(cat), r = rankOf(cat), s = num(c.succ[cat.key]);
    return `<div class="cat ${openCraft === cat.key ? "open" : ""} ${tier ? "has" : ""}">
      <div class="cat-row">
        <button class="cat-name" data-act="toggle" data-cat="${cat.key}"><b>${esc(cat.name)}</b><small>${cat.ability.toUpperCase()} · ${fmt(craftBonus(cat))}${s ? ` · ${s} made` : ""}</small></button>
        ${isGM()
          ? `<select data-prof="${cat.key}" title="Proficiency">${R.TIERS.map((t, i) => `<option value="${i}" ${i === tier ? "selected" : ""}>${t === "None" ? "—" : t}</option>`).join("")}</select>
             <select data-rank="${cat.key}" title="Crafting rank">${R.RANKS.map((x, i) => `<option value="${i}" ${i === r ? "selected" : ""}>${x.name}</option>`).join("")}</select>`
          : `<span class="tag">${tier ? R.TIERS[tier] : "—"}</span><span class="tag rank">${R.RANKS[r].name}</span>`}
      </div>
      ${openCraft === cat.key ? craftPanel(cat) : ""}
    </div>`;
  }).join("")}</section>`).join("")}`;
}

function gatherTab() {
  const c = rec(), e = R.effects(c), best = bestTier();
  return `<section class="card">
    <div class="row"><h3>Gather materials</h3><span class="chip">${c.rp} Research Points</span></div>
    <p class="muted small">Spend Research Points to collect materials. Better grades need a higher proficiency (your best is <b>${R.TIERS[best]}</b>).
      ${e.materialCostMultiplier > 1 ? `<br><span class="bad">Cause for Concern: materials cost double.</span>` : ""}
      ${e.freeUpToGrade ? `<br><span class="good">Nobility: Grade A and under are free.</span>` : ""}</p>
    <table class="gather"><thead><tr><th>Grade</th><th>Cost</th><th>Have</th><th></th></tr></thead><tbody>
    ${R.GRADES.map((g) => {
      const each = R.gatherCost(c, g.g, 1);
      const locked = best < g.need;
      return `<tr class="${locked ? "locked" : ""}">
        <td><span class="gem g-${g.g}">${g.g}</span></td>
        <td>${each === 0 ? `<b class="good">free</b>` : `${each} RP`}${locked ? `<br><small class="faint">needs ${R.TIERS[g.need]}</small>` : ""}</td>
        <td>${num(c.mat[g.g])}</td>
        <td class="buy">${locked ? "" : `<input type="number" min="1" value="1" class="num qty" data-qty="${g.g}" aria-label="How many" /><button class="small" data-act="gather" data-grade="${g.g}" ${canAct() ? "" : "disabled"}>Collect</button>`}</td>
      </tr>`;
    }).join("")}</tbody></table>
  </section>`;
}

function weeklyTab() {
  const c = rec(), e = R.effects(c), w = c.weekly;
  if (!w || w.applied) {
    return `<section class="card center">
      <h3>Weekly roll</h3>
      <p class="muted small">Roll ${R.HOUSE.weeklyDice} and split the total between Immortal Fans, Notoriety and Research Points.</p>
      <button class="primary big-btn" data-act="weekly" ${canAct() && !busy ? "" : "disabled"}>🎲 Roll ${R.HOUSE.weeklyDice}</button>
      ${w?.applied ? `<p class="small faint">Last week: ${w.total} (${new Date(w.at).toLocaleDateString()})</p>` : ""}
    </section>`;
  }
  const v = weeklySplit[current] || { fans: 0, notoriety: 0, rp: 0 };
  const used = num(v.fans) + num(v.notoriety) + num(v.rp), left = w.total - used;
  const gainN = Math.floor(num(v.notoriety) * e.notorietyMultiplier), gainR = Math.floor(num(v.rp) * e.researchMultiplier);
  return `<section class="card">
    <div class="row"><h3>This week: ${w.total}</h3><small class="faint">${esc(w.detail || "")}</small></div>
    <p class="muted small">Split it any way you like. ${left === 0 ? `<b class="good">All ${w.total} assigned.</b>` : `<b class="${left < 0 ? "bad" : ""}">${left} left to assign.</b>`}</p>
    <div class="split">
      <label><span>Immortal Fans</span><input type="number" min="0" class="num" data-split="fans" value="${esc(v.fans)}" /><small>+${num(v.fans)} fans</small></label>
      <label><span>Notoriety</span><input type="number" min="0" class="num" data-split="notoriety" value="${esc(v.notoriety)}" /><small>+${gainN}${e.notorietyMultiplier !== 1 ? ` (×${e.notorietyMultiplier})` : ""}</small></label>
      <label><span>Research Points</span><input type="number" min="0" class="num" data-split="rp" value="${esc(v.rp)}" /><small>+${gainR}${e.researchMultiplier !== 1 ? ` (×${e.researchMultiplier})` : ""}</small></label>
    </div>
    <button class="primary" data-act="applyweek" ${left === 0 && canAct() ? "" : "disabled"}>Apply</button>
    ${isGM() ? `<button class="link small" data-act="reroll">Throw this roll away</button>` : ""}
  </section>`;
}
const weeklySplit = {};

function rulesTab() {
  return `<section class="card"><h3>Crafting ranks</h3><table class="ref"><thead><tr><th>Rank</th><th>DC</th><th>Needs</th><th>Materials</th></tr></thead><tbody>
    ${R.RANKS.map((r) => `<tr><td><b>${r.name}</b><br><small class="faint">${esc(r.effect)}</small></td><td>${r.dc}</td><td>${r.need ? R.TIERS[r.need] : "Everyone"}</td><td>${r.mats ? Object.entries(r.mats).map(([g, n]) => `${n}×${g}`).join(" ") : `${r.rp} RP`}<br><small class="faint">${R.rankValue(r)} RP worth</small></td></tr>`).join("")}
  </tbody></table></section>
  <section class="card"><h3>Materials</h3><table class="ref"><thead><tr><th>Grade</th><th>RP</th><th>To collect</th></tr></thead><tbody>
    ${R.GRADES.map((g) => `<tr><td><span class="gem g-${g.g}">${g.g}</span></td><td>${g.rp}</td><td>${g.need ? R.TIERS[g.need] : "Everyone"}</td></tr>`).join("")}
  </tbody></table></section>
  <section class="card"><h3>Notoriety</h3><table class="ref"><tbody>${R.NOTORIETY.map((n, i) => `<tr><td><b>${n.name}</b></td><td>${n.min}${R.NOTORIETY[i + 1] ? `–${R.NOTORIETY[i + 1].min - 1}` : "+"}</td><td><small>${n.effect}</small></td></tr>`).join("")}</tbody></table></section>
  <section class="card"><h3>Immortal Fans</h3><table class="ref"><tbody>${R.FANS.map((n, i) => `<tr><td><b>${n.name}</b></td><td>${n.min.toLocaleString()}${R.FANS[i + 1] ? `–${(R.FANS[i + 1].min - 1).toLocaleString()}` : "+"}</td><td><small>${n.effect}</small></td></tr>`).join("")}</tbody></table></section>
  <section class="card"><h3>How rolls work</h3><ul class="small">
    <li><b>Craft:</b> d20 + the category's ability modifier + proficiency bonus (×1 Proficient, ×2 Expertise, ×2 and advantage for Mastery) against the rank's DC.</li>
    <li>A success uses the materials, counts toward that category, and rolls the <b>Notoriety die</b> and <b>Research die</b> for extra Notoriety and Research Points.</li>
    <li>A failure keeps the materials.</li>
    <li><b>Weekly:</b> ${R.HOUSE.weeklyDice}, split between Fans, Notoriety and Research Points.</li>
    <li>Penalties (Cause for Concern, Wild Sheep Chase, Tier I) only apply in that rank; bonuses carry into every rank above.</li>
  </ul></section>`;
}

function render() {
  if (!self) return;
  header();
  if (adding) {
    app.innerHTML = `<section class="card"><h3>Add a crafter</h3>
      <p class="muted small">For anyone who isn't in the Myr'rodin party, like an NPC crafter. Party characters show up by themselves.</p>
      <div class="row"><input id="add-name" placeholder="Name, e.g. Kayden" /><button class="primary" data-act="add">Add</button><button class="link" data-act="canceladd">Cancel</button></div></section>`;
    return;
  }
  if (!current && tab !== "rules") {
    app.innerHTML = isGM()
      ? `<div class="empty"><p><b>No crafters yet.</b></p><p class="muted small">Characters from the Myr'rodin party show up here automatically. Or pick <b>+ Add a crafter</b> at the top.</p></div>`
      : `<div class="empty"><p><b>No character yet.</b></p><p class="muted small">Once the GM gives you a Myr'rodin character sheet, your crafting shows up here.</p></div>`;
    return;
  }
  app.innerHTML = tab === "craft" ? craftTab() : tab === "gather" ? gatherTab() : tab === "weekly" ? weeklyTab() : tab === "rules" ? rulesTab() : overview();
}

// ---- Actions --------------------------------------------------------------------
async function doCraft(key) {
  const cat = R.CATEGORIES.find((x) => x.key === key);
  const c = rec(), e = R.effects(c);
  const pick = Math.min(num(craftRank[key] ?? rankOf(cat)), rankOf(cat));
  const rank = R.RANKS[pick];
  const bonus = craftBonus(cat);
  const adv = tierOf(cat) === 3 && R.HOUSE.masteryRollsWithAdvantage;
  busy = true;
  const r = roll(`1d20${bonus ? (bonus > 0 ? `+${bonus}` : bonus) : ""}`, { advantage: adv });
  const ok = r.total >= rank.dc;
  share(`Craft ${cat.name} (${rank.name}, DC ${rank.dc})`, r);
  let html = `<b>${r.total}</b> vs DC ${rank.dc} — ${ok ? "Success!" : "Failed."} <small class="faint">${esc(r.detail)}</small>`;
  let gainN = 0, gainR = 0;
  if (ok) {
    if (R.HOUSE.successRollsNotoriety) { const n = roll(e.notorietyDie); gainN = Math.floor(n.total * e.notorietyMultiplier); }
    if (R.HOUSE.successRollsResearch) { const q = roll(e.researchDie); gainR = Math.floor(q.total * e.researchMultiplier); }
    html += `<br>+${gainN} Notoriety · +${gainR} Research Points`;
  }
  lastResult = { cat: key, ok, html };
  await save((x) => {
    if (ok || R.HOUSE.materialsLostOnFail) {
      if (rank.mats) Object.entries(rank.mats).forEach(([g, n]) => { x.mat[g] = num(x.mat[g]) - n; });
      else x.rp -= rank.rp;
    }
    if (ok) { x.succ[key] = num(x.succ[key]) + 1; x.notoriety = num(x.notoriety) + gainN; x.rp = num(x.rp) + gainR; }
  }, `${ok ? "Crafted" : "Failed to craft"} ${cat.name} (${rank.name}): rolled ${r.total} vs ${rank.dc}${ok ? `, +${gainN} notoriety, +${gainR} RP` : ""}`);
  busy = false; render();
}

async function doGather(grade) {
  const c = rec();
  const qty = Math.max(1, num(app.querySelector(`[data-qty="${grade}"]`)?.value));
  const cost = R.gatherCost(c, grade, qty);
  if (cost > c.rp) { S.notify(`That needs ${cost} Research Points; you have ${c.rp}.`, "WARNING"); return; }
  await save((x) => { x.rp = num(x.rp) - cost; x.mat[grade] = num(x.mat[grade]) + qty; }, `Collected ${qty}× Grade ${grade} for ${cost} RP`);
  S.notify(`Collected ${qty}× Grade ${grade}${cost ? ` (−${cost} RP)` : ""}.`, "SUCCESS");
}

async function doWeekly() {
  busy = true;
  const r = roll(R.HOUSE.weeklyDice);
  share("Weekly crafting roll", r);
  weeklySplit[current] = { fans: 0, notoriety: 0, rp: 0 };
  await save((x) => { x.weekly = { total: r.total, detail: r.detail, at: Date.now(), applied: false }; }, `Weekly roll: ${r.total}`);
  busy = false; render();
}
async function applyWeek() {
  const c = rec(), e = R.effects(c), v = weeklySplit[current] || {};
  const f = num(v.fans), n = Math.floor(num(v.notoriety) * e.notorietyMultiplier), q = Math.floor(num(v.rp) * e.researchMultiplier);
  await save((x) => { x.fans = num(x.fans) + f; x.notoriety = num(x.notoriety) + n; x.rp = num(x.rp) + q; x.weekly = { ...x.weekly, applied: true }; },
    `Weekly: +${f} fans, +${n} notoriety, +${q} RP`);
  S.notify(`Applied: +${f} fans, +${n} notoriety, +${q} Research Points.`, "SUCCESS");
}

// ---- Events ----------------------------------------------------------------------
document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  tab = b.dataset.tab; try { localStorage.setItem(TAB_PREF, tab); } catch { /* ignore */ }
  render(); window.scrollTo(0, 0);
});
charSel.addEventListener("change", async () => {
  if (charSel.value === "__add") { adding = true; render(); app.querySelector("#add-name")?.focus(); return; }
  adding = false;
  current = charSel.value;
  try { localStorage.setItem(CHAR_PREF, current); } catch { /* ignore */ }
  openCraft = ""; lastResult = null; render();
});
app.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
  const a = b.dataset.act;
  if (a !== "remove") armed = "";
  if (a === "add") {
    const name = (app.querySelector("#add-name")?.value || "").trim();
    if (!name) return;
    const id = `c-${Math.random().toString(36).slice(2, 9)}`;
    current = id; records[id] = R.blankCrafter(name); adding = false;
    try { localStorage.setItem(CHAR_PREF, current); } catch { /* ignore */ }
    await S.saveOne(id, records[id]);
    chars = await S.characters(records); render();
  }
  if (a === "canceladd") { adding = false; render(); }
  if (a === "toggle") { openCraft = openCraft === b.dataset.cat ? "" : b.dataset.cat; lastResult = null; render(); }
  if (a === "craft") doCraft(b.dataset.cat);
  if (a === "gather") doGather(b.dataset.grade);
  if (a === "weekly") doWeekly();
  if (a === "applyweek") applyWeek();
  if (a === "reroll") save((x) => { x.weekly = null; }, "Weekly roll thrown away by the GM");
  if (a === "remove") {
    if (armed !== "remove") { armed = "remove"; render(); return; }
    armed = ""; await S.removeOne(current); delete records[current]; current = ""; chars = await S.characters(records); pickDefault(); render();
  }
});
app.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.path) {
    const [k, sub] = t.dataset.path.split(".");
    save((x) => { if (sub) x[k] = { ...x[k], [sub]: num(t.value) }; else x[k] = num(t.value); });
  }
  if (t.dataset.prof) save((x) => { x.prof = { ...x.prof, [t.dataset.prof]: num(t.value) }; });
  if (t.dataset.rank) save((x) => { x.rank = { ...x.rank, [t.dataset.rank]: num(t.value) }; });
  if (t.dataset.craftrank) { craftRank[t.dataset.craftrank] = num(t.value); render(); }
  if (t.hasAttribute("data-owner")) save((x) => { x.owner = t.value; });
});
app.addEventListener("keydown", (e) => { if (e.target.id === "add-name" && e.key === "Enter") app.querySelector('[data-act="add"]')?.click(); });
app.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.split) {
    weeklySplit[current] = { ...(weeklySplit[current] || { fans: 0, notoriety: 0, rp: 0 }), [t.dataset.split]: Math.max(0, num(t.value)) };
    const pos = t.selectionStart; const key = t.dataset.split;
    render();
    const again = app.querySelector(`[data-split="${key}"]`); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* number inputs */ } }
  }
});

function pickDefault() {
  const list = visibleChars();
  if (!list.some((c) => c.id === current)) current = list[0]?.id || "";
}

// ---- Start ------------------------------------------------------------------------
(async () => {
  await S.whenReady();
  self = await S.me();
  document.getElementById("who").textContent = isGM() ? "GM view" : self.name;
  records = await S.getAll().catch(() => ({}));
  chars = await S.characters(records);
  playersList = await S.players();
  pickDefault();
  render();
  S.onChange(async (all) => { records = all; chars = await S.characters(records); pickDefault(); render(); });
  if (S.inOBR) {
    S.OBR.party.onChange(async () => { playersList = await S.players(); render(); });
    S.OBR.scene.onReadyChange(async () => { chars = await S.characters(records); pickDefault(); render(); });
    // Phones: fit the panel to the screen so it scrolls.
    if (Math.min(screen.width, screen.height) < 600 || /Android|iPhone|iPod/i.test(navigator.userAgent)) {
      S.OBR.action.setHeight(Math.max(320, Math.min(640, Math.round(screen.height * 0.68)))).catch(() => {});
    }
  }
})();
