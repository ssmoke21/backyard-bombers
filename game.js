/* ==========================================================================
   BACKYARD BOMBERS  -  Phase 2: bosses, characters, unlocks and saving
   --------------------------------------------------------------------------
   All the numbers and jokes live in content.js. This file is the machinery.
   ========================================================================== */

const W = CONFIG.width;
const H = CONFIG.height;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  const pad = 8;
  const scale = Math.min((window.innerWidth - pad) / W, (window.innerHeight - pad) / H);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = (W * scale) + "px";
  canvas.style.height = (H * scale) + "px";
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();


/* ==========================================================================
   1. Saving  (Phase 3 adds nothing here; Phase 4 reads `bats` for versus)
   ========================================================================== */

const SAVE_KEY = "backyardBombers.v2";

function freshSave() {
  return {
    ladderIndex: 0,                 // how far up the boss ladder you are
    bats: ["regular"],
    characters: ["human"],
    best: 0,                        // best single hit, ever
    bestRound: 0,                   // best 10-pitch total, ever
  };
}

let save = freshSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { save = freshSave(); return; }
    const data = JSON.parse(raw);
    const f = freshSave();
    save = {
      ladderIndex: clamp(data.ladderIndex || 0, 0, BOSS_LADDER.length),
      bats: Array.isArray(data.bats) ? data.bats.filter(function (b) { return BATS[b]; }) : f.bats,
      characters: Array.isArray(data.characters) ? data.characters.filter(function (c) { return CHARACTERS[c]; }) : f.characters,
      best: data.best || 0,
      bestRound: data.bestRound || 0,
    };
    if (save.bats.indexOf("regular") < 0) save.bats.push("regular");
    if (save.characters.indexOf("human") < 0) save.characters.push("human");
  } catch (e) { save = freshSave(); }
}

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode, oh well */ }
}

function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  save = freshSave();
  players[0].characterId = "human";
  players[0].batId = "regular";
}

loadSave();


/* ==========================================================================
   2. Particles and screen shake
   All the noises live in sound.js.
   ========================================================================== */

const particles = [];

// opts: emoji or color, count, spread, speed, gravity, life, size
function spawnParticles(x, y, count, opts) {
  opts = opts || {};
  for (let i = 0; i < count; i++) {
    const ang = (opts.angle === undefined ? -Math.PI / 2 : opts.angle)
              + (Math.random() - 0.5) * (opts.spread === undefined ? Math.PI * 1.6 : opts.spread);
    const sp = (opts.speed || 260) * (0.35 + Math.random() * 0.9);
    particles.push({
      x: x + (Math.random() - 0.5) * (opts.jitter || 14),
      y: y + (Math.random() - 0.5) * (opts.jitter || 14),
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      gravity: opts.gravity === undefined ? 700 : opts.gravity,
      life: 0,
      maxLife: (opts.life || 0.55) * (0.6 + Math.random() * 0.8),
      size: (opts.size || 18) * (0.6 + Math.random() * 0.8),
      rot: Math.random() * 6.28,
      spin: (Math.random() - 0.5) * 12,
      emoji: opts.emojis ? pick(opts.emojis) : null,
      color: opts.color || "#ffe14d",
    });
  }
  if (particles.length > 220) particles.splice(0, particles.length - 220);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
  }
}

function drawParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const fade = 1 - p.life / p.maxLife;
    ctx.globalAlpha = fade;
    if (p.emoji) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = p.size + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.22 * fade + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function addShake(amount) {
  fx.shake = Math.min(JUICE.shakeMax * 1.4, fx.shake + amount);
}

// How hard a hit of this many feet should hit the screen and the crowd.
function hitIntensity(dist) { return clamp(dist / JUICE.shakeAtFeet, 0, 1); }


/* ==========================================================================
   3. Game state
   ========================================================================== */

function makePlayer(name) {
  return {
    name: name,
    characterId: "human",
    batId: "regular",
    totalDistance: 0,
    bestHit: 0,
    hitCount: 0,          // used by the baguette, which crumbles as you go
    swings: [],
    played: false,        // versus: has this player had their turn yet
  };
}

// Single player always uses this same object, so your character and bat choice
// survives a trip through versus mode and back.
const soloPlayer = makePlayer("Player 1");
let players = [soloPlayer];
let currentPlayer = 0;
function P() { return players[currentPlayer]; }
function character() { return CHARACTERS[P().characterId]; }
function bat() { return BATS[P().batId]; }

const game = {
  state: "menu",          // menu | windup | incoming | flight | result | between
  mode: "solo",           // solo | versus
  turn: 0,                // versus: whose turn it is
  playerCount: 2,         // versus: how many are playing
  bossId: BOSS_LADDER[0],
  pitcherIndex: 0,        // which pitcher of the boss is currently on the mound
  pitchNumber: 0,
  timer: 0,
  paused: false,
  warnings: 0,            // Uncle Matt's escalating threats
  dropsInARow: 0,         // stops Georgia dropping the ball forever
  replay: false,          // replaying an already-beaten boss
};
function boss() { return BOSSES[game.bossId]; }
function pitcher() { return boss().pitchers[game.pitcherIndex]; }
function field() { return FIELDS[boss().field] || FIELDS.backyard; }
function fenceFeet() { return field().fenceFeet; }

const ball = {
  t: 0,                   // pitch progress: 0 = released, 1 = at the plate
  dist: 0, height: 0, side: 0,
  vDist: 0, vHeight: 0, vSide: 0,
  pitchId: "fastball",
  seconds: 1.15,          // this pitch's actual travel time
  windowMod: 1,           // this pitch's actual timing forgiveness
  sideMod: 1,
  hideUntil: 0,
  hit: false,
  flightTime: 0,
};

const swing = {
  charging: false, meter: 0, held: false, done: false, anim: 0,
  dropped: false, slipped: false,
};

const result = {
  show: false, headline: "", sub: "", taunt: "", announcer: "",
  landmarkEmoji: "", distance: 0, sweet: false,
};

// Visual effects owned by the bosses
const fx = {
  desserts: [],
  dessertTimer: 0,
  lights: 0,              // Uncle Matt's police lights, seconds remaining
  lick: 0,                // Georgia licked the screen, seconds remaining
  charge: 0,              // Georgia is running the ball at you
  speech: "", speechTimer: 0,
  message: "", messageTimer: 0,
  chase: null,            // { catchDist } while Dottie is running one down
  chaseCaught: 0,
  shake: 0,               // screen shake, in pixels
  flash: 0,               // white flash on a sweet spot hit
  crowdJump: 0,           // the crowd is on its feet
};

let camFeet = 0;
let camScale = CONFIG.pitchScale;


/* ==========================================================================
   4. Screens and menus
   ========================================================================== */

const gear = document.getElementById("gear");

function showScreen(id) {
  game.paused = false;
  document.querySelectorAll(".screen").forEach(function (s) { s.classList.add("hidden"); });
  if (id) document.getElementById(id).classList.remove("hidden");
  if (id) game.state = "menu";
  updateCornerButton();
}
function hideScreens() {
  document.querySelectorAll(".screen").forEach(function (s) { s.classList.add("hidden"); });
  updateCornerButton();
}

// One button in the corner. It's the settings cog on menus and the pause
// button while you're actually batting.
function updateCornerButton() {
  const onSettings = !document.getElementById("screen-settings").classList.contains("hidden");
  const playing = game.state !== "menu" && !game.paused;
  gear.textContent = playing ? "⏸" : "⚙️";
  gear.classList.toggle("hidden", onSettings || game.paused);
}


/* ---- Pause --------------------------------------------------------------
   The pause screen deliberately does NOT go through showScreen(), because
   that sets the game to "menu" and we need to come back to the exact pitch
   we left. It just hides and unhides itself.
   ------------------------------------------------------------------------ */

function pauseGame() {
  if (game.paused || game.state === "menu") return;
  game.paused = true;
  const versus = game.mode === "versus";
  document.getElementById("pause-info").innerHTML =
    (versus ? "<b>" + escapeHtml(P().name) + "</b> — turn " + (game.turn + 1) + " of " + game.playerCount + "<br>" : "") +
    "Pitch <b>" + game.pitchNumber + " / " + CONFIG.pitchesPerRound + "</b> against <b>" + boss().name + "</b><br>" +
    "<b>" + Math.round(P().totalDistance).toLocaleString() + " ft</b>" +
    (versus ? " so far" : " of <b>" + boss().target.toLocaleString() + " ft</b>");
  document.getElementById("btn-pause-sound").textContent = SOUND.enabled ? "🔊 SOUND" : "🔇 MUTED";
  document.getElementById("btn-pause-restart").textContent = versus ? "RESTART TURN" : "RESTART ROUND";
  document.getElementById("btn-pause-quit").textContent = versus ? "QUIT THE GAME" : "QUIT TO LINEUP";
  document.getElementById("screen-pause").classList.remove("hidden");
  updateCornerButton();
}

function resumeGame() {
  if (!game.paused) return;
  game.paused = false;
  document.getElementById("screen-pause").classList.add("hidden");
  // Whatever you were holding when you paused, you are not holding now.
  swing.held = false;
  if (swing.charging) { swing.charging = false; swing.meter = 0; }
  updateCornerButton();
}

function togglePause() {
  if (game.paused) resumeGame();
  else pauseGame();
}

// ---- Boss ladder ---------------------------------------------------------
function buildLadder() {
  const list = document.getElementById("ladder-list");
  list.innerHTML = "";
  BOSS_LADDER.forEach(function (id, i) {
    const b = BOSSES[id];
    const beaten = i < save.ladderIndex;
    const isNext = i === save.ladderIndex;
    const locked = i > save.ladderIndex;

    const row = document.createElement("button");
    row.className = "bossrow" + (beaten ? " beaten" : "") + (isNext ? " next" : "") + (locked ? " locked" : "");
    row.innerHTML =
      "<span class='face'>" + b.pitchers[0].emoji + "</span>" +
      "<span class='info'><span class='nm'>" + (beaten ? "✅ " : "") + (b.shortName || b.name) + "</span><br>" +
      "<span class='tg'>" + (locked ? "Locked - beat the one above" : "Beat " + b.target.toLocaleString() + " ft") + "</span></span>";
    if (!locked) {
      row.addEventListener("click", function () {
        game.bossId = id;
        game.replay = beaten;
        openSelect();
      });
    }
    list.appendChild(row);
  });
  showScreen("screen-ladder");
}

// ---- What you're allowed to pick ----------------------------------------
// Versus hands out all four characters and every bat except the one you have
// to earn, so nobody is locked out just because somebody else did the work.
function availableCharacters() {
  if (game.mode === "versus") return Object.keys(CHARACTERS);
  return save.characters;
}
function availableBats() {
  if (game.mode !== "versus") return save.bats;
  return Object.keys(BATS).filter(function (id) {
    return !BATS[id].versusLocked || save.bats.indexOf(id) >= 0;
  });
}

// ---- Character + bat select ---------------------------------------------
function openSelect() {
  const b = boss();
  const versus = game.mode === "versus";

  document.getElementById("select-boss").innerHTML =
    (versus
      ? "<div class='who'>" + P().name + "  —  turn " + (game.turn + 1) + " of " + game.playerCount + "</div>" +
        "<div class='blurb'>Pitching: " + b.pitchers.map(function (p) { return p.emoji; }).join(" ") +
        " <b>" + b.name + "</b> at " + field().name + ".<br>" + b.blurb + "</div>" +
        "<div class='goal'>Hit it as far as you can in 10 pitches</div>"
      : "<div class='who'>" + b.pitchers.map(function (p) { return p.emoji; }).join(" ") + "  " + b.name + "</div>" +
        "<div class='blurb'>" + b.blurb + "</div>" +
        "<div class='goal'>Beat " + b.target.toLocaleString() + " ft in 10 pitches" +
        (game.replay ? "  (replay)" : "") + "</div>");

  buildTiles("pick-characters", CHARACTERS, availableCharacters(), P().characterId, function (id) {
    P().characterId = id;
    openSelect();
  });
  document.getElementById("joke-character").textContent = character().joke;

  buildTiles("pick-bats", BATS, availableBats(), P().batId, function (id) {
    P().batId = id;
    openSelect();
  });
  document.getElementById("joke-bat").textContent = bat().joke;

  document.getElementById("btn-select-back").textContent = versus ? "← Back" : "← Lineup";
  showScreen("screen-select");
}

function buildTiles(containerId, table, unlockedList, selectedId, onPick) {
  const box = document.getElementById(containerId);
  box.innerHTML = "";
  Object.keys(table).forEach(function (id) {
    const item = table[id];
    const unlocked = unlockedList.indexOf(id) >= 0;
    const btn = document.createElement("button");
    btn.className = "tile" + (id === selectedId ? " on" : "") + (unlocked ? "" : " locked");
    btn.innerHTML = "<div class='face'>" + item.emoji + "</div><div class='nm'>" +
      (unlocked ? item.name : "🔒 Locked") + "</div>";
    if (unlocked) btn.addEventListener("click", function () { onPick(id); });
    box.appendChild(btn);
  });
}

/* ==========================================================================
   4b. Versus mode - pass and play
   ========================================================================== */

let versusNames = VERSUS.defaultNames.slice();

function openVersusSetup(keepNames) {
  game.mode = "versus";
  if (!keepNames) versusNames = VERSUS.defaultNames.slice();

  // Player count buttons
  const counts = document.getElementById("versus-counts");
  counts.innerHTML = "";
  for (let n = VERSUS.minPlayers; n <= VERSUS.maxPlayers; n++) {
    const b = document.createElement("button");
    b.className = "count" + (n === game.playerCount ? " on" : "");
    b.textContent = n;
    b.addEventListener("click", (function (count) {
      return function () {
        sfx.click();
        readVersusNames();
        game.playerCount = count;
        openVersusSetup(true);
      };
    })(n));
    counts.appendChild(b);
  }

  // Name boxes
  const names = document.getElementById("versus-names");
  names.innerHTML = "";
  for (let i = 0; i < game.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "namerow";
    row.innerHTML = "<span class='num'>" + (i + 1) + "</span>";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = VERSUS.maxNameLength;
    input.value = versusNames[i] || VERSUS.defaultNames[i];
    input.placeholder = VERSUS.defaultNames[i];
    input.autocomplete = "off";
    input.dataset.index = i;
    row.appendChild(input);
    names.appendChild(row);
  }

  showScreen("screen-versus-setup");
}

function readVersusNames() {
  document.querySelectorAll("#versus-names input").forEach(function (input) {
    const i = Number(input.dataset.index);
    const v = input.value.trim();
    versusNames[i] = v || VERSUS.defaultNames[i];
  });
}

function startVersusGame() {
  readVersusNames();
  players = [];
  for (let i = 0; i < game.playerCount; i++) {
    const p = makePlayer(versusNames[i]);
    p.played = false;
    players.push(p);
  }
  currentPlayer = 0;
  game.turn = 0;
  game.mode = "versus";
  game.replay = true;                 // versus never touches the ladder
  if (VERSUS.bossMode === "sameForAll") game.bossId = pick(BOSS_LADDER);
  showPassScreen();
}

// "Pass the phone to Ana"
function showPassScreen() {
  if (VERSUS.bossMode === "randomEachTurn") game.bossId = pick(BOSS_LADDER);
  currentPlayer = game.turn;
  const b = boss();
  document.getElementById("pass-who").innerHTML =
    "<div class='bigface'>" + CHARACTERS[P().characterId].emoji + "</div>" +
    "<div class='whoname'>" + escapeHtml(P().name) + "</div>" +
    "<div class='whoturn'>you're up — turn " + (game.turn + 1) + " of " + game.playerCount + "</div>" +
    "<div class='whoboss'>Pitching: " + b.pitchers.map(function (p) { return p.emoji; }).join(" ") +
    " <b>" + b.name + "</b><br>at " + field().name + "</div>";
  showScreen("screen-versus-pass");
}

// One player has finished their ten pitches.
function endTurn() {
  const p = P();
  p.played = true;
  const last = game.turn >= game.playerCount - 1;

  document.getElementById("vturn-title").textContent = escapeHtml(p.name) + "'S TURN IS OVER";
  document.getElementById("vturn-stats").innerHTML =
    "<span class='big-num'>" + Math.round(p.totalDistance).toLocaleString() + " ft</span>" +
    "with the " + BATS[p.batId].emoji + " " + BATS[p.batId].name + "<br>" +
    "Longest bomb: <b>" + Math.round(p.bestHit) + " ft</b>";

  const done = players.filter(function (x) { return x.played; })
                      .slice().sort(function (a, b) { return b.totalDistance - a.totalDistance; });
  document.getElementById("vturn-standings").innerHTML = done.length > 1
    ? "So far:<br>" + done.map(function (x, i) {
        return (i + 1) + ". " + escapeHtml(x.name) + " — " + Math.round(x.totalDistance).toLocaleString() + " ft";
      }).join("<br>")
    : "";

  document.getElementById("btn-vturn-next").textContent =
    last ? "SEE THE SCORES" : "PASS TO " + players[game.turn + 1].name.toUpperCase();
  showScreen("screen-versus-turn");
}

function nextTurn() {
  if (game.turn >= game.playerCount - 1) { showVersusResults(); return; }
  game.turn++;
  showPassScreen();
}

function showVersusResults() {
  const ranked = players.slice().sort(function (a, b) { return b.totalDistance - a.totalDistance; });
  const winner = ranked[0];
  const tied = ranked.filter(function (p) { return p.totalDistance === winner.totalDistance; });

  document.getElementById("versus-winner").innerHTML = tied.length > 1
    ? "🏆 IT'S A TIE!<div class='sub'>" + tied.map(function (p) { return escapeHtml(p.name); }).join(" and ") + "</div>"
    : "🏆 " + escapeHtml(winner.name) + " WINS!<div class='sub'>" +
      Math.round(winner.totalDistance).toLocaleString() + " ft, longest bomb " +
      Math.round(winner.bestHit) + " ft</div>";

  let rows = "<table class='scoretable'><tr><th></th><th>WHO</th><th></th><th style='text-align:right'>TOTAL</th><th style='text-align:right'>BEST</th></tr>";
  ranked.forEach(function (p, i) {
    const isWin = p.totalDistance === winner.totalDistance;
    rows += "<tr class='" + (isWin ? "win" : "") + "'>" +
      "<td class='rk'>" + (isWin ? "🏆" : (i + 1)) + "</td>" +
      "<td class='nm'>" + escapeHtml(p.name) + "</td>" +
      "<td class='kit'>" + CHARACTERS[p.characterId].emoji + BATS[p.batId].emoji + "</td>" +
      "<td class='ft'>" + Math.round(p.totalDistance).toLocaleString() + "</td>" +
      "<td class='lg'>" + Math.round(p.bestHit) + "</td></tr>";
  });
  rows += "</table>";
  document.getElementById("versus-table").innerHTML = rows;

  sfx.win();
  showScreen("screen-versus-results");
}

// Same players, fresh scores
function replayVersus() {
  players.forEach(function (p) {
    p.totalDistance = 0; p.bestHit = 0; p.hitCount = 0; p.swings = []; p.played = false;
  });
  game.turn = 0;
  currentPlayer = 0;
  if (VERSUS.bossMode === "sameForAll") game.bossId = pick(BOSS_LADDER);
  showPassScreen();
}

// Best total among the players who have already had their turn, or null if
// you're the first one up.
function versusLeader() {
  let best = null;
  for (let i = 0; i < players.length; i++) {
    if (players[i].played && (best === null || players[i].totalDistance > best)) {
      best = players[i].totalDistance;
    }
  }
  return best;
}

// Back to single player
function leaveVersus() {
  game.mode = "solo";
  game.replay = false;
  players = [soloPlayer];
  currentPlayer = 0;
  game.bossId = BOSS_LADDER[Math.min(save.ladderIndex, BOSS_LADDER.length - 1)];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// ---- Settings ------------------------------------------------------------
// Settings can be opened from several places, so remember where to go back to.
let settingsBackTo = "screen-ladder";

function openSettings() {
  const vis = Array.prototype.find.call(document.querySelectorAll(".screen"), function (s) {
    return !s.classList.contains("hidden");
  });
  if (vis && vis.id !== "screen-settings") settingsBackTo = vis.id;

  const sb = document.getElementById("btn-sound");
  sb.textContent = SOUND.enabled ? "🔊  SOUND: ON" : "🔇  SOUND: OFF";
  document.getElementById("settings-info").innerHTML =
    "Bosses beaten: <b>" + save.ladderIndex + " / " + BOSS_LADDER.length + "</b><br>" +
    "Bats unlocked: <b>" + save.bats.length + " / " + Object.keys(BATS).length + "</b><br>" +
    "Characters unlocked: <b>" + save.characters.length + " / " + Object.keys(CHARACTERS).length + "</b><br>" +
    "Longest hit ever: <b>" + Math.round(save.best) + " ft</b><br>" +
    "Best round ever: <b>" + Math.round(save.bestRound) + " ft</b>";
  showScreen("screen-settings");
}

// ---- Wiring --------------------------------------------------------------
// Every menu button makes a click and wakes the audio up (browsers require a
// tap before they'll let a page make any noise at all).
function onTap(id, fn) {
  document.getElementById(id).addEventListener("click", function () {
    wakeAudio();
    sfx.click();
    fn();
  });
}

onTap("btn-play", function () { leaveVersus(); buildLadder(); });
onTap("btn-ladder-back", function () { showScreen("screen-title"); });
onTap("btn-select-back", function () {
  if (game.mode === "versus") showPassScreen();
  else buildLadder();
});
onTap("btn-start", startRound);
onTap("btn-victory-ok", buildLadder);
onTap("btn-settings-back", function () {
  if (settingsBackTo === "screen-versus-setup") openVersusSetup(true);
  else if (settingsBackTo === "screen-versus-results") showVersusResults();
  else if (settingsBackTo === "screen-versus-pass") showPassScreen();
  else if (settingsBackTo === "screen-versus-turn") showScreen("screen-versus-turn");
  else if (settingsBackTo === "screen-title") showScreen("screen-title");
  else if (settingsBackTo === "screen-select") openSelect();
  else buildLadder();
});

// Versus
onTap("btn-versus", function () { openVersusSetup(false); });
onTap("btn-versus-back", function () { leaveVersus(); showScreen("screen-title"); });
onTap("btn-versus-start", startVersusGame);
onTap("btn-pass-ready", openSelect);
onTap("btn-vturn-next", nextTurn);
onTap("btn-versus-again", replayVersus);
onTap("btn-versus-newplayers", function () { openVersusSetup(true); });
onTap("btn-versus-title", function () { leaveVersus(); showScreen("screen-title"); });
onTap("btn-reset", function () { resetSave(); writeSave(); openSettings(); });
onTap("btn-sound", function () { setSound(!SOUND.enabled); openSettings(); });

onTap("btn-resume", resumeGame);
onTap("btn-pause-restart", function () { resumeGame(); startRound(); });
onTap("btn-pause-quit", function () {
  resumeGame();
  if (game.mode === "versus") { leaveVersus(); showScreen("screen-title"); }
  else buildLadder();
});
document.getElementById("btn-pause-sound").addEventListener("click", function () {
  setSound(!SOUND.enabled);
  sfx.click();
  document.getElementById("btn-pause-sound").textContent = SOUND.enabled ? "🔊 SOUND" : "🔇 MUTED";
});

gear.addEventListener("click", function () {
  wakeAudio();
  sfx.click();
  if (game.state !== "menu" && !game.paused) pauseGame();
  else openSettings();
});

showScreen("screen-title");


/* ==========================================================================
   5. Round flow
   ========================================================================== */

function startRound() {
  const p = P();
  p.totalDistance = 0;
  p.bestHit = 0;
  p.hitCount = 0;
  p.swings = [];
  game.pitchNumber = 0;
  game.warnings = 0;
  game.dropsInARow = 0;
  game.pitcherIndex = 0;
  clearFx();
  hideScreens();
  wakeAudio();
  nextPitch();
}

function clearFx() {
  fx.desserts = [];
  fx.dessertTimer = 0;
  fx.lights = 0;
  fx.lick = 0;
  fx.charge = 0;
  fx.speech = ""; fx.speechTimer = 0;
  fx.message = ""; fx.messageTimer = 0;
  fx.chase = null; fx.chaseCaught = 0;
  fx.shake = 0; fx.flash = 0; fx.crowdJump = 0;
  particles.length = 0;
}

// Who is on the mound for this pitch?
function choosePitcher() {
  const b = boss();
  if (b.mode === "alternate") return (game.pitchNumber - 1) % b.pitchers.length;
  if (b.mode === "random") return Math.floor(Math.random() * b.pitchers.length);
  return 0;
}

function nextPitch() {
  if (game.pitchNumber >= CONFIG.pitchesPerRound) { endRound(); return; }
  game.pitchNumber++;
  game.pitcherIndex = choosePitcher();
  result.show = false;

  const pit = pitcher();
  let pitchId = pit.pitches[Math.floor(Math.random() * pit.pitches.length)];
  let speedMod = pit.speedMod;
  let windowBonus = pit.windowBonus;

  // ---- Georgia is the chaos engine -------------------------------------
  fx.charge = 0;
  if (pit.special === "chaos") {
    // She just dropped it. That doesn't count as one of your ten - but she is
    // never allowed to drop it twice in a row, or the round would never end.
    if (game.dropsInARow < 1 && Math.random() < (pit.dropChance || 0)) {
      game.dropsInARow++;
      game.pitchNumber--;
      showMessage("Georgia dropped the ball.", 1.4);
      game.state = "between";
      game.timer = 1.4;
      return;
    }
    game.dropsInARow = 0;
    if (Math.random() < (pit.chargeChance || 0)) {
      // She has decided to bring it to you personally.
      pitchId = "watermelon";
      speedMod = 0.55;
      windowBonus = 1.35;
      fx.charge = 1;
      showMessage("GEORGIA IS RUNNING AT YOU", 1.2);
    } else {
      speedMod *= 0.55 + Math.random() * 1.15;   // wildly inconsistent
    }
    if (Math.random() < (pit.lickChance || 0)) fx.lick = 1.2;
  }

  const pitch = PITCHES[pitchId];
  ball.pitchId = pitchId;
  ball.seconds = pitch.seconds * speedMod;
  ball.windowMod = pitch.windowMod * windowBonus;
  ball.sideMod = pit.sideBreakMod || 1;
  ball.hideUntil = pit.special === "hideBall" ? (pit.hideUntil || 0) : 0;
  ball.t = -1;
  ball.dist = CONFIG.mountFeet;
  ball.height = 5;
  ball.side = 0;
  ball.hit = false;
  ball.flightTime = 0;

  swing.charging = false;
  swing.meter = 0;
  swing.done = false;
  swing.anim = 0;
  swing.dropped = false;
  swing.slipped = false;

  result.show = false;
  fx.chase = null;
  fx.chaseCaught = 0;
  camFeet = 0;
  camScale = CONFIG.pitchScale;

  // Chatter on the way in
  const during = pit.lines && pit.lines.during;
  if (during && (pit.special === "desserts" || Math.random() < 0.55)) {
    fx.speech = pick(during);
    fx.speechTimer = CONFIG.windupSeconds + ball.seconds;
  }

  game.state = "windup";
  game.timer = CONFIG.windupSeconds;
}

function endRound() {
  if (game.mode === "versus") { endTurn(); return; }

  const p = P();
  const b = boss();
  const won = p.totalDistance >= b.target;
  const ladderPos = BOSS_LADDER.indexOf(game.bossId);
  const isLadderBoss = ladderPos === save.ladderIndex;

  if (p.bestHit > save.best) save.best = p.bestHit;
  if (p.totalDistance > save.bestRound) save.bestRound = p.totalDistance;

  let unlockHtml = "";
  let finalWin = false;

  if (won && isLadderBoss) {
    save.ladderIndex = ladderPos + 1;
    if (b.unlocks && save.bats.indexOf(b.unlocks) < 0) {
      save.bats.push(b.unlocks);
      const nb = BATS[b.unlocks];
      unlockHtml += "<span class='unlock'>NEW BAT UNLOCKED<br><b>" + nb.emoji + " " + nb.name +
        "</b><br><i>" + nb.joke + "</i></span>";
    }
    if (b.unlocksCharacters) {
      b.unlocksCharacters.forEach(function (c) {
        if (save.characters.indexOf(c) < 0) save.characters.push(c);
      });
      unlockHtml += "<span class='unlock'>NEW BATTERS UNLOCKED<br><b>" +
        b.unlocksCharacters.map(function (c) { return CHARACTERS[c].emoji + " " + CHARACTERS[c].name; }).join("<br>") +
        "</b><br><i>They hold the bat in their mouth. Obviously.</i></span>";
    }
    if (b.isFinal) finalWin = true;
  }
  writeSave();

  if (won) {
    sfx.win();
    if (unlockHtml) setTimeout(function () { sfx.unlock(); }, 700);
    spawnParticles(W / 2, H * 0.35, 46, {
      emojis: ["🎉", "🎊", "⭐", "✨", "🏆"],
      speed: 380, gravity: 420, life: 1.4, size: 24, spread: Math.PI * 2, jitter: 160,
    });
  } else {
    sfx.lose();
  }

  // ---- The screen ------------------------------------------------------
  document.getElementById("round-title").textContent = won ? "YOU WIN!" : "NOT QUITE";
  document.getElementById("round-stats").innerHTML =
    "<span class='big-num" + (won ? "" : " miss") + "'>" + Math.round(p.totalDistance).toLocaleString() + " ft</span>" +
    "you needed <b>" + b.target.toLocaleString() + " ft</b><br>" +
    "Longest bomb: <b>" + Math.round(p.bestHit) + " ft</b>";

  const closer = pick(pitcher().lines[won ? "win" : "lose"]);
  let extra = "<i>" + closer + "</i>";
  if (won && game.bossId === "matt") {
    extra += "<br><br>Uncle Matt puts you in handcuffs. They are the plastic ones from a Halloween costume. " +
      "You take them off. He nods once and gives you the baguette.";
  }
  extra += unlockHtml;
  document.getElementById("round-extra").innerHTML = extra;

  const row = document.getElementById("round-buttons");
  row.innerHTML = "";
  addButton(row, won ? "PLAY AGAIN" : "TRY AGAIN", "big", startRound);
  addButton(row, "← Lineup", "small ghost", buildLadder);

  if (finalWin) {
    document.getElementById("victory-text").innerHTML =
      "You beat Nana, Pop, Pat, Joey, Uncle Matt and all three dogs.<br><br>" +
      "<b>Zeus, Dottie and Georgia are now playable batters.</b><br>" +
      "They hold the bat in their mouth, which should not work, and yet.<br><br>" +
      "Every boss stays open. Go back and hit some more.";
    showScreen("screen-victory");
  } else {
    showScreen("screen-round");
  }
}

function addButton(parent, label, cls, fn) {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", fn);
  parent.appendChild(b);
}


/* ==========================================================================
   6. Input
   ========================================================================== */

function pressDown() {
  if (game.paused) return;
  swing.held = true;
  if (game.state === "incoming" && !swing.done) swing.charging = true;
  else if (game.state === "result") finishResult();
}

function pressUp() {
  if (game.paused) return;
  swing.held = false;
  if (swing.charging) { swing.charging = false; doSwing(); }
}

canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); wakeAudio(); pressDown(); });
window.addEventListener("pointerup", function () { pressUp(); });
window.addEventListener("pointercancel", function () { pressUp(); });
// Somebody typing their name into a box is not trying to swing a bat.
function typingInABox(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

window.addEventListener("keydown", function (e) {
  if (typingInABox(e)) return;
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat) pressDown(); }
  if (e.code === "KeyP" || e.code === "Escape") {
    e.preventDefault();
    if (!e.repeat && (game.state !== "menu" || game.paused)) { wakeAudio(); togglePause(); }
  }
});
window.addEventListener("keyup", function (e) {
  if (typingInABox(e)) return;
  if (e.code === "Space") { e.preventDefault(); pressUp(); }
});


/* ==========================================================================
   7. The swing
   ========================================================================== */

function doSwing() {
  if (swing.done) return;
  swing.done = true;
  swing.anim = 0.0001;

  const ch = character();
  const bt = bat();
  const p = P();

  // ---- Timing ----------------------------------------------------------
  const errMs = (ball.t - 1) * ball.seconds * 1000;      // negative = early
  const absErr = Math.abs(errMs);

  const windowMod = bt.windowMod * ch.windowMod * ball.windowMod;
  const perfect = CONFIG.perfectMs * windowMod;
  const good = CONFIG.goodMs * windowMod;
  const contact = CONFIG.contactMs * windowMod;

  let quality, timingWord;
  if (absErr <= perfect) {
    quality = 1.0;
    timingWord = "SWEET SPOT!";
  } else if (absErr <= good) {
    quality = lerp(0.90, 0.55, (absErr - perfect) / (good - perfect));
    timingWord = errMs < 0 ? "A touch early" : "A touch late";
  } else if (absErr <= contact) {
    quality = lerp(0.50, 0.14, (absErr - good) / (contact - good));
    timingWord = errMs < 0 ? "Way early" : "Way late";
  } else {
    quality = 0;
    timingWord = errMs < 0 ? "Swung at nothing" : "Never saw it";
  }
  const sweet = quality >= 0.999;

  // ---- Power -----------------------------------------------------------
  const meter = swing.meter;
  const power = meter <= 1 ? CONFIG.minPower + (1 - CONFIG.minPower) * meter : 1.0;
  let overswing = 0;
  if (meter > 1) {
    overswing = (meter - 1) / (CONFIG.meterMax - 1);
    quality *= 1 - overswing * CONFIG.overswingPenalty;
  }

  // ---- Character quirks ------------------------------------------------
  if (Math.random() < ch.dropChance) {
    swing.dropped = true;                 // Georgia lost the bat. It's fine.
    quality *= 0.85;
  }

  // ---- Bat quirks ------------------------------------------------------
  // Frozen fish sometimes leaves your hands. Pure comedy, no penalty.
  if (bt.slipChance && Math.random() < bt.slipChance) swing.slipped = true;
  // Baguette gets weaker every time you hit with it this round.
  const crumble = bt.crumble ? Math.max(0.35, 1 - bt.crumble * p.hitCount) : 1;

  // ---- Whiff -----------------------------------------------------------
  if (quality <= 0.02) {
    sfx.whiff();
    spawnParticles(W / 2, CONFIG.plateY - 40, 8, {
      emojis: ["💨"], speed: 190, gravity: 260, life: 0.5, size: 20,
    });
    recordSwing(0, overswing > 0.35 ? "You swung out of your shoes" : timingWord, false);
    return;
  }

  // ---- Distance --------------------------------------------------------
  const chaosBonus = ch.chaos > 0 ? georgiaBonus(ch) : 1;
  const luck = CONFIG.luckMin + Math.random() * (CONFIG.luckMax - CONFIG.luckMin);
  const sweetBonus = (sweet && bt.sweetBonus) ? bt.sweetBonus : 1;

  let dist = CONFIG.baseDistance
    * power
    * Math.pow(quality, CONFIG.qualityCurve)
    * bt.power * crumble * sweetBonus
    * ch.powerMod
    * PITCHES[ball.pitchId].distance
    * chaosBonus * luck;
  // Wild bats slice one foul now and then. That's the price of the payoff.
  const mishit = Math.random() < (1 - bt.accuracy) * CONFIG.mishitChance;
  if (mishit) dist *= CONFIG.mishitKeep;

  dist = Math.max(4, dist);
  p.hitCount++;

  // ---- Launch ----------------------------------------------------------
  let angle = bt.lineDriveAngle
    ? bt.lineDriveAngle + (Math.random() * 6 - 3)     // frying pan: flat screamers
    : CONFIG.launchAngleBase - errMs * CONFIG.launchAnglePerMs;
  angle = clamp(angle, CONFIG.launchAngleMin, CONFIG.launchAngleMax);
  launchBall(dist, angle, quality, bt.accuracy);

  // Dottie might go get it.
  const pit = pitcher();
  if (pit.special === "chases" && dist > 140 && Math.random() < (pit.chaseChance || 0)) {
    fx.chase = { catchDist: dist * (0.45 + Math.random() * 0.28) };
  }

  // ---- Contact juice ---------------------------------------------------
  const cx = W / 2, cy = CONFIG.plateY - 40;
  const intensity = hitIntensity(dist);
  sfx.hit(P().batId, sweet && !mishit, intensity);

  spawnParticles(cx, cy, JUICE.contactParticles, {
    emojis: BAT_DEBRIS[P().batId] || BAT_DEBRIS.regular,
    speed: 200 + 320 * intensity, gravity: 780, life: 0.6, size: 16 + 12 * intensity,
  });
  if (sweet && !mishit) {
    fx.flash = 0.22;
    spawnParticles(cx, cy, JUICE.sweetParticles, {
      emojis: ["✨", "⭐", "💫"], speed: 340, gravity: 420, life: 0.8, size: 22,
    });
  }
  addShake(JUICE.shakeMax * intensity + (bt.lineDriveAngle ? JUICE.shakeOnClang : 0));

  result.sweet = sweet && !mishit;
  result.sub = (mishit ? "Sliced it foul" : timingWord)
    + (swing.dropped ? "  (bat went flying)" : "")
    + (swing.slipped ? "  (the fish escaped)" : "")
    + (overswing > 0.35 ? "  (overswing!)" : "");
  game.state = "flight";
}

// Georgia: usually a small nudge, occasionally completely unhinged.
function georgiaBonus(ch) {
  if (Math.random() < (ch.chaosJackpot || 0)) return 1 + ch.chaos * (ch.chaosJackpotBonus || 3);
  return 1 + (Math.random() * 2 - 0.7) * ch.chaos;
}

function launchBall(targetDist, angleDeg, quality, accuracy) {
  const a = angleDeg * Math.PI / 180;
  const v = Math.sqrt(Math.max(1, targetDist * CONFIG.gravity / Math.max(0.05, Math.sin(2 * a))));
  const ts = CONFIG.flightTimeScale;
  ball.dist = 0;
  ball.height = 3.5;
  ball.side = 0;
  ball.vDist = v * Math.cos(a) / ts;
  ball.vHeight = v * Math.sin(a) / ts;
  ball.vSide = (Math.random() * 2 - 1) * targetDist * CONFIG.spraySpread
             * (1 - quality) / Math.max(0.2, accuracy) / Math.max(0.4, ts);
  ball.hit = true;
  ball.flightTime = 0;
}

function flightGravity() {
  const ts = CONFIG.flightTimeScale;
  return CONFIG.gravity / (ts * ts);
}

function recordSwing(dist, timingWord, sweet, headlineOverride) {
  const p = P();
  p.swings.push(dist);
  p.totalDistance += dist;
  if (dist > p.bestHit) p.bestHit = dist;

  const pit = pitcher();

  // Uncle Matt takes big homers personally.
  if (pit.special === "citations" && dist >= CONFIG.citationFeet) {
    fx.lights = CONFIG.citationSeconds;
    sfx.siren();
    if (game.warnings < pit.warnings.length) {
      showMessage(pit.warnings[game.warnings], 2.2);
      game.warnings++;
    }
  }

  // The crowd has opinions.
  if (dist <= 0) sfx.groan();
  else if (dist < 100) sfx.crowd(0.12);
  else sfx.crowd(0.25 + 0.75 * hitIntensity(dist));
  if (dist >= fenceFeet()) fx.crowdJump = 1.6;   // it left the yard - everybody up

  const lm = landmarkFor(dist);
  result.show = true;
  result.distance = dist;
  result.headline = headlineOverride || lm.text;
  result.landmarkEmoji = headlineOverride ? "" : lm.emoji;
  result.announcer = pick(ANNOUNCER[announcerBucket(dist)]);
  result.sub = timingWord;
  result.sweet = sweet;
  result.taunt = tauntFor(dist);
  game.state = "result";
  game.timer = CONFIG.resultSeconds;
}

function tauntFor(dist) {
  const pit = pitcher();
  if (!pit.lines) return "";
  let bucket = "whiff";
  if (dist >= CONFIG.citationFeet) bucket = "homer";
  else if (dist >= 150) bucket = "good";
  else if (dist > 0) bucket = "weak";

  // Pat and Joey get nastier the better you're doing.
  if (pit.meanLines) {
    const pace = P().totalDistance / Math.max(1, game.pitchNumber);
    if (pace > boss().target / CONFIG.pitchesPerRound && Math.random() < 0.5) return pick(pit.meanLines);
  }
  return pick(pit.lines[bucket] || pit.lines.weak || []);
}

function finishResult() {
  if (game.state !== "result") return;
  game.state = "between";
  game.timer = 0;
  nextPitch();
}

// Where did it land? The close-in landmarks are shared; anything that clears
// the fence uses the current field's own list. Built once per field and cached.
const landmarkCache = {};
function landmarkList() {
  const id = boss().field;
  if (!landmarkCache[id]) {
    const own = field().landmarks;
    const firstOwn = own.length ? own[0].min : Infinity;
    landmarkCache[id] = NEAR_LANDMARKS.filter(function (n) { return n.min < firstOwn; }).concat(own);
  }
  return landmarkCache[id];
}

function landmarkFor(dist) {
  const list = landmarkList();
  let found = list[0];
  for (let i = 0; i < list.length; i++) {
    if (dist >= list[i].min) found = list[i];
  }
  return found;
}

function announcerBucket(dist) {
  if (dist <= 0) return "whiff";
  if (dist < 100) return "weak";
  if (dist < 240) return "solid";
  if (dist < 420) return "big";
  return "monster";
}

function showMessage(text, seconds) {
  fx.message = text;
  fx.messageTimer = seconds;
}


/* ==========================================================================
   8. Update
   ========================================================================== */

function update(dt) {
  if (game.paused) return;      // the world stops, the drawing carries on
  updateFx(dt);

  if (swing.anim > 0) {
    swing.anim += dt / CONFIG.swingSeconds;
    if (swing.anim > 1) swing.anim = 0;
  }

  if (game.state === "menu") return;

  if (game.state === "between") {
    game.timer -= dt;
    if (game.timer <= 0) nextPitch();
    return;
  }

  if (game.state === "windup") {
    game.timer -= dt;
    if (game.timer <= 0) {
      game.state = "incoming";
      ball.t = 0;
      sfx.pitchThrow();
      if (swing.held) swing.charging = true;
    }
    return;
  }

  if (game.state === "incoming") {
    const pitch = PITCHES[ball.pitchId];
    ball.t += dt / ball.seconds;
    ball.dist = CONFIG.mountFeet * (1 - pitchPos(pitch, ball.t));
    ball.side = pitchSide(pitch, ball.t);

    if (swing.charging) {
      const rate = swing.meter < 1 ? 1 : CONFIG.overchargeSpeed;
      swing.meter += (dt / CONFIG.chargeSeconds) * character().chargeSpeed * rate;
      if (swing.meter > CONFIG.meterMax) swing.meter = CONFIG.meterMax;
    }

    if (ball.t >= CONFIG.lateCutoff) {
      if (swing.charging) { swing.charging = false; doSwing(); }
      else if (!swing.done) {
        swing.done = true;
        sfx.strike();
        recordSwing(0, "You watched it go by", false, "STRIKE!");
      }
    }
    return;
  }

  if (game.state === "flight") {
    ball.flightTime += dt;
    ball.dist += ball.vDist * dt;
    ball.side += ball.vSide * dt;
    ball.vHeight -= flightGravity() * dt;
    ball.height += ball.vHeight * dt;

    // Dottie runs it down and drags it back to earth.
    if (fx.chase && ball.dist >= fx.chase.catchDist) {
      const d = fx.chase.catchDist;
      fx.chaseCaught = 2.0;
      fx.chase = null;
      ball.dist = d;
      ball.height = 0;
      sfx.bark();
      spawnParticles(worldX(ball.side), worldY(d, 0), 12, {
        emojis: ["💨", "🐾"], speed: 200, gravity: 500, life: 0.6, size: 18,
      });
      recordSwing(d, "Dottie got there first", false, "DOTTIE GOT IT!");
      updateCamera(dt);
      return;
    }

    if (ball.height <= 0) {
      ball.height = 0;
      const d = Math.max(0, ball.dist);
      const inten = hitIntensity(d);
      sfx.land(d);
      spawnParticles(worldX(ball.side), worldY(d, 0), JUICE.landingParticles, {
        color: d >= fenceFeet() ? "#9aa2ad" : "#8fd46a",
        speed: 120 + 220 * inten, gravity: 620, life: 0.5, size: 14,
      });
      addShake(JUICE.shakeMax * inten * 0.7);
      recordSwing(d, result.sub, result.sweet);
    }
    updateCamera(dt);
    return;
  }

  if (game.state === "result") {
    if (!ball.hit) {
      const pitch = PITCHES[ball.pitchId];
      ball.t += dt / ball.seconds;
      ball.dist = CONFIG.mountFeet * (1 - pitchPos(pitch, ball.t));
    }
    updateCamera(dt);
    game.timer -= dt;
    if (game.timer <= 0) finishResult();
    return;
  }
}

function updateFx(dt) {
  fx.lights = Math.max(0, fx.lights - dt);
  fx.lick = Math.max(0, fx.lick - dt);
  fx.speechTimer = Math.max(0, fx.speechTimer - dt);
  fx.messageTimer = Math.max(0, fx.messageTimer - dt);
  fx.chaseCaught = Math.max(0, fx.chaseCaught - dt);
  fx.flash = Math.max(0, fx.flash - dt);
  fx.crowdJump = Math.max(0, fx.crowdJump - dt);
  fx.shake = Math.max(0, fx.shake - fx.shake * JUICE.shakeDecay * dt - dt * 6);
  updateParticles(dt);

  // Nana's dessert parade
  const playing = game.state !== "menu";
  if (playing && pitcher().special === "desserts") {
    fx.dessertTimer -= dt;
    if (fx.dessertTimer <= 0) {
      fx.dessertTimer = 0.45 + Math.random() * 0.5;
      const fromLeft = Math.random() < 0.5;
      fx.desserts.push({
        emoji: pick(DESSERTS),
        x: fromLeft ? -60 : W + 60,
        y: 150 + Math.random() * 520,
        vx: (fromLeft ? 1 : -1) * (55 + Math.random() * 95),
        vy: (Math.random() - 0.5) * 25,
        size: 34 + Math.random() * 34,
        spin: (Math.random() - 0.5) * 2,
        rot: 0,
      });
    }
  }
  for (let i = fx.desserts.length - 1; i >= 0; i--) {
    const d = fx.desserts[i];
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.spin * dt;
    if (d.x < -140 || d.x > W + 140) fx.desserts.splice(i, 1);
  }
}

function updateCamera(dt) {
  const z = clamp(ball.flightTime / CONFIG.zoomOutSeconds, 0, 1);
  camScale = lerp(CONFIG.pitchScale, CONFIG.flightScale, easeOut(z));
  const targetY = H * CONFIG.ballScreenSpot;
  const lead = (CONFIG.plateY - targetY) / camScale;
  let want = ball.dist + ball.height * CONFIG.heightWeight * 0.6 - lead;
  if (want < 0) want = 0;
  camFeet += (want - camFeet) * Math.min(1, dt * 9);
}

// ---- Pitch shape helpers -------------------------------------------------
function pitchPos(pitch, t) { return pitch.ease ? pitch.ease(clamp(t, 0, 3)) : t; }
function pitchSide(pitch, t) { return pitch.side ? pitch.side(t) * ball.sideMod : 0; }
function pitchHop(pitch, t) { return pitch.hop ? pitch.hop(t) : 0; }
function pitchSize(pitch, t) { return pitch.sizeMod * (pitch.shrink ? pitch.shrink(t) : 1); }


/* ==========================================================================
   9. Drawing
   ========================================================================== */

function worldY(distFeet, heightFeet) {
  return CONFIG.plateY - (distFeet - camFeet) * camScale - heightFeet * camScale * CONFIG.heightWeight;
}
function worldX(sideFeet) { return W / 2 + sideFeet * camScale; }

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Everything on the field shakes. The HUD deliberately does not, so the
  // numbers stay readable while the world is falling apart.
  ctx.save();
  if (fx.shake > 0.4) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }

  drawField();
  // While a pitch is on its way in, the pitcher is drawn LAST so his body
  // really does hide the ball. (That's Pop's whole gimmick.) Once the ball is
  // in the air it flies over him, so it goes on top instead.
  if (game.state === "incoming" || (game.state === "result" && !ball.hit)) {
    drawBall();
    drawPitcher();
  } else {
    drawPitcher();
    drawBall();
  }
  drawBatter();
  drawParticles();
  drawDesserts();
  ctx.restore();

  drawLights();
  drawLick();
  drawFlash();
  drawHUD();
}

// A white pop on a perfectly timed swing.
function drawFlash() {
  if (fx.flash <= 0) return;
  ctx.fillStyle = "rgba(255,255,255," + (0.55 * (fx.flash / 0.22)) + ")";
  ctx.fillRect(0, 0, W, H);
}

function drawField() {
  const f = field();
  const fence = f.fenceFeet;

  // ---- Sky -------------------------------------------------------------
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, f.sky[0]);
  g.addColorStop(0.5, f.sky[1]);
  g.addColorStop(1, f.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (f.stars) drawStars();

  // ---- Grass, and whatever is past the fence ---------------------------
  const stripe = CONFIG.grassStripeFeet;
  const firstStripe = Math.floor((camFeet - 40) / stripe) * stripe;
  for (let d = firstStripe; d < fence + 260; d += stripe) {
    const yTop = worldY(d + stripe, 0);
    const yBot = worldY(d, 0);
    if (yBot < -50 || yTop > H + 50) continue;
    const pair = d >= fence ? f.beyond : f.grass;
    ctx.fillStyle = (Math.round(d / stripe) % 2 === 0) ? pair[0] : pair[1];
    ctx.fillRect(0, yTop, W, yBot - yTop + 1);
  }

  // ---- Dirt around the plate -------------------------------------------
  const dirtY = worldY(2, 0);
  if (dirtY > -200 && dirtY < H + 200) {
    ctx.fillStyle = f.dirt;
    ctx.beginPath();
    ctx.ellipse(W / 2, dirtY, CONFIG.dirtCircleFeet * camScale,
                CONFIG.dirtCircleFeet * camScale * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Foul lines ------------------------------------------------------
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = Math.max(1, camScale * 0.5);
  [-1, 1].forEach(function (s) {
    ctx.beginPath();
    ctx.moveTo(worldX(0), worldY(0, 0));
    ctx.lineTo(worldX(s * fence * CONFIG.foulLineSpread), worldY(fence, 0));
    ctx.stroke();
  });

  // ---- Distance markers ------------------------------------------------
  if (camScale < CONFIG.pitchScale * 0.6) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "12px Verdana";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let d = 100; d <= 900; d += 100) {
      const y = worldY(d, 0);
      if (y > -10 && y < H + 10) ctx.fillText(d + " ft", 8, y - 8);
    }
  }

  // ---- The fence, the crowd behind it, and the lights above it ---------
  const fy = worldY(fence, 0);
  const fh = Math.max(6, 14 * camScale / CONFIG.flightScale);
  if (fy > -260 && fy < H + 60) {
    if (f.lights) drawStadiumLights(fy - fh);
    drawCrowd(fy - fh, f.crowd);
    ctx.fillStyle = f.fenceColor;
    ctx.fillRect(0, fy - fh, W, fh);
    ctx.fillStyle = f.fenceCap;
    ctx.fillRect(0, fy - fh - 3, W, 3);
    if (f.fenceText && camScale < CONFIG.pitchScale * 0.6) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px Verdana";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.fenceText, W / 2, fy - fh / 2);
    }
  }

  // ---- Everything out past the fence -----------------------------------
  for (let i = 0; i < f.scenery.length; i++) {
    emojiRow(f.scenery[i].feet, f.scenery[i].items, f.scenery[i].size);
  }
}

// Night games get a starfield. Deterministic so it doesn't crawl.
function drawStars() {
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (let i = 0; i < 60; i++) {
    const x = ((i * 137.5) % W);
    const y = ((i * 71.3) % (H * 0.55));
    const r = (i % 3 === 0) ? 1.4 : 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Four light towers behind the outfield wall.
function drawStadiumLights(fenceTopY) {
  const s = Math.max(0.35, camScale / CONFIG.flightScale);
  const towerH = 130 * s, towerW = 7 * s, bankW = 46 * s, bankH = 15 * s;
  [0.12, 0.37, 0.63, 0.88].forEach(function (frac) {
    const x = W * frac;
    const top = fenceTopY - towerH;
    ctx.fillStyle = "#20252f";
    ctx.fillRect(x - towerW / 2, top, towerW, towerH);
    ctx.fillStyle = "#fbf6cf";
    ctx.fillRect(x - bankW / 2, top - bankH, bankW, bankH);
    const glow = ctx.createRadialGradient(x, top, 0, x, top, 95 * s);
    glow.addColorStop(0, "rgba(255,250,205,0.40)");
    glow.addColorStop(1, "rgba(255,250,205,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, top, 95 * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

// A little crowd standing behind the fence. They bob along, and they all jump
// at once when something leaves the yard.
function drawCrowd(baseY, crowd) {
  if (!crowd || !crowd.count) return;
  const s = Math.max(9, 26 * camScale / CONFIG.flightScale);
  if (s < 10) return;
  const now = performance.now() / 1000;
  const rows = crowd.rows || 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = s + "px serif";
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < crowd.count; i++) {
      const n = r * crowd.count + i;
      const x = (i + 0.5 + (r % 2) * 0.5) * (W / crowd.count);
      const bob = Math.sin(now * 2.2 + n * 1.7) * s * 0.06;
      const jump = fx.crowdJump > 0
        ? Math.abs(Math.sin((1.6 - fx.crowdJump) * 11 + n * 0.5)) * fx.crowdJump * s * 0.55
        : 0;
      ctx.fillText(crowd.emoji[n % crowd.emoji.length], x, baseY - r * s * 0.55 + bob - jump);
    }
  }
}

function emojiRow(distFeet, list, size) {
  const y = worldY(distFeet, 0);
  if (y < -60 || y > H + 60) return;
  const s = Math.max(10, size * camScale / CONFIG.flightScale);
  ctx.font = s + "px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < list.length; i++) {
    ctx.fillText(list[i], (i + 0.5) * (W / list.length), y - s * 0.4);
  }
}

function drawPitcher() {
  const pit = pitcher();
  const y = worldY(CONFIG.mountFeet, 0);
  if (y < -300 || y > H + 60) return;
  const s = 90 * pit.size * camScale / CONFIG.pitchScale;
  if (s < 6) return;

  let lean = 0;
  if (game.state === "windup") {
    const p = 1 - clamp(game.timer / CONFIG.windupSeconds, 0, 1);
    lean = Math.sin(p * Math.PI * 2) * 10;
  }

  ctx.fillStyle = "#b9793f";
  ctx.beginPath();
  ctx.ellipse(W / 2, y, s * 0.9, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pop gets an actual body, because a head alone can't hide a baseball.
  const wall = pit.special === "hideBall";
  if (wall) {
    ctx.fillStyle = pit.bodyColor || "#3f6ea8";
    ctx.beginPath();
    ctx.ellipse(W / 2 + lean * 0.4, y - s * 0.10, s * 0.62, s * 0.80, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(W / 2 + lean, y - s * 0.45);
  ctx.font = s + "px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pit.emoji, 0, 0);
  ctx.restore();

  const labelY = wall ? y + s * 0.72 : y + 6;
  if (camScale > CONFIG.pitchScale * 0.7) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(W / 2 - 90, labelY, 180, 22);
    ctx.fillStyle = "#ffe14d";
    ctx.font = "bold 14px Verdana";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pit.name, W / 2, labelY + 11);
  }

  // Speech bubble
  if (fx.speechTimer > 0 && fx.speech && camScale > CONFIG.pitchScale * 0.7) {
    bubble(fx.speech, W / 2, labelY + 38);
  }

  // Georgia sprinting the ball at you
  if (fx.charge && game.state === "incoming") {
    const t = clamp(ball.t, 0, 1);
    ctx.font = (60 + 70 * t) + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🐩", W / 2 + Math.sin(ball.t * 14) * 26, lerp(y, CONFIG.plateY - 90, t));
  }
}

function bubble(text, cx, topY) {
  ctx.font = "bold 14px Verdana";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.min(W - 30, ctx.measureText(text).width + 26);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(cx - w / 2, topY, w, 30, 8);
  ctx.fill();
  ctx.fillStyle = "#1a2230";
  ctx.fillText(text, cx, topY + 15);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBall() {
  if (game.state !== "incoming" && game.state !== "flight" && game.state !== "result") return;

  // Still on its way in
  if (!ball.hit) {
    const pitch = PITCHES[ball.pitchId];
    const t = clamp(ball.t, 0, 2.2);
    const pos = pitchPos(pitch, t);
    if (pos < ball.hideUntil) return;                  // Pop is in the way

    const hop = pitchHop(pitch, t);
    const y = worldY(CONFIG.mountFeet * (1 - pos), 4 + hop);
    const grow = Math.pow(clamp(pos, 0, 1.2), 2.1);
    const size = (9 + 34 * grow) * pitchSize(pitch, t);

    if (game.state === "incoming") {
      ctx.strokeStyle = "rgba(255,255,255,0.30)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(W / 2, CONFIG.plateY - 24, 40, 15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = size + "px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pitch.emoji, worldX(ball.side), y);
    return;
  }

  // In flight
  const bx = worldX(ball.side);
  const by = worldY(ball.dist, ball.height);
  const shadowY = worldY(ball.dist, 0);
  const size = Math.max(9, 26 * camScale / CONFIG.pitchScale + 8);

  if (shadowY > -20 && shadowY < H + 20) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(bx, shadowY, size * 0.35, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = size + "px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(PITCHES[ball.pitchId].emoji, bx, by);

  // Dottie in mid-heist
  if (fx.chaseCaught > 0) {
    ctx.font = (size * 2.2) + "px serif";
    ctx.fillText("🐕", bx + size, by + size * 0.4);
  } else if (fx.chase) {
    const gap = clamp(1 - ball.dist / Math.max(1, fx.chase.catchDist), 0, 1);
    ctx.font = (size * 1.9) + "px serif";
    ctx.fillText("🐕", bx - 30, by + 40 + gap * 180);
  }
}

function drawBatter() {
  const y = worldY(0, 0);
  if (y < -100 || y > H + 120) return;
  const zoom = camScale / CONFIG.pitchScale;
  const ch = character();
  const bt = bat();
  const s = CONFIG.batterSize * zoom;
  if (s < 8) return;
  const x = W / 2 - CONFIG.batterOffset * zoom;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(W / 2, y + 8 * zoom, 22 * zoom, 8 * zoom, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = s + "px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(ch.emoji, x, y);

  // Dogs bite the bat, so it pivots from the snout and sweeps differently.
  const idleAngle = ch.mouth ? -1.25 : -1.9;
  const endAngle = ch.mouth ? 1.30 : 0.90;
  const a = swing.anim > 0 ? lerp(idleAngle, endAngle, easeOut(swing.anim)) : idleAngle;
  const hx = x + (ch.mouth ? 24 : 16) * zoom;
  const hy = y - s * (ch.mouth ? 0.30 : 0.45);
  const len = s * 0.75 * (bt.length || 1);

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);
  if ((swing.dropped || swing.slipped) && swing.anim > 0.5) {
    ctx.translate(swing.anim * 70, -swing.anim * 50);
    ctx.rotate(swing.anim * 3);
  }
  ctx.strokeStyle = bt.color;
  ctx.lineWidth = Math.max(3, s * 0.11 * (bt.width || 1));
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();
  if (bt.head) {                                  // the frying pan
    ctx.fillStyle = bt.color;
    ctx.beginPath();
    ctx.arc(len, 0, s * 0.18 * bt.head, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (swing.anim > 0) {
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 * (1 - swing.anim)) + ")";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(hx, hy, len, idleAngle, a);
    ctx.stroke();
  }
}

function drawDesserts() {
  if (!fx.desserts.length) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < fx.desserts.length; i++) {
    const d = fx.desserts[i];
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.font = d.size + "px serif";
    ctx.fillText(d.emoji, 0, 0);
    ctx.restore();
  }
}

function drawLights() {
  if (fx.lights <= 0) return;
  const flash = Math.floor(fx.lights * 6) % 2 === 0;
  ctx.fillStyle = flash ? "rgba(255,40,40,0.26)" : "rgba(40,80,255,0.26)";
  ctx.fillRect(0, 0, W / 2, H);
  ctx.fillStyle = flash ? "rgba(40,80,255,0.26)" : "rgba(255,40,40,0.26)";
  ctx.fillRect(W / 2, 0, W / 2, H);
}

function drawLick() {
  if (fx.lick <= 0) return;
  const a = clamp(fx.lick / 1.2, 0, 1);
  ctx.fillStyle = "rgba(255,150,180," + (0.35 * a) + ")";
  ctx.beginPath();
  ctx.ellipse(W / 2, H * 0.45, W * 0.55, H * 0.30, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "160px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = a;
  ctx.fillText("👅", W / 2, H * 0.45);
  ctx.globalAlpha = 1;
}


/* ==========================================================================
   10. HUD
   ========================================================================== */

function drawHUD() {
  if (game.state === "menu") return;
  const p = P();
  const versus = game.mode === "versus";
  const target = boss().target;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, W, 52);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Verdana";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Pitch " + game.pitchNumber + "/" + CONFIG.pitchesPerRound, 12, 17);
  ctx.fillStyle = "#9fb2c4";
  ctx.font = "12px Verdana";
  // In versus the important thing is whose turn it is, not who's pitching.
  ctx.fillText(versus
    ? p.name + "  (" + (game.turn + 1) + "/" + game.playerCount + ")"
    : "vs " + pitcher().name, 12, 37);

  // Right-aligned block stops short of the pause button in the corner.
  const rightEdge = W - 58;
  const leader = versus ? versusLeader() : null;
  const beating = versus ? (leader === null || p.totalDistance >= leader) : (p.totalDistance >= target);
  ctx.textAlign = "right";
  ctx.fillStyle = beating ? "#7cf07c" : "#ffffff";
  ctx.font = "bold 18px Verdana";
  ctx.fillText(Math.round(p.totalDistance).toLocaleString() + " ft", rightEdge, 17);
  ctx.fillStyle = "#9fb2c4";
  ctx.font = "12px Verdana";
  ctx.fillText(versus
    ? (leader === null ? "set the pace" : "beat " + Math.round(leader).toLocaleString())
    : "need " + target.toLocaleString(), rightEdge, 37);

  // Progress bar: toward the boss target, or toward whoever is winning
  const goal = versus ? (leader || 1) : target;
  const barW = W - 24;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(12, 47, barW, 4);
  ctx.fillStyle = beating ? "#7cf07c" : "#ffe14d";
  ctx.fillRect(12, 47, barW * clamp(p.totalDistance / goal, 0, 1), 4);

  if (game.state === "flight") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe14d";
    ctx.font = "bold 40px Verdana";
    ctx.fillText(Math.round(Math.max(0, ball.dist)) + " ft", W / 2, 96);
  }

  if (game.state === "windup" || game.state === "incoming") drawMeter();

  if (game.state === "incoming" && !swing.done && !swing.charging) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 16px Verdana";
    ctx.fillText("HOLD to charge  •  LET GO to swing", W / 2, H - 22);
  }

  if (fx.messageTimer > 0) {
    ctx.textAlign = "center";
    ctx.font = "bold 22px Verdana";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const w = ctx.measureText(fx.message).width + 28;
    roundRect(W / 2 - w / 2, 300, w, 40, 10);
    ctx.fill();
    ctx.fillStyle = "#ffe14d";
    ctx.textBaseline = "middle";
    ctx.fillText(fx.message, W / 2, 320);
  }

  if (result.show) drawResultBanner();
}

function drawResultBanner() {
  // Work out how tall the box needs to be before drawing anything.
  ctx.font = "bold 20px Verdana";
  const headLines = layoutText(result.headline, W - 70);
  ctx.font = "italic 15px Verdana";
  const annLines = layoutText(result.announcer, W - 66);

  const boxY = 140;
  const boxH = 30 + headLines.length * 24 + 48 + 24 + annLines.length * 19;
  const pop = clamp((CONFIG.resultSeconds - game.timer) * 9, 0, 1);   // slides in

  ctx.save();
  ctx.translate(0, (1 - easeOut(pop)) * -24);
  ctx.globalAlpha = pop;

  ctx.fillStyle = "rgba(0,0,0,0.78)";
  roundRect(20, boxY, W - 40, boxH, 14);
  ctx.fill();
  ctx.strokeStyle = result.sweet ? "#ffe14d" : "rgba(255,255,255,0.25)";
  ctx.lineWidth = result.sweet ? 4 : 2;
  roundRect(20, boxY, W - 40, boxH, 14);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let y = boxY + 26;
  if (result.landmarkEmoji) {
    ctx.font = "26px serif";
    ctx.fillText(result.landmarkEmoji, W / 2, y);
    y += 26;
  }
  ctx.fillStyle = result.sweet ? "#ffe14d" : "#ffffff";
  ctx.font = "bold 20px Verdana";
  for (let i = 0; i < headLines.length; i++) { ctx.fillText(headLines[i], W / 2, y); y += 24; }

  y += 22;
  ctx.fillStyle = "#7cf07c";
  ctx.font = "bold 38px Verdana";
  ctx.fillText(Math.round(result.distance).toLocaleString() + " ft", W / 2, y);

  y += 26;
  ctx.fillStyle = "#8fa6bb";
  ctx.font = "13px Verdana";
  ctx.fillText(result.sub, W / 2, y);

  y += 22;
  ctx.fillStyle = "#ffd98a";
  ctx.font = "italic 15px Verdana";
  for (let i = 0; i < annLines.length; i++) { ctx.fillText(annLines[i], W / 2, y); y += 19; }

  ctx.restore();

  // The boss gets the last word, down at the bottom.
  if (result.taunt) {
    ctx.font = "14px Verdana";
    const lines = layoutText(result.taunt, W - 96);
    const barH = 20 + lines.length * 18;
    const barY = H - barH - 14;
    ctx.globalAlpha = pop;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    roundRect(14, barY, W - 28, barH, 10);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "24px serif";
    ctx.fillText(pitcher().emoji, 24, barY + barH / 2);

    ctx.fillStyle = "#eaf3ff";
    ctx.font = "14px Verdana";
    let ty = barY + 10 + 9;
    for (let i = 0; i < lines.length; i++) { ctx.fillText(lines[i], 58, ty); ty += 18; }
    ctx.globalAlpha = 1;
  }
}

// Splits a string into lines that fit. Uses whatever font is already set.
function layoutText(text, maxWidth) {
  if (!text) return [];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawMeter() {
  const x = W - 46, yTop = 470, h = 200, w = 30;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 4, yTop - 4, w + 8, h + 8);

  const goodH = h * (1 / CONFIG.meterMax);
  ctx.fillStyle = "rgba(60,140,60,0.5)";
  ctx.fillRect(x, yTop + (h - goodH), w, goodH);
  ctx.fillStyle = "rgba(160,40,40,0.5)";
  ctx.fillRect(x, yTop, w, h - goodH);

  const f = clamp(swing.meter / CONFIG.meterMax, 0, 1);
  ctx.fillStyle = swing.meter > 1 ? "#ff5b4d" : "#8bff6b";
  ctx.fillRect(x, yTop + h - h * f, w, h * f);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, yTop + (h - goodH));
  ctx.lineTo(x + w + 2, yTop + (h - goodH));
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px Verdana";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("POWER", x + w / 2, yTop + h + 14);
}


/* ==========================================================================
   11. Helpers + main loop
   ========================================================================== */

function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
function pick(list) { return (list && list.length) ? list[Math.floor(Math.random() * list.length)] : ""; }

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
