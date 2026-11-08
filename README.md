# Myr'rodin Crafting — an Owlbear Rodeo extension

Crafting, Research Points, Notoriety and Immortal Fans, following the **Crafting System** tab of the GM's sheet. It's its own extension (its own button in Owlbear), but it works hand in hand with the Myr'rodin System:

- The party's characters show up automatically, and craft rolls use their ability scores and proficiency from their Myr'rodin sheets.
- Rolls appear in the Myr'rodin roll log with the celestial dice.
- Everything is saved with the room, so it follows you between scenes.

## Install

It lives in its own GitHub repository, **MyrrodinCrafting**, with GitHub Pages turned on (Settings → Pages → `main` / root).

Install link for Owlbear:
```
https://iondi.github.io/MyrrodinCrafting/manifest.json
```
In Owlbear: **Profile → Extensions → Add Extension**, paste it, then turn on **Myr'rodin Crafting** in your room.

## Using it

**Overview** — crafting level, Research Points, Notoriety and Immortal Fans with their current rank and effect, the Notoriety and Research dice, and materials. The GM can type any number straight in.

**Craft** — every crafting proficiency (spell schools, armor, weapons, firearms, ammunition, mechanical, potions, food). The GM sets each one's proficiency (Proficient / Expertise / Mastery) and rank (Beginner → Grandmaster). Click a category to craft:
- d20 + that category's ability modifier + proficiency bonus (×1 Proficient, ×2 Expertise, ×2 with advantage for Mastery), against the rank's DC.
- A rank needs the right proficiency (Novice and Skilled: Proficient; Advanced and Veteran: Expertise; Professional and Grandmaster: Mastery).
- Success uses up the materials, counts toward that category, and rolls the Notoriety die and Research die for extra Notoriety and Research Points. Failure keeps the materials.

**Gather** — spend Research Points on materials (D 1, C 3, B 5, A 10, S 17, SS 25, SSS 35). Better grades need a better proficiency. Cause for Concern doubles the cost; Nobility makes Grade A and under free.

**Weekly** — first choose how many of the 7 dice go to Immortal Fans, Notoriety and Research Points (with − / +), then roll. The dice for each are rolled separately and added straight away; nothing can be moved after the roll.
- **Immortal Fans:** each d100 is worth Fans dice: under 50 nothing, 50–59 one, 60–69 two, 70–79 three, 80–89 four, 90–99 five, a natural 100 ten. Everyone starts with a **d2** Fans die; every 90 or higher makes it 2 sides bigger (d2 → d4 → d6…) straight away: that die's own Fans dice and every one after it use the bigger die. Example at d2: 71 63 92 88 15 82 71 → 5d2 + 16d4, and the Fans die stays d4 from then on. The Fans dice are then rolled and added up. Example at d2: 22 61 48 89 84 68 9 → 12d2.
- **Notoriety:** each d100 given to Notoriety that's over 50 gives 1 Notoriety die; 90 or more gives 2. The Notoriety die comes from the Immortal Fans tier (d4; d6 from Tier III; d10 from Tier VIII). The total is halved at Fans Tier I and doubled from Tier IV.
- **Research Points:** a d100 given to Research adds its number (doubled from Fans Tier VI).
- **Two weeks (GM only):** tick the box at the bottom of the Weekly tab and that character's next roll is 14d100; it goes back to one week afterwards.
- Each character gets one weekly roll; the GM clicks **Start the next week** to let them roll again (the GM can always roll). The GM can also set anyone's Fans die on the Overview.
- **🧮 Show the math (GM only):** after a weekly roll, a window walks through every d100: how many Fans dice it gave, when the Fans die grew, the running total, the actual Fans dice rolled, and the Notoriety / Research sums with multipliers. It opens by itself when the GM rolls; the button under "Last weekly roll" reopens it.
- **GM resets:** **↺ Undo this roll** (under "Last weekly roll") takes back everything that roll added, puts the Fans die back, and lets them roll again. **New week for everyone** unlocks every character at once.

**Rules** — all the tables, for quick reference at the table.

Players see and use only their own character. The GM sees everyone and can **+ Add a crafter** for NPCs.

## Changing a rule

Everything is in `js/rules.js`. At the top, **HOUSE** has the switches:

| Setting | Now |
|---|---|
| `tierMultiplier` | Proficient ×1, Expertise ×2, Mastery ×2 |
| `masteryRollsWithAdvantage` | yes |
| `materialsLostOnFail` | no |
| `successRollsNotoriety` / `successRollsResearch` | yes |
| `weeklyDice` | 7d100 |

The ranks, DCs, material costs, Notoriety ranks and Fans tiers are the tables below that.
