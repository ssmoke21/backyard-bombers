# Backyard Bombers

A silly home run derby you play in a web browser.

## How to run it

**The easy way:** double-click `index.html`. It opens in your browser and works.

**If you want a local web address** (handy for testing on your phone), open a
terminal in this folder and run:

```bash
node .claude/serve.js
```

Then visit http://localhost:8123

## How to put it on the internet

Drop this whole folder into a GitHub repo, go to **Settings → Pages**, and set
the source to your main branch. No build step, nothing to install.

## The files

| File | What's in it |
|---|---|
| `index.html` | The page and all the menu screens |
| `style.css`  | Colors and layout for the menus. No game art here. |
| `content.js` | **All the numbers and all the jokes.** Bosses, bats, pitches, characters, taunts, landmarks, announcer lines. |
| `sound.js`   | Every noise in the game, built from scratch with the Web Audio API. No sound files. |
| `game.js`    | The machinery. You shouldn't need to open this to rebalance anything. |
| `.claude/`   | Optional dev helper (the little local server). Not part of the game. |

## Rebalancing

Open `content.js`. Change a number, save, refresh the browser.

**The single most important dial is each boss's `target`** — how many total feet
you need over 10 pitches to beat them. For reference, a decent player who manages
the power meter averages roughly **3,600–4,700 ft** a round with the Regular Bat.
Current targets:

| Boss | Target |
|---|---|
| Nana | 900 |
| Pop | 1,600 |
| Pat & Joey | 2,200 |
| Uncle Matt | 2,500 |
| The Dogs | 2,800 |

Nana's is deliberately very low. A kid who just holds the button the whole way
(which maxes out the red overswing zone every time on her slow lobs) still scores
around 1,000–1,600, so she's winnable while you're still learning to let go early.

Other useful knobs, all in `CONFIG` at the top of `content.js`:

- `chargeSeconds` — how fast the power meter fills
- `perfectMs` / `goodMs` / `contactMs` — how forgiving the timing is
- `overswingPenalty` — how badly a full red meter hurts
- `baseDistance` — how far everything goes

## The five fields

Each boss plays at their own place. They're all in the `FIELDS` block in
`content.js` — sky colours, grass colours, fence distance and style, the crowd,
the scenery out past the fence, and that field's own landmark list.

| Boss | Venue | Fence |
|---|---|---|
| Nana | The Backyard (wooden privacy fence, tomato plants) | 160 ft |
| Pop | The Neighbourhood Field (chain link, snack stand) | 280 ft |
| Pat & Joey | Boro Park, Milltown (playground, tennis courts, duck pond) | 300 ft |
| Uncle Matt | The City Lot (concrete wall, taxis, skyline) | 320 ft |
| The Dogs | Backyard Bombers Park — night game, under the lights | 400 ft |

The fence is **cosmetic only** — the ball flies straight over it, so moving a
fence just changes how the place looks and where "over the wall" starts.

Landmarks are split in two: `NEAR_LANDMARKS` (the dribblers and bloops, shared
by every field) and each field's own `landmarks` list for anything that clears
its fence. A field's list should start at its fence distance.

## Versus mode

**👥 VERSUS** on the title screen. 2–4 people on one device, taking turns —
each player gets a full 10 pitches, then passes it on. Type names at the start,
pick your character and bat before each turn, and there's a ranked results table
at the end with a 🏆 for the winner.

Everybody gets **all four characters and every bat except the Frozen Fish**,
whether or not anyone has touched single player. The Frozen Fish is the one
thing you have to earn — beat the ladder in single player and it shows up in
versus too. To just hand it out, set `versusLocked: false` on it in `content.js`.

Versus never touches your single-player progress: no unlocks, no ladder
movement, and your best scores stay yours.

Settings in `VERSUS` (in `content.js`):

- `bossMode` — `"sameForAll"` (default: one random boss, everybody faces them,
  which is fair) or `"randomEachTurn"` (everybody draws their own, which is
  chaotic and a bit unfair)
- `minPlayers` / `maxPlayers` / `maxNameLength` / `defaultNames`

### A note on gear

The character/bat combo matters a lot, and that's deliberate — but here's the
measured shape of it, so you can tune if you want. Average round vs Pop:

| Combo | Sharp timing | Sloppy (a kid) | Flailing |
|---|---|---|---|
| Batter + Regular | 4,719 | 3,711 | 2,546 |
| Zeus + Pool Noodle | 2,575 | 2,575 | **2,451** |
| Batter + Banana | 6,498 | 4,268 | 1,983 |
| Georgia + Banana | 9,261 | 5,130 | 2,983 |

The Pool Noodle looks weak until you look at the last column: it barely drops at
all, and it never whiffs. That's the point — it's the floor for a young player.
Georgia + Banana Peel is the strongest combo at every skill level; if it wins
every game at your house, turn down `chaosJackpot` on Georgia in `content.js`.

## Pausing

The ⏸ button in the corner, or the **P** / **Esc** key. Resume, restart the
round, quit to the lineup, or mute. The world freezes completely and comes back
on the exact same pitch — though whatever you were holding gets let go, so you
start that swing's charge fresh.

## Juice knobs

In `content.js`:

- `JUICE` — screen shake amount, particle counts, the crowd on the fence
- `LANDMARKS` — where the ball lands, by distance. Keep them in `min` order.
- `ANNOUNCER` — the silly line after every swing, in five buckets
- `BAT_DEBRIS` — what flies off each bat on contact

In `sound.js`:

- `SOUND.volume` — master volume for everything
- Each noise has its own `vol` if one thing is too loud on its own

## Build status

- **Phase 1 — core loop** ✅
- **Phase 2 — bosses, characters, unlocks, saving** ✅
- **Phase 3 — sound, particles, crowd, announcer, landmarks, screen shake** ✅
- **Phase 4 — versus mode** ✅ (all four phases done)

Plus, since: a pause screen and a different field for every boss.

## Saving

Progress lives in your browser's `localStorage` under `backyardBombers.v2`,
and the sound on/off setting under `backyardBombers.sound`.
The ⚙️ button in the corner of any menu has **SOUND** and **RESET ALL PROGRESS**.
