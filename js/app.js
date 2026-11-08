// =====================================================================
//  MYR'RODIN CRAFTING — the panel
// =====================================================================
import * as S from "./store.js?v=1.5.0";
import * as R from "./rules.js?v=1.5.0";
import { roll } from "./dice.js?v=1.5.0";
import * as Sheet from "./sheetsync.js?v=1.5.0";

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
      ${stat("Crafts made", num(c.succBase) + Object.values(c.succ).reduce((t, n) => t + num(n), 0), "successful")}
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
      <span class="chip">Fans die <b>d${isGM() ? `</b><input type="number" class="num tiny" min="2" step="2" data-path="fansDie" value="${esc(c.fansDie || R.HOUSE.fansDieStart)}" aria-label="Fans die" />` : `${c.fansDie || R.HOUSE.fansDieStart}</b>`}</span>
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
  </section>` : ""}
  ${isGM() ? sheetCard() : ""}`;
}

// GM: the Craft Master Sheet connection.
let sheetEditing = false, sheetMsg = "", sheetBusy = false;
function sheetCard() {
  const cfg = Sheet.sheetConfig(), st = Sheet.sheetStatus();
  if (!cfg.url || sheetEditing) {
    return `<section class="card gm sheet-card"><h3>📗 Google Sheet</h3>
      <p class="muted small">Keeps a tab for each crafting character on your Craft Master Sheet, and adds every roll to a "Crafting Log" tab. Set up the script first (see the README), then paste its Web app link and SECRET here. Saved in this browser only.</p>
      <label class="field"><span>Web app link</span><input id="sh-url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(cfg.url)}" /></label>
      <label class="field"><span>SECRET</span><input id="sh-key" type="password" value="${esc(cfg.key)}" /></label>
      <div class="row"><button class="primary small" data-act="sheetconnect" ${sheetBusy ? "disabled" : ""}>Connect</button>${cfg.url ? `<button class="link small" data-act="sheetcancel">Cancel</button>` : ""}<small class="${sheetMsg.startsWith("✓") ? "good" : "bad"}">${esc(sheetMsg)}</small></div>
    </section>`;
  }
  const ago = st ? Math.round((Date.now() - st.at) / 60000) : null;
  return `<section class="card gm sheet-card"><div class="row"><h3>📗 Google Sheet</h3><button class="link small" data-act="sheetedit">Change</button></div>
    <p class="small ${st && !st.ok ? "bad" : "muted"}">${st ? (st.ok ? `✓ ${esc(st.note || "Up to date")} · ${ago < 1 ? "just now" : `${ago} min ago`}` : `⚠ ${esc(st.error)}`) : "Connected. Changes are written to the sheet a few seconds after they happen."}</p>
    <div class="row left">
      <button class="small" data-act="sheetsync" ${sheetBusy ? "disabled" : ""}>⟳ Write everyone now</button>
      <button class="small" data-act="sheetimport" ${sheetBusy ? "disabled" : ""}>${armed === "sheetimport" ? "Click again: load the sheet's numbers" : "⇩ Load tabs from the sheet"}</button>
    </div>
    ${sheetMsg ? `<p class="small ${sheetMsg.startsWith("✓") ? "good" : "bad"}">${esc(sheetMsg)}</p>` : ""}
    <p class="faint small">"Load" brings each tab's numbers into Owlbear (for characters like Kayden and Elisio). Matching characters are replaced; new ones are added as crafters.</p>
  </section>`;
}
async function sheetAction(a) {
  if (a === "sheetedit") { sheetEditing = true; sheetMsg = ""; render(); return; }
  if (a === "sheetcancel") { sheetEditing = false; sheetMsg = ""; render(); return; }
  if (a === "sheetconnect") {
    const url = app.querySelector("#sh-url").value.trim(), key = app.querySelector("#sh-key").value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { sheetMsg = "That should be the Web app link from Apps Script (https://script.google.com/macros/s/…/exec)."; render(); return; }
    if (!key) { sheetMsg = "Type the SECRET from the script."; render(); return; }
    Sheet.setSheetConfig(url, key);
    sheetEditing = true; sheetBusy = true; sheetMsg = "Checking…"; render();
    try { const r = await Sheet.pingSheet(); sheetMsg = `✓ Connected to "${r.title}". Character tabs found: ${r.tabs.join(", ") || "none"}.`; sheetEditing = false; }
    catch (err) { sheetMsg = /fetch/i.test(err?.message || "") ? "Couldn't reach that link. Check it, and that the script is deployed for Anyone." : (err?.message || "Couldn't connect."); }
    sheetBusy = false; render(); return;
  }
  if (a === "sheetsync") {
    sheetBusy = true; render();
    try { const r = await Sheet.syncNow(records, true); sheetMsg = r ? `✓ Wrote ${r.written?.length || 0} character tab${r.written?.length === 1 ? "" : "s"}${r.logged ? ` and ${r.logged} log lines` : ""}.` : "Nobody uses crafting yet."; }
    catch (err) { sheetMsg = err?.message || "Couldn't write to the sheet."; }
    sheetBusy = false; render(); return;
  }
  if (a === "sheetimport") {
    if (armed !== "sheetimport") { armed = "sheetimport"; render(); return; }
    armed = ""; sheetBusy = true; sheetMsg = "Reading the sheet…"; render();
    try {
      const { characters: tabs } = await Sheet.readSheet();
      const squash = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const done = [];
      for (const t of tabs) {
        const match = chars.find((ch) => squash(ch.name) === squash(t.tab));
        const id = match?.id || `c-${squash(t.tab) || Math.random().toString(36).slice(2, 9)}`;
        const base = records[id] || R.blankCrafter(match?.name || t.tab);
        const rec2 = Sheet.recordFromTab(t, base);
        rec2.name = match?.name || base.name || t.tab;
        records[id] = rec2;
        await S.saveOne(id, rec2);
        done.push(rec2.name);
      }
      chars = await S.characters(records);
      sheetMsg = `✓ Loaded ${done.join(", ") || "nothing"} from the sheet.`;
    } catch (err) { sheetMsg = err?.message || "Couldn't read the sheet."; }
    sheetBusy = false; render(); return;
  }
}
let armed = "";
let showMath = false; // GM: the "how was this worked out" window
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

// Weekly: choose how many of the 7d100 go to each pool FIRST, then roll.
const POOLS = [["fans", "Immortal Fans"], ["notoriety", "Notoriety"], ["rp", "Research Points"]];
const weeklyPlan = {}; // character id -> { fans, notoriety, rp }
// GM can make the next roll cover two weeks (twice the dice).
const weeksFor = () => (num(rec().weeks) === 2 ? 2 : 1);
const totalWeeklyDice = () => (Number(String(R.HOUSE.weeklyDice).split("d")[0]) || 7) * weeksFor();
const weeklyExpr = () => `${totalWeeklyDice()}d100`;
const planFor = () => {
  const p = weeklyPlan[current];
  if (p && p.fans + p.notoriety + p.rp <= totalWeeklyDice() && p.n === totalWeeklyDice()) return p;
  return (weeklyPlan[current] = { fans: totalWeeklyDice(), notoriety: 0, rp: 0, n: totalWeeklyDice() });
};

function weeklyTab() {
  const c = rec(), e = R.effects(c), w = c.weekly;
  const die = c.fansDie || R.HOUSE.fansDieStart;
  const plan = planFor(), n = totalWeeklyDice();
  const left = n - plan.fans - plan.notoriety - plan.rp;
  // One weekly roll per character until the GM starts the next week.
  const locked = !!(w?.applied && !w.nextWeek);
  const last = w?.applied && w.rolls ? `<section class="card">
      <div class="row"><h3>Last weekly roll${w.weeks === 2 ? " (2 weeks)" : ""}</h3><small class="faint">${new Date(w.at).toLocaleDateString()}</small></div>
      ${POOLS.map(([k, label]) => w.rolls[k]?.length ? `<div class="wres"><span class="lbl">${label}</span>
        <div class="wvals">${w.rolls[k].map((v) => `<span class="${k === "fans" && v >= R.HOUSE.fansGrowAt ? "hot" : ""}">${v}</span>`).join("")}</div>
        <b>${k === "fans" ? `+${w.gain.fans}${w.fansExpr ? ` <small class="faint">${esc(w.fansExpr)}</small>` : " <small class=\"faint\">no dice of 50+</small>"}` : `+${w.gain[k]}`}</b></div>` : "").join("")}
      ${w.dieFrom !== w.dieTo ? `<p class="small good">Fans die grew: d${w.dieFrom} → d${w.dieTo}</p>` : ""}
      ${isGM() ? `<button class="small" data-act="math">🧮 Show the math</button>` : ""}
      ${isGM() && !w.undone ? `<div class="gm-reset">
        <button class="small danger-btn" data-act="undoweek">${armed === "undoweek" ? "Click again to undo it" : "↺ Undo this roll"}</button>
        <small class="faint">Takes back the +${w.gain.fans} fans, +${w.gain.notoriety} notoriety and +${w.gain.rp} RP${w.dieFrom !== w.dieTo ? `, puts the Fans die back to d${w.dieFrom}` : ""}, and lets them roll again. GM only.</small>
      </div>` : ""}
    </section>` : "";
  return `<section class="card">
    <h3>Weekly roll</h3>
    <p class="muted small">First choose how many of the ${n} dice go to each, then roll. Fans die: <b>d${die}</b>.</p>
    <div class="wplan">${POOLS.map(([k, label]) => `<div class="wpool">
      <span>${label}${k === "notoriety" ? ` <small class="faint">${e.notorietyDie.replace(/^1/, "")} each${e.notorietyMultiplier !== 1 ? ` · ×${e.notorietyMultiplier}` : ""}</small>` : ""}${k === "rp" ? ` <small class="faint">${e.researchDie.replace(/^1/, "")} each${e.researchMultiplier !== 1 ? ` · ×${e.researchMultiplier}` : ""}${e.noHighRollBonus ? " · no 90+ bonus" : ""}</small>` : ""}</span>
      <div class="step"><button data-act="plan" data-pool="${k}" data-d="-1" ${plan[k] <= 0 ? "disabled" : ""}>−</button><b>${plan[k]}</b><button data-act="plan" data-pool="${k}" data-d="1" ${left <= 0 ? "disabled" : ""}>+</button></div>
    </div>`).join("")}</div>
    <p class="small ${left ? "bad" : "good"}">${left ? `${left} ${left === 1 ? "die" : "dice"} left to assign.` : `All ${n} dice assigned.`}</p>
    ${locked ? `<p class="small muted">✓ This week's roll is done. ${isGM() ? "" : "The GM starts the next week."}</p>` : ""}
    <button class="primary big-btn" data-act="weekly" ${left === 0 && canAct() && !busy && (!locked || isGM()) ? "" : "disabled"}>🎲 Roll ${weeklyExpr()}${weeksFor() === 2 ? " (2 weeks)" : ""}</button>
    ${isGM() && locked ? `<button class="link small" data-act="nextweek">Start the next week (let them roll again)</button>` : ""}
    ${isGM() ? `<button class="link small" data-act="nextweekall">${armed === "nextweekall" ? "Click again: new week for everyone" : "New week for everyone"}</button>` : ""}
    ${isGM() ? `<label class="chk gm-only" title="Only you see this"><input type="checkbox" data-weeks ${weeksFor() === 2 ? "checked" : ""} /> <span>Two weeks: next roll is ${(Number(String(R.HOUSE.weeklyDice).split("d")[0]) || 7) * 2}d100 <small class="faint">(GM only · goes back to one week after the roll)</small></span></label>` : ""}
    <details class="small muted"><summary>How Immortal Fans are worked out</summary>
      <p>Each d100 for Fans is worth Fans dice: under 50 nothing, 50s 1, 60s 2, 70s 3, 80s 4, 90s 5, a natural 100 gives 10. A 90 or more makes the Fans die 2 sides bigger straight away: its own dice and every one after it use the bigger die (d2: 71 63 92 88 15 82 71 → 5d2 + 16d4). Notoriety: each d100 over 50 gives 1 Notoriety die, 90 or more gives 2; the Notoriety die comes from the Fans tier (d4, d6 from Tier III, d10 from Tier VIII), then Tier I halves it and Tier IV+ doubles it. Research Points work the same way, with the Research die from the Notoriety rank (d4, d6 from The Litching Hour, d10 from Executive); Wild Sheep Chase cancels the 90+ bonus and Fans Tier VI+ doubles it.</p>
    </details>
  </section>${last}`;
}

function mathWindow() {
  const c = rec(), w = c.weekly;
  if (!showMath || !isGM() || !w?.rolls) return "";
  const steps = R.explainFans(w.rolls.fans || [], w.dieFrom || R.HOUSE.fansDieStart);
  const sum = (a) => (a || []).reduce((t, v) => t + v, 0);
  const mult = w.mult || { n: 1, r: 1 };
  const plan = w.plan || {};
  return `<div class="math-back" data-act="closemath"></div>
  <div class="math" role="dialog" aria-label="How this roll was worked out">
    <div class="row"><h3>🧮 The math <small class="faint">GM only</small></h3><button class="link" data-act="closemath" aria-label="Close">✕</button></div>
    <p class="small muted">${esc(c.name)} · ${w.weeks === 2 ? "two weeks, " : ""}${num(plan.fans)} for Fans, ${num(plan.notoriety)} for Notoriety, ${num(plan.rp)} for Research · Fans die started at <b>d${w.dieFrom || R.HOUSE.fansDieStart}</b></p>
    ${steps.length ? `<h4>Immortal Fans</h4>
    <table class="ref math-t"><thead><tr><th>d100</th><th>What it does</th><th>Fans dice so far</th></tr></thead><tbody>
      ${steps.map((st) => `<tr class="${st.grew ? "grew" : ""} ${st.n ? "" : "none"}"><td><b>${st.v}</b></td><td>${st.grew ? `<span class="good">die grows d${st.grew.from} → d${st.grew.to}</span><br>` : ""}${esc(st.why)}${st.n ? ` <small class="faint">(d${st.size})</small>` : ""}</td><td>${esc(st.sofar)}</td></tr>`).join("")}
    </tbody></table>
    <p class="small">Rolled <b>${esc(w.fansExpr || "nothing")}</b>${w.fansDetail ? `: <span class="faint">${esc(w.fansDetail)}</span>` : ""}<br>= <b class="good">+${num(w.gain?.fans)} Immortal Fans</b>${w.dieFrom !== w.dieTo ? ` · Fans die is now <b>d${w.dieTo}</b>` : ""}</p>` : ""}
    ${(w.rolls.notoriety || []).length ? (w.nDie ? `<h4>Notoriety <small class="faint">(Notoriety die ${esc(w.nDie)}, from the Fans tier)</small></h4>
      <table class="ref math-t"><tbody>${w.rolls.notoriety.map((v) => { const k = R.notorietyDiceFor(v); return `<tr class="${k ? "" : "none"}"><td><b>${v}</b></td><td>${v >= 90 ? `90 or more → 2${esc(w.nDie)}` : v > 50 ? `over 50 → 1${esc(w.nDie)}` : "50 or under → nothing"}</td></tr>`; }).join("")}</tbody></table>
      <p class="small">Rolled <b>${esc(w.notorietyExpr || "nothing")}</b>${w.notorietyDetail ? `: <span class="faint">${esc(w.notorietyDetail)}</span>` : ""} = ${num(w.nRolled)}${mult.n !== 1 ? ` × ${mult.n} (${mult.n < 1 ? "Fans Tier I halves it" : "Fans Tier IV+ doubles it"})` : ""} = <b class="good">+${num(w.gain?.notoriety)} Notoriety</b></p>`
      : `<h4>Notoriety</h4><p class="small">${w.rolls.notoriety.join(" + ")} = ${sum(w.rolls.notoriety)}${mult.n !== 1 ? ` × ${mult.n}` : ""} = <b class="good">+${num(w.gain?.notoriety)}</b> <span class="faint">(old rule)</span></p>`) : ""}
    ${(w.rolls.rp || []).length ? (w.rDie ? `<h4>Research Points <small class="faint">(Research die ${esc(w.rDie)}, from the Notoriety rank)</small></h4>
      <table class="ref math-t"><tbody>${w.rolls.rp.map((v) => { const k = R.researchDiceFor(v, w.wildSheep); return `<tr class="${k ? "" : "none"}"><td><b>${v}</b></td><td>${v >= 90 ? (w.wildSheep ? `90 or more → 1${esc(w.rDie)} <span class="bad">(Wild Sheep Chase: no 90+ bonus)</span>` : `90 or more → 2${esc(w.rDie)}`) : v > 50 ? `over 50 → 1${esc(w.rDie)}` : "50 or under → nothing"}</td></tr>`; }).join("")}</tbody></table>
      <p class="small">Rolled <b>${esc(w.researchExpr || "nothing")}</b>${w.researchDetail ? `: <span class="faint">${esc(w.researchDetail)}</span>` : ""} = ${num(w.rRolled)}${mult.r !== 1 ? ` × ${mult.r} (Fans Tier VI+ doubles it)` : ""} = <b class="good">+${num(w.gain?.rp)} Research Points</b></p>`
      : `<h4>Research Points</h4><p class="small">${w.rolls.rp.join(" + ")} = ${sum(w.rolls.rp)}${mult.r !== 1 ? ` × ${mult.r}` : ""} = <b class="good">+${num(w.gain?.rp)}</b> <span class="faint">(old rule)</span></p>`) : ""}
    <button class="primary" data-act="closemath">Got it</button>
  </div>`;
}

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
    <li><b>Weekly:</b> choose how many of the ${R.HOUSE.weeklyDice} go to Immortal Fans, Notoriety and Research Points, then roll.</li>
    <li><b>Immortal Fans:</b> each d100 given to Fans is worth Fans dice: under 50 nothing, 50s 1, 60s 2, 70s 3, 80s 4, 90s 5, a natural 100 gives 10. Everyone starts with a d2; every 90 or more makes it 2 sides bigger (d2 → d4 → d6…), starting with that die's own Fans dice. Add up the Fans dice for new fans.</li>
    <li><b>Notoriety:</b> each d100 given to Notoriety that's over 50 gives 1 Notoriety die; 90 or more gives 2. The Notoriety die is set by the Fans tier (d4, d6 from Tier III, d10 from Tier VIII). The total is halved at Fans Tier I and doubled from Tier IV.</li>
    <li><b>Research Points:</b> each d100 given to Research that's over 50 gives 1 Research die; 90 or more gives 2 (just 1 during Wild Sheep Chase). The Research die is set by the Notoriety rank (d4; d6 from The Litching Hour; d10 from Executive). The total is doubled from Fans Tier VI.</li>
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
  app.innerHTML = (tab === "craft" ? craftTab() : tab === "gather" ? gatherTab() : tab === "weekly" ? weeklyTab() : tab === "rules" ? rulesTab() : overview()) + (tab === "weekly" ? mathWindow() : "");
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
  const plan = { ...planFor() };
  if (plan.fans + plan.notoriety + plan.rp !== totalWeeklyDice()) return;
  busy = true; render();
  const c = rec(), e = R.effects(c);
  const rolls = {};
  for (const [k, label] of POOLS) {
    if (!plan[k]) { rolls[k] = []; continue; }
    const r = roll(`${plan[k]}d100`);
    share(`Weekly: ${plan[k]}d100 for ${label}`, r);
    rolls[k] = r.all.map((d) => d.v);
  }
  const dieFrom = c.fansDie || R.HOUSE.fansDieStart;
  const fp = R.planFans(rolls.fans, dieFrom);
  let fans = 0;
  let fansDetail = "";
  if (fp.expr) { const r = roll(fp.expr); fans = r.total; fansDetail = r.detail; share(`Immortal Fans (${fp.expr})`, r); }
  const sum = (a) => a.reduce((t, v) => t + v, 0);
  // Notoriety: each d100 over 50 gives a Notoriety die (2 for a 90+), sized by the Fans tier.
  const nCount = rolls.notoriety.reduce((t, v) => t + R.notorietyDiceFor(v), 0);
  const nDie = e.notorietyDie.replace(/^1/, "");
  let nRolled = 0, notorietyExpr = "", notorietyDetail = "";
  if (nCount) { notorietyExpr = `${nCount}${nDie}`; const r = roll(notorietyExpr); nRolled = r.total; notorietyDetail = r.detail; share(`Notoriety (${notorietyExpr})`, r); }
  // Research: same idea, with the Research die from the Notoriety rank.
  const rCount = rolls.rp.reduce((t, v) => t + R.researchDiceFor(v, e.noHighRollBonus), 0);
  const rDie = e.researchDie.replace(/^1/, "");
  let rRolled = 0, researchExpr = "", researchDetail = "";
  if (rCount) { researchExpr = `${rCount}${rDie}`; const r = roll(researchExpr); rRolled = r.total; researchDetail = r.detail; share(`Research Points (${researchExpr})`, r); }
  const gain = { fans, notoriety: Math.floor(nRolled * e.notorietyMultiplier), rp: Math.floor(rRolled * e.researchMultiplier) };
  const result = `+${gain.fans} fans${fp.expr ? ` (${fp.expr})` : ""}, +${gain.notoriety} notoriety, +${gain.rp} RP`;
  await save((x) => {
    x.fans = num(x.fans) + gain.fans; x.notoriety = num(x.notoriety) + gain.notoriety; x.rp = num(x.rp) + gain.rp;
    x.fansDie = fp.endDie;
    x.weekly = { at: Date.now(), applied: true, plan, rolls, gain, fansExpr: fp.expr, fansDetail, notorietyExpr, notorietyDetail, nRolled, nDie, researchExpr, researchDetail, rRolled, rDie, wildSheep: e.noHighRollBonus, dieFrom, dieTo: fp.endDie, result, weeks: weeksFor(), mult: { n: e.notorietyMultiplier, r: e.researchMultiplier } };
    x.weeks = 1;
  }, `${weeksFor() === 2 ? "Two-week roll" : "Weekly"}: ${result}${fp.endDie !== dieFrom ? `; Fans die now d${fp.endDie}` : ""}`);
  busy = false;
  if (isGM()) showMath = true;
  render();
  S.notify(`Weekly: ${result}`, "SUCCESS");
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
  if (a !== armed) armed = "";
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
  if (a.startsWith("sheet")) { sheetAction(a); return; }
  if (a === "math") { showMath = true; render(); return; }
  if (a === "closemath") { showMath = false; render(); return; }
  if (a === "undoweek") {
    if (armed !== "undoweek") { armed = "undoweek"; render(); return; }
    armed = "";
    const w = rec().weekly;
    if (!w?.applied || !w.gain) return;
    await save((x) => {
      x.fans = Math.max(0, num(x.fans) - num(w.gain.fans));
      x.notoriety = Math.max(0, num(x.notoriety) - num(w.gain.notoriety));
      x.rp = num(x.rp) - num(w.gain.rp);
      if (w.dieFrom) x.fansDie = w.dieFrom;
      x.weekly = null;
    }, `GM undid the weekly roll (${w.result || ""})`);
    S.notify("Weekly roll undone. They can roll again.", "SUCCESS");
    return;
  }
  if (a === "nextweekall") {
    if (armed !== "nextweekall") { armed = "nextweekall"; render(); return; }
    armed = "";
    for (const ch of chars) {
      const r0 = R.normalizeCrafter(records[ch.id] || { name: ch.name });
      if (r0.weekly?.applied && !r0.weekly.nextWeek) { r0.weekly = { ...r0.weekly, nextWeek: true }; records[ch.id] = r0; await S.saveOne(ch.id, r0); }
    }
    render(); S.notify("New week: everyone can roll again.", "SUCCESS");
    return;
  }
  if (a === "nextweek") save((x) => { x.weekly = { ...x.weekly, nextWeek: true }; }, "GM started the next week");
  if (a === "plan") {
    const p = planFor(), d = num(b.dataset.d), left = totalWeeklyDice() - p.fans - p.notoriety - p.rp;
    if (d > 0 && left <= 0) return;
    p[b.dataset.pool] = Math.max(0, p[b.dataset.pool] + d); render();
  }
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
  if (t.hasAttribute("data-weeks")) { save((x) => { x.weeks = t.checked ? 2 : 1; }); }
  if (t.hasAttribute("data-owner")) save((x) => { x.owner = t.value; });
});
app.addEventListener("keydown", (e) => { if (e.target.id === "add-name" && e.key === "Enter") app.querySelector('[data-act="add"]')?.click(); });
app.addEventListener("input", (e) => {
  const t = e.target;
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
