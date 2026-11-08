/**
 * MYR'RODIN CRAFTING — Google Sheet bridge
 *
 * Paste this into the Craft Master Sheet: Extensions → Apps Script.
 * It lets the Myr'rodin Crafting extension in Owlbear:
 *   - keep one tab per crafting character up to date (same layout as "Kay den"),
 *   - add every roll, craft and gather to a "Crafting Log" tab,
 *   - read the character tabs back in (to import Kayden, Elisio, …).
 *
 * 1. Change SECRET below to a password of your own (keep the quotes).
 * 2. Deploy → New deployment → type "Web app".
 *      Execute as: Me      Who has access: Anyone
 * 3. Copy the Web app URL and paste it, with the SECRET, into
 *    Owlbear → Crafting → Overview → Google Sheet (GM only).
 */
const SECRET = 'change-me';

// ---- Where things live on a character tab (matches "Kay den") ------------------
const LAYOUT = {
  firstRow: 3,                 // Abjuration … Food are rows 3–28
  tierCols: ['F', 'G', 'H'],   // Proficient, Expert, Mastery boxes
  rankCol: 'I',
  abilityCol: 'J',
  researchPoints: 'L3',
  successes: 'L6',             // "Success x5"
  materials: { D: 'L10', C: 'L14', B: 'L18', A: 'L22', S: 'L26', SS: 'L30', SSS: 'L34' },
  craftingLevel: 'A31',
  notoriety: 'D31',            // "751 (D6)"
  fans: 'F31',                 // "2042 (D42)"
  marker: 'A2',                // says "Crafting Proficencies" on every character tab
};
const CATEGORY_COUNT = 26;
const ON = '■', OFF = '□';
const LOG_TAB = 'Crafting Log';

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return reply({ ok: false, error: 'Bad request' }); }
  if (!req || req.key !== SECRET) return reply({ ok: false, error: 'Wrong key' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (req.action === 'ping') return reply({ ok: true, title: ss.getName(), tabs: characterTabs(ss).map((s) => s.getName()) });
    if (req.action === 'sync') {
      const written = (req.characters || []).map((c) => writeCharacter(ss, c));
      const logged = appendLog(ss, req.logs || []);
      return reply({ ok: true, written, logged });
    }
    if (req.action === 'read') return reply({ ok: true, characters: characterTabs(ss).map(readCharacter) });
    return reply({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return reply({ ok: true, message: "Myr'rodin Crafting sheet bridge is running." });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---- Character tabs -------------------------------------------------------------
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function characterTabs(ss) {
  return ss.getSheets().filter((s) => String(s.getRange(LAYOUT.marker).getValue()).indexOf('Crafting Prof') === 0);
}

// Find the character's tab ("Kayden" also finds "Kay den"), or make one by
// copying an existing character tab so it gets the same look and dropdowns.
function tabFor(ss, name) {
  const want = squash(name);
  const found = characterTabs(ss).find((s) => squash(s.getName()) === want);
  if (found) return { sheet: found, created: false };
  const template = characterTabs(ss)[0];
  if (!template) throw new Error('No character tab to copy. Keep at least one tab like "Kay den".');
  const copy = template.copyTo(ss).setName(String(name).slice(0, 90));
  ss.setActiveSheet(copy);
  ss.moveActiveSheet(ss.getNumSheets());
  copy.getRange('D32:K40').clearContent();   // the old character's notes
  copy.getRange('N3').clearContent();
  return { sheet: copy, created: true };
}

function writeCharacter(ss, c) {
  const { sheet, created } = tabFor(ss, c.name);
  const rows = [];
  for (let i = 0; i < CATEGORY_COUNT; i++) {
    const tier = Number((c.tiers || [])[i]) || 0;
    rows.push([tier >= 1 ? ON : OFF, tier >= 2 ? ON : OFF, tier >= 3 ? ON : OFF, (c.ranks || [])[i] || 'Beginner', (c.abilities || [])[i] || 'Intelligence']);
  }
  sheet.getRange(LAYOUT.firstRow, 6, CATEGORY_COUNT, 5).setValues(rows); // F..J
  sheet.getRange(LAYOUT.researchPoints).setValue(Number(c.rp) || 0);
  sheet.getRange(LAYOUT.successes).setValue(c.successes ? 'Success x' + c.successes : 'None');
  Object.keys(LAYOUT.materials).forEach((g) => {
    const n = Number((c.materials || {})[g]) || 0;
    sheet.getRange(LAYOUT.materials[g]).setValue(n > 0 ? n : 'None');
  });
  sheet.getRange(LAYOUT.craftingLevel).setValue(c.craftingLevel || 'Beginner');
  sheet.getRange(LAYOUT.notoriety).setValue((Number(c.notoriety) || 0) + ' (' + String(c.notorietyDie || 'd4').toUpperCase() + ')');
  sheet.getRange(LAYOUT.fans).setValue((Number(c.fans) || 0) + ' (D' + (Number(c.fansDie) || 2) + ')');
  return { name: sheet.getName(), created };
}

function readCharacter(sheet) {
  const block = sheet.getRange(LAYOUT.firstRow, 6, CATEGORY_COUNT, 5).getDisplayValues();
  const num = (a1) => { const m = String(sheet.getRange(a1).getDisplayValue()).replace(/,/g, '').match(/-?\d+/); return m ? Number(m[0]) : 0; };
  const fansText = sheet.getRange(LAYOUT.fans).getDisplayValue();
  const die = String(fansText).match(/\(\s*d\s*(\d+)\s*\)/i);
  const materials = {};
  Object.keys(LAYOUT.materials).forEach((g) => { materials[g] = num(LAYOUT.materials[g]); });
  return {
    tab: sheet.getName(),
    tiers: block.map((r) => [r[0], r[1], r[2]].filter((x) => x === ON).length),
    ranks: block.map((r) => r[3]),
    abilities: block.map((r) => r[4]),
    rp: num(LAYOUT.researchPoints),
    successes: num(LAYOUT.successes),
    materials,
    craftingLevel: sheet.getRange(LAYOUT.craftingLevel).getDisplayValue(),
    notoriety: num(LAYOUT.notoriety),
    fans: num(LAYOUT.fans),
    fansDie: die ? Number(die[1]) : 0,
  };
}

// ---- The log ----------------------------------------------------------------------
function appendLog(ss, logs) {
  if (!logs.length) return 0;
  let sheet = ss.getSheetByName(LOG_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_TAB);
    sheet.appendRow(['When', 'Character', 'What happened']);
    sheet.getRange('A1:C1').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150); sheet.setColumnWidth(2, 140); sheet.setColumnWidth(3, 620);
  }
  const rows = logs.map((l) => [new Date(Number(l.t) || Date.now()), String(l.name || ''), String(l.x || '')]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
  sheet.getRange(sheet.getLastRow() - rows.length + 1, 1, rows.length, 1).setNumberFormat('MMM d, yyyy h:mm am/pm');
  return rows.length;
}
