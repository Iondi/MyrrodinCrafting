// =====================================================================
//  MYR'RODIN CRAFTING — RULES
//  Everything here comes from the "Crafting System" tab of the GM's
//  Crafting, Spellcasting & Resurrection sheet. Change a number here to
//  change it everywhere.
// =====================================================================

export const HOUSE = {
  // How much each crafting proficiency adds, as a multiple of the proficiency bonus.
  tierMultiplier: [0, 1, 2, 2],          // none, Proficient, Expertise, Mastery
  masteryRollsWithAdvantage: true,
  // Are the materials used up when a craft fails?
  materialsLostOnFail: false,
  // On a successful craft, also roll the Notoriety die and the Research die
  // and add them to Notoriety and Research Points.
  successRollsNotoriety: true,
  successRollsResearch: true,
  weeklyDice: "7d100",
  // Immortal Fans from the weekly roll (see fansDiceFor / planFans below).
  fansDieStart: 2,     // everyone starts with a d2
  fansDieGrowth: 2,    // each 90+ makes the die 2 sides bigger (d2 → d4 → d6 …)
  fansGrowAt: 90,
};

// How many Fans dice one d100 is worth: under 50 nothing, 50s 1, 60s 2,
// 70s 3, 80s 4, 90s 5, a natural 100 gives 10.
export function fansDiceFor(v) {
  v = Number(v) || 0;
  if (v >= 100) return 10;
  if (v < 50) return 0;
  return Math.floor(v / 10) - 4;
}
// Work out the Fans dice for the d100s given to Fans, in the order rolled.
// A 90+ grows the die right away: its own dice already use the bigger size,
// and so does every die after it. (d2: 71 63 92 88 15 82 71 → 5d2 + 16d4)
// Notoriety from a weekly d100: over 50 gives 1 Notoriety die, 90 or more
// gives 2. The Notoriety die comes from the Immortal Fans tier (d4, d6 at
// Tier III, d10 at Tier VIII).
export function notorietyDiceFor(v) {
  v = Number(v) || 0;
  return v >= 90 ? 2 : v > 50 ? 1 : 0;
}

// Research Points from a weekly d100: same as Notoriety (over 50 → 1 die,
// 90+ → 2), but Wild Sheep Chase cancels the 90+ bonus. The Research die
// comes from the Notoriety rank (d4, d6 from The Litching Hour, d10 from
// Executive); Fans Tier VI doubles the total.
export function researchDiceFor(v, noHighRollBonus = false) {
  v = Number(v) || 0;
  if (v >= 90) return noHighRollBonus ? 1 : 2;
  return v > 50 ? 1 : 0;
}

// Step by step, for the GM's "show the math" window.
export function explainFans(values, startDie) {
  let size = Number(startDie) || HOUSE.fansDieStart;
  const groups = [];
  return values.map((v) => {
    const from = size;
    if (v >= HOUSE.fansGrowAt) size += HOUSE.fansDieGrowth;
    const n = fansDiceFor(v);
    if (n) {
      const last = groups[groups.length - 1];
      if (last && last.size === size) last.count += n; else groups.push({ count: n, size });
    }
    const why = v >= 100 ? "natural 100 → 10 dice" : v >= 90 ? "90s → 5 dice" : v >= 50 ? `${Math.floor(v / 10) * 10}s → ${n} ${n === 1 ? "die" : "dice"}` : "under 50 → nothing";
    return { v, n, size, grew: size !== from ? { from, to: size } : null, why, sofar: groups.map((g) => `${g.count}d${g.size}`).join(" + ") || "—" };
  });
}

export function planFans(values, startDie) {
  let size = Number(startDie) || HOUSE.fansDieStart;
  const groups = [];
  for (const v of values) {
    if (v >= HOUSE.fansGrowAt) size += HOUSE.fansDieGrowth;
    const n = fansDiceFor(v);
    if (n) {
      const last = groups[groups.length - 1];
      if (last && last.size === size) last.count += n; else groups.push({ count: n, size });
    }
  }
  return { groups, endDie: size, expr: groups.map((g) => `${g.count}d${g.size}`).join("+") };
}

export const TIERS = ["None", "Proficient", "Expertise", "Mastery"];

// The crafting proficiencies and the ability each one rolls with.
export const CATEGORIES = [
  ["abjuration", "Abjuration", "int", "Spell schools"],
  ["conjuration", "Conjuration", "int", "Spell schools"],
  ["divination", "Divination", "int", "Spell schools"],
  ["enchantment", "Enchantment", "int", "Spell schools"],
  ["evocation", "Evocation", "int", "Spell schools"],
  ["illusion", "Illusion", "int", "Spell schools"],
  ["necromancy", "Necromancy", "int", "Spell schools"],
  ["transmutation", "Transmutation", "int", "Spell schools"],
  ["lightArmor", "Light Armor", "int", "Armor & gear"],
  ["mediumArmor", "Medium Armor", "int", "Armor & gear"],
  ["heavyArmor", "Heavy Armor", "int", "Armor & gear"],
  ["jewelry", "Jewelry", "int", "Armor & gear"],
  ["shields", "Shields", "int", "Armor & gear"],
  ["simpleMelee", "Simple Melee Weapons", "int", "Weapons"],
  ["simpleRanged", "Simple Ranged Weapons", "int", "Weapons"],
  ["martialMelee", "Martial Melee Weapons", "int", "Weapons"],
  ["martialRanged", "Martial Ranged Weapons", "int", "Weapons"],
  ["exoticMelee", "Exotic Melee Weapons", "int", "Weapons"],
  ["exoticRanged", "Exotic Ranged Weapons", "int", "Weapons"],
  ["handgun", "Handgun", "int", "Firearms"],
  ["midFirearm", "Mid-range Firearm", "int", "Firearms"],
  ["rifles", "Rifles", "int", "Firearms"],
  ["ammunition", "Ammunition", "dex", "Firearms"],
  ["mechanical", "Mechanical", "dex", "Other"],
  ["potions", "Potions", "wis", "Other"],
  ["food", "Food", "wis", "Other"],
].map(([key, name, ability, group]) => ({ key, name, ability, group }));
export const ABILITY_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

// Crafting ranks. `need` = proficiency tier needed (0 everyone … 3 Mastery).
export const RANKS = [
  { name: "Beginner", dc: 15, need: 0, mats: { D: 2, C: 1 }, effect: "Basic items (e.g. common healing potion 2d4+2, starting armor = 10 temp HP)" },
  { name: "Novice", dc: 18, need: 1, mats: { D: 5, C: 3, B: 1 }, effect: "Plus 1 item" },
  { name: "Skilled", dc: 22, need: 1, mats: { C: 5, B: 3, A: 1 }, effect: "Plus 1 AC" },
  { name: "Advanced", dc: 25, need: 2, mats: { B: 5, A: 3, S: 1 }, effect: "Plus 2 item + 1st-level spell" },
  { name: "Veteran", dc: 28, need: 2, mats: { A: 5, S: 3, SS: 1 }, effect: "Plus 2 item + 3rd-level spell" },
  { name: "Professional", dc: 30, need: 3, mats: { S: 5, SS: 3, SSS: 1 }, effect: "Plus 3 item + 5th-level spell" },
  { name: "Grandmaster", dc: 35, need: 3, mats: null, rp: 200, effect: "Portal creation (Kayden only for now)" },
];

// Materials: Research Points to collect one, and the proficiency needed.
export const GRADES = [
  { g: "D", rp: 1, need: 0 },
  { g: "C", rp: 3, need: 0 },
  { g: "B", rp: 5, need: 1 },
  { g: "A", rp: 10, need: 1 },
  { g: "S", rp: 17, need: 2 },
  { g: "SS", rp: 25, need: 2 },
  { g: "SSS", rp: 35, need: 3 },
];
export const gradeRp = (g) => GRADES.find((x) => x.g === g)?.rp || 0;
export const rankValue = (r) => (r.mats ? Object.entries(r.mats).reduce((t, [g, n]) => t + gradeRp(g) * n, 0) : r.rp || 0);

// Notoriety ranks. Penalties only apply while you're in that rank;
// bonuses carry on into every rank above it.
export const NOTORIETY = [
  { name: "Cause for Concern", min: 0, effect: "Doubles the cost of materials", penalty: true },
  { name: "Wild Sheep Chase", min: 51, effect: "No extra benefit from 90+ rolls for researching / crafting", penalty: true },
  { name: "Grammy's Country Apples", min: 126, effect: "No additional effect" },
  { name: "The Litching Hour", min: 301, effect: "Research Die becomes d6" },
  { name: "The Gold Digger", min: 501, effect: "(Passive) +1 to crafting rolls" },
  { name: "Nobility", min: 751, effect: "Grade A materials and under are free" },
  { name: "VIP", min: 1201, effect: "Escort Protocol: +1 to AC" },
  { name: "Executive", min: 2001, effect: "Research Die becomes d10" },
  { name: "Legend", min: 3001, effect: "(Passive) +1 to all saving throws" },
  { name: "Icon", min: 4501, effect: "Proficiency Bonus +1" },
];
export const FANS = [
  { name: "Tier I", min: 0, effect: "Halves your Notoriety gained", penalty: true },
  { name: "Tier II", min: 100, effect: "No additional effect" },
  { name: "Tier III", min: 500, effect: "Notoriety Die becomes d6" },
  { name: "Tier IV", min: 1000, effect: "Doubles Notoriety gained" },
  { name: "Tier V", min: 10000, effect: "(Passive) +1 to all Charisma checks and saving throws" },
  { name: "Tier VI", min: 20000, effect: "Doubles Research Points gained" },
  { name: "Tier VII", min: 35000, effect: "(Passive) +250,000 petals / month income" },
  { name: "Tier VIII", min: 70000, effect: "Notoriety Die becomes d10" },
  { name: "Tier IX", min: 100000, effect: "4 failed death saves needed to die" },
];
const indexFor = (list, n) => { let i = 0; list.forEach((x, k) => { if ((Number(n) || 0) >= x.min) i = k; }); return i; };
export const notorietyIndex = (n) => indexFor(NOTORIETY, n);
export const fansIndex = (n) => indexFor(FANS, n);
const N = Object.fromEntries(NOTORIETY.map((x, i) => [x.name, i]));
const F = Object.fromEntries(FANS.map((x, i) => [x.name, i]));

// Everything the ranks do to a character right now.
export function effects(c) {
  const ni = notorietyIndex(c.notoriety), fi = fansIndex(c.fans);
  return {
    notoriety: NOTORIETY[ni], fansTier: FANS[fi], ni, fi,
    materialCostMultiplier: ni === N["Cause for Concern"] ? 2 : 1,
    freeUpToGrade: ni >= N["Nobility"] ? "A" : null,
    craftBonus: ni >= N["The Gold Digger"] ? 1 : 0,
    pbBonus: ni >= N["Icon"] ? 1 : 0,
    researchDie: ni >= N["Executive"] ? "1d10" : ni >= N["The Litching Hour"] ? "1d6" : "1d4",
    notorietyDie: fi >= F["Tier VIII"] ? "1d10" : fi >= F["Tier III"] ? "1d6" : "1d4",
    notorietyMultiplier: fi === F["Tier I"] ? 0.5 : fi >= F["Tier IV"] ? 2 : 1,
    researchMultiplier: fi >= F["Tier VI"] ? 2 : 1,
    noHighRollBonus: ni === N["Wild Sheep Chase"],
  };
}

// Research Points needed to collect `qty` of a grade.
export function gatherCost(c, grade, qty) {
  const e = effects(c);
  const order = GRADES.map((x) => x.g);
  if (e.freeUpToGrade && order.indexOf(grade) <= order.indexOf(e.freeUpToGrade)) return 0;
  return gradeRp(grade) * (Number(qty) || 0) * e.materialCostMultiplier;
}

export const abilityMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

// A blank crafting record.
export function blankCrafter(name = "New crafter") {
  return { name, owner: "", prof: {}, rank: {}, succ: {}, notoriety: 0, fans: 0, fansDie: HOUSE.fansDieStart, rp: 0, mat: { D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 }, manual: { int: 0, dex: 0, wis: 0, pb: 2 }, log: [] };
}
export function normalizeCrafter(c) {
  const b = blankCrafter();
  const out = { ...b, ...(c || {}) };
  out.mat = { ...b.mat, ...(c?.mat || {}) };
  out.manual = { ...b.manual, ...(c?.manual || {}) };
  for (const k of ["prof", "rank", "succ"]) if (!out[k] || typeof out[k] !== "object") out[k] = {};
  if (!Array.isArray(out.log)) out.log = [];
  return out;
}
