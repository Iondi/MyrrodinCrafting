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

**Weekly** — roll 7d100 and split it between Immortal Fans, Notoriety and Research Points. Notoriety is halved at Fans Tier I and doubled from Tier IV; Research Points are doubled from Fans Tier VI. Only the GM can throw a roll away and let someone roll again.

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
