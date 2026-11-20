/* ==========================================================================
   BACKYARD BOMBERS - CONTENT
   --------------------------------------------------------------------------
   This file is nothing but numbers and jokes. If you want to rebalance the
   game or rewrite a taunt, everything you need is in here. You never have to
   open game.js.

   The one number you'll most want to fiddle with is each boss's `target` -
   that's how many total feet you need over 10 pitches to beat them.
   ========================================================================== */


/* ==========================================================================
   CONFIG - the physical rules of the game
   ========================================================================== */

const CONFIG = {

  // ---- Screen ----------------------------------------------------------
  // The game is drawn on a 450 x 800 portrait "page" scaled to fit any screen.
  width: 450,
  height: 800,

  // ---- Field & camera --------------------------------------------------
  plateY: 700,            // screen height (in page pixels) of home plate
  mountFeet: 60,          // how far away the pitcher stands
  pitchScale: 9,          // pixels per foot while zoomed in at the plate
  flightScale: 2.2,       // pixels per foot once the camera pulls back
  zoomOutSeconds: 0.8,    // how long the camera takes to pull back
  heightWeight: 0.8,      // how much 1 foot of height moves the ball up screen
  ballScreenSpot: 0.60,   // where the flying ball sits on screen (0 top, 1 bottom)
  grassStripeFeet: 20,    // mowed stripe spacing
  // (The outfield fence, the grass colours and the crowd now live per-field,
  //  down in the FIELDS block. Each boss plays at their own place.)
  dirtCircleFeet: 14,     // size of the dirt circle around home plate
  foulLineSpread: 0.72,   // how wide the foul lines open up (1.0 = a full 45 degrees)
  batterSize: 92,         // how big the batter is drawn
  batterOffset: 36,       // how far the batter stands to the left of the plate

  // ---- Swing feel ------------------------------------------------------
  chargeSeconds: 0.75,    // time for the power meter to fill from 0 to FULL
  meterMax: 1.5,          // meter keeps going past 1.0 into the red overswing zone
  overchargeSpeed: 0.45,  // meter creeps slower once it's red, so the red zone is a real window
  minPower: 0.30,         // power you get from an instant tap (meter at 0)
  // How badly a full red meter wrecks your accuracy. This matters more than it
  // looks: on a SLOW pitch, a kid who just holds the button the whole way will
  // always end up pegged in the red. At 0.45 that's a weak but survivable hit,
  // which keeps the first boss winnable while you learn to let go earlier.
  overswingPenalty: 0.45,
  swingSeconds: 0.28,     // how long the bat animation takes

  // ---- Timing windows (in milliseconds off perfect) ---------------------
  // Multiplied by the bat's, the character's, the pitch's and the pitcher's
  // window modifiers. Bigger = easier.
  perfectMs: 60,          // SWEET SPOT
  goodMs: 145,            // solid contact
  contactMs: 255,         // weak contact - anything worse is a whiff
  lateCutoff: 1.32,       // pitch progress at which a held swing is forced (1.0 = plate)

  // ---- Distance --------------------------------------------------------
  // dist = baseDistance * power * quality^curve * bat * character * pitch * luck
  baseDistance: 470,
  qualityCurve: 1.7,
  luckMin: 0.92,
  luckMax: 1.10,
  launchAngleBase: 33,    // degrees, for a well-timed ball
  launchAnglePerMs: 0.075,// early swings pop up, late swings stay low
  launchAngleMin: 9,
  launchAngleMax: 68,
  gravity: 32.2,          // feet per second squared
  flightTimeScale: 0.55,  // <1 makes long balls land sooner so it doesn't drag
  spraySpread: 0.13,      // how much sideways scatter a mistimed ball gets
  // Bats with accuracy below 1.0 sometimes slice one foul. This is what stops
  // the Banana Peel from being strictly better than everything else.
  mishitChance: 0.55,     // multiplied by (1 - bat accuracy)
  mishitKeep: 0.25,       // how much distance a foul ball keeps

  // ---- Round -----------------------------------------------------------
  pitchesPerRound: 10,
  windupSeconds: 1.1,     // pause + wind-up before each pitch
  resultSeconds: 2.0,     // how long the result banner sits there
  citationFeet: 320,      // a homer this big makes Uncle Matt lose it
  citationSeconds: 3.2,   // how long the police lights strobe
};


/* ==========================================================================
   CHARACTERS - who is holding the bat
   The three dogs unlock by beating the final boss. In versus mode everybody
   gets all four from the start.
   ========================================================================== */

const CHARACTERS = {
  human: {
    name: "Batter",
    emoji: "🧍",
    joke: "A perfectly normal person. Holds the bat in their hands, like a coward.",
    chargeSpeed: 1.00,    // higher = power meter fills faster
    windowMod: 1.00,      // higher = more forgiving timing
    powerMod: 1.00,
    chaos: 0,             // random bonus on every hit
    dropChance: 0,        // chance of comically losing the bat
    mouth: false,         // dogs hold the bat in their mouth
  },
  zeus: {
    name: "Zeus",
    emoji: "🐕‍🦺",
    joke: "Old, black and wise. Swings slow. Already knows where the ball is going.",
    chargeSpeed: 0.70, windowMod: 1.50, powerMod: 1.00, chaos: 0, dropChance: 0, mouth: true,
  },
  dottie: {
    name: "Dottie",
    emoji: "🐕",
    joke: "Blonde. Fast as a cheetah. Absolutely no time for thinking.",
    chargeSpeed: 1.70, windowMod: 0.68, powerMod: 1.05, chaos: 0, dropChance: 0, mouth: true,
  },
  georgia: {
    name: "Georgia",
    emoji: "🐩",
    joke: "Brown, bouncy, full of love. Every swing is a surprise, including to her.",
    chargeSpeed: 1.10, windowMod: 1.00, powerMod: 1.00, chaos: 0.55, dropChance: 0.12, mouth: true,
    // Every so often she just launches one into space. Georgia paired with the
    // Banana Peel is the strongest combo in the game at every skill level - turn
    // these two down if that combo is winning every versus game at your house.
    chaosJackpot: 0.12,       // chance of the big one
    chaosJackpotBonus: 3.0,   // how big (multiplied by `chaos`)
  },
};


/* ==========================================================================
   BATS - unlocked in ladder order (see BOSS_LADDER at the bottom)
   ========================================================================== */

const BATS = {
  regular: {
    name: "Regular Bat", emoji: "🏏",
    joke: "A bat. Just a bat. Boring, reliable, deeply unfunny.",
    power: 1.00, windowMod: 1.00, accuracy: 1.00,
    color: "#c98b3a", width: 1.0, length: 1.0,
  },
  noodle: {
    name: "Pool Noodle", emoji: "🟦",
    joke: "Impossible to miss with. Also basically made of air. Nana approves.",
    power: 0.62, windowMod: 2.30, accuracy: 1.20,
    color: "#4fc3f7", width: 2.3, length: 1.15,
  },
  banana: {
    name: "Banana Peel", emoji: "🍌",
    joke: "Wildly inaccurate. But hit it clean and the ball leaves the solar system.",
    power: 1.20, windowMod: 0.85, accuracy: 0.45, sweetBonus: 1.45,
    color: "#ffe14d", width: 1.3, length: 0.90,
  },
  fryingPan: {
    name: "Frying Pan", emoji: "🍳",
    joke: "Screaming line drives and a CLANG you can hear from the driveway.",
    power: 1.15, windowMod: 1.00, accuracy: 1.30, lineDriveAngle: 17,
    color: "#4a4a52", width: 1.4, length: 0.85, head: 1.0,
  },
  baguette: {
    name: "Baguette", emoji: "🥖",
    joke: "Enormous power. Falls apart a little more with every single swing.",
    power: 1.55, windowMod: 0.95, accuracy: 0.90, crumble: 0.09,
    color: "#d9a441", width: 1.5, length: 1.05,
  },
  frozenFish: {
    name: "Frozen Fish", emoji: "🐟",
    joke: "Cold, heavy, and every so often it simply leaves. No hard feelings.",
    // The one bat you have to actually earn. Beat the whole ladder in single
    // player and it turns up in versus too. Set this to false to just hand it out.
    versusLocked: true,
    power: 1.25, windowMod: 0.95, accuracy: 0.85, slipChance: 0.16,
    color: "#7fd3e0", width: 1.6, length: 0.85,
  },
};


/* ==========================================================================
   PITCHES
   `seconds`   how long it takes to reach the plate (before pitcher speed mods)
   `distance`  how far it goes if you square it up
   `windowMod` how forgiving the timing is (bigger = easier)
   `ease(t)`   where the ball is on its way in (0 = mound, 1 = plate)
   `side(t)`   feet of sideways drift
   `hop(t)`    feet of bounce height
   `shrink(t)` size multiplier over the flight
   ========================================================================== */

const PITCHES = {
  fastball: {
    name: "Fastball", emoji: "⚾",
    joke: "It's a baseball. Thrown at you. Classic stuff.",
    seconds: 1.15, distance: 1.00, windowMod: 1.00, sizeMod: 1.00,
  },
  iceCream: {
    name: "Ice Cream Scoop", emoji: "🍦",
    joke: "Melts on the way in. Gets smaller and lazier the longer you wait.",
    seconds: 1.35, distance: 0.90, windowMod: 1.05, sizeMod: 1.10,
    ease: function (t) { return Math.pow(t, 1.55); },
    shrink: function (t) { return 1 - 0.45 * Math.min(1, t); },
  },
  watermelon: {
    name: "Watermelon", emoji: "🍉",
    joke: "The size of a mailbox and twice as slow. Does not go far. At all.",
    seconds: 1.70, distance: 0.60, windowMod: 1.55, sizeMod: 2.00,
  },
  balloon: {
    name: "Balloon", emoji: "🎈",
    joke: "Floats, drifts, and refuses to be hit. Connect and it goes to space.",
    seconds: 2.10, distance: 1.75, windowMod: 0.50, sizeMod: 1.30,
    ease: function (t) { return Math.pow(t, 0.82); },
    side: function (t) { return Math.sin(t * 4.2) * 3.4; },
  },
  bouncy: {
    name: "Bouncy Ball", emoji: "🔴",
    joke: "Arrives fast, bounces on the way, and thinks that's hilarious.",
    seconds: 0.92, distance: 1.15, windowMod: 0.85, sizeMod: 0.90,
    ease: function (t) { return t + 0.05 * Math.sin(t * Math.PI * 3); },
    hop: function (t) { return Math.abs(Math.sin(t * Math.PI * 3)) * 5; },
  },
  paperPlane: {
    name: "Paper Airplane", emoji: "✈️",
    joke: "Glides side to side like it has somewhere better to be.",
    seconds: 1.60, distance: 1.25, windowMod: 0.80, sizeMod: 1.05,
    side: function (t) { return Math.sin(t * 5.5) * 4.6; },
  },
};


/* ==========================================================================
   BOSSES

   Every boss has a `pitchers` array. `mode` decides who's on the mound:
     "single"    - always pitchers[0]
     "alternate" - swaps every single pitch
     "random"    - picks at random each pitch

   Each pitcher can carry a `special`:
     "desserts"  - drifts pies and cakes across the screen as visual noise
     "hideBall"  - the ball is invisible until it clears their enormous body
     "citations" - police lights and a siren after a big homer
     "chases"    - runs down balls you already hit and drags them back
     "chaos"     - random everything, dropped balls, licks the screen
   ========================================================================== */

const BOSSES = {

  /* ---- 1. NANA ---------------------------------------------------------- */
  nana: {
    name: "Nana",
    field: "backyard",
    // TARGETS: these are the main difficulty dial. For reference, a decent
    // player who manages the power meter averages roughly 3,600-4,700 ft a
    // round with the Regular Bat, so these sit well under that on purpose.
    target: 900,                      // total feet over 10 pitches to beat her
    unlocks: "noodle",
    blurb: "Underhand lobs a toddler could hit. The hard part is that she will not stop showing you desserts.",
    pitchers: [{
      name: "Nana", emoji: "👵", size: 1.05,
      pitches: ["watermelon", "iceCream", "balloon", "watermelon", "iceCream"],
      speedMod: 1.45,                 // >1 = slower pitches
      windowBonus: 1.60,              // >1 = easier timing
      special: "desserts",
      lines: {
        during: [
          "I made a pie, sweetie!",
          "Are you hungry? I have cake.",
          "There are cookies in the kitchen!",
          "Do you want a snack? I have snacks.",
          "I made TWO pies, actually.",
          "Have you eaten today? Honestly.",
        ],
        whiff: ["Oh that's alright honey.", "You were probably thinking about the pie.", "Swing and a miss! Have a cookie."],
        weak: ["That's a hit! That counts!", "Look at you go!", "Very nice, sweetie."],
        good: ["Oh my goodness!", "Would you look at that!", "You're getting so tall."],
        homer: ["Careful, you'll break a window!", "That's my grandbaby!", "Somebody call the neighbors!"],
        win: ["Well I'm just so proud of you. Take a pie home."],
        lose: ["That's okay honey. Have some cake and try again."],
      },
    }],
  },

  /* ---- 2. POP ----------------------------------------------------------- */
  pop: {
    name: "Pop",
    field: "neighborhood",
    target: 1600,
    unlocks: "banana",
    blurb: "The size of a refrigerator. You cannot see the ball until it clears him. He will compliment every single swing anyway.",
    pitchers: [{
      name: "Pop", emoji: "🧔", size: 2.60,
      pitches: ["fastball", "fastball", "bouncy", "fastball"],
      speedMod: 0.74,                 // fast, flat pitches
      windowBonus: 1.00,
      special: "hideBall",
      hideUntil: 0.30,                // ball is invisible until it clears his body
      bodyColor: "#3f6ea8",           // Pop is drawn as an actual wall of a man
      lines: {
        during: ["Here it comes, kid!", "Good stance!", "Love the setup!"],
        whiff: ["GREAT CUT, KID!", "Beautiful swing! Just missed it!", "That's the right idea!", "I liked everything about that."],
        weak: ["NOW THAT'S A ROCKET!", "You got ALL of that!", "Did you see that thing GO?", "Somebody get a tape measure!"],
        good: ["Atta boy! Atta girl! Atta kid!", "That's what I'm talking about!", "You've got a gift, you know that?"],
        homer: ["I am so proud of you I could cry.", "That's the best swing I've ever seen. I mean it.", "Your grandmother is going to hear about this."],
        win: ["I never had a doubt. Not one. I'm proud of you, kid."],
        lose: ["Hey. HEY. That was a great round. Go again."],
      },
    }],
  },

  /* ---- 3. PAT AND JOEY -------------------------------------------------- */
  kids: {
    name: "Pat & Joey",
    field: "boroPark",
    target: 2200,
    unlocks: "fryingPan",
    blurb: "They swap every single pitch so you never settle in. Pat throws pure heat. Joey throws garbage that moves the wrong way.",
    mode: "alternate",
    pitchers: [
      {
        name: "Pat", emoji: "🧒", size: 1.00,
        pitches: ["fastball", "bouncy"],
        speedMod: 0.62, windowBonus: 0.88,
        lines: {
          during: ["Too fast for you.", "Watch this one.", "Bet you can't."],
          whiff: ["MY LITTLE SISTER SWINGS HARDER.", "Did you even see it?", "Were you swinging at a bug?", "That was embarrassing for everybody."],
          weak: ["Ooooh, a whole four feet.", "Nice bunt, grandma.", "Is that all you got?"],
          good: ["Okay that was kinda lucky.", "Fine. FINE. One hit.", "Anybody could do that."],
          homer: ["THAT DOESN'T COUNT.", "The wind helped you.", "I wasn't even trying that time."],
          win: ["Okay. Okay, that was actually really good. Respect."],
          lose: ["HA! Told you. Go again, I'll wait."],
        },
        meanLines: ["You're SO bad at this.", "This is the worst hitting I've ever seen.", "Joey, are you watching this?"],
      },
      {
        name: "Joey", emoji: "👦", size: 1.00,
        pitches: ["paperPlane", "balloon", "paperPlane"],
        speedMod: 1.28, windowBonus: 0.90, sideBreakMod: 2.40,
        lines: {
          during: ["This one curves. Good luck.", "It's gonna move. It's gonna move!", "Wrong way! Wrong way!"],
          whiff: ["It went the OTHER way, genius.", "You swung at where it used to be.", "That's my screwball. You're welcome."],
          weak: ["That's not a hit, that's a sneeze.", "Wow. Huge. Amazing.", "Pat, write that one down."],
          good: ["Lucky.", "Okay you guessed right that time.", "Do it again then. I dare you."],
          homer: ["I MEANT to do that.", "That was a practice pitch.", "Rematch. RIGHT NOW."],
          win: ["Dude. That was awesome. Can you teach me that?"],
          lose: ["Hahaha! Get wrecked. Try again, I guess."],
        },
        meanLines: ["Are you even trying?", "My goldfish hits better.", "This is genuinely hard to watch."],
      },
    ],
  },

  /* ---- 4. UNCLE MATT ---------------------------------------------------- */
  matt: {
    name: "Uncle Matt",
    field: "cityField",
    target: 2500,
    unlocks: "baguette",
    blurb: "A police officer who has decided that hitting the ball too far is a crime. Nothing but junk pitches and flashing lights.",
    pitchers: [{
      name: "Uncle Matt", emoji: "👮", size: 1.15,
      pitches: ["iceCream", "paperPlane", "balloon", "iceCream", "fastball"],
      speedMod: 1.12, windowBonus: 0.92, sideBreakMod: 1.60,
      special: "citations",
      lines: {
        during: ["Keep it under 300, please.", "I'm watching you.", "Nice and easy now.", "Don't make me do paperwork."],
        whiff: ["That's the safest swing I've seen all day.", "No violation there.", "Good. Keep doing that."],
        weak: ["Now THAT is a law-abiding hit.", "Perfectly legal. Thank you.", "See? Nobody got hurt."],
        good: ["Okay, that's pushing it.", "You're right on the limit, pal.", "I could write you up for that."],
        homer: ["SIR. THAT IS A CITATION.", "PULL OVER. I mean. STOP HITTING.", "That's going in the report.", "I have a form for this."],
        win: ["Alright, you're under arrest.  ...that's not how it works?  Fine. Great job."],
        lose: ["Case closed. Try again, tough guy."],
      },
      warnings: [
        "That's a warning.",
        "That's your SECOND warning.",
        "Okay, I've stopped counting warnings.",
        "I'm calling your mother.",
        "This is a whole situation now.",
      ],
    }],
  },

  /* ---- 5. THE DOGS (final boss) ----------------------------------------- */
  dogs: {
    name: "Zeus, Dottie & Georgia",
    field: "bigLeague",
    shortName: "The Dogs",
    target: 2800,
    unlocks: "frozenFish",
    unlocksCharacters: ["zeus", "dottie", "georgia"],
    blurb: "Three dogs. Three completely different problems. Nobody is in charge and it shows.",
    mode: "random",
    isFinal: true,
    pitchers: [
      {
        name: "Zeus", emoji: "🐕‍🦺", size: 1.20,
        pitches: ["iceCream", "watermelon", "fastball"],
        speedMod: 1.30, windowBonus: 0.95,
        lines: {
          during: ["*sighs*", "*has seen this before*", "*does not get up*"],
          whiff: ["Zeus does not react.", "He expected that.", "Zeus lies back down."],
          weak: ["Zeus allows it.", "A polite tail wag.", "He's seen better. He's seen worse."],
          good: ["Zeus raises one eyebrow.", "A respectful nod.", "That got his attention."],
          homer: ["Zeus stands up. That's how you know.", "He's actually impressed. This is rare.", "Zeus barks once. ONCE."],
          win: ["Zeus walks over and leans on your leg. That's the highest honor available."],
          lose: ["Zeus goes back to sleep."],
        },
      },
      {
        name: "Dottie", emoji: "🐕", size: 1.15,
        pitches: ["fastball", "bouncy", "fastball"],
        speedMod: 0.52, windowBonus: 0.66,
        special: "chases",
        chaseChance: 0.45,
        lines: {
          during: ["*vibrating*", "*already running*", "*blur*"],
          whiff: ["Too fast. Way too fast.", "She was gone before you moved.", "Dottie is already back at the mound."],
          weak: ["She caught it before it landed. Obviously.", "Dottie is disappointed but supportive."],
          good: ["She almost got to that one.", "Dottie respects the effort."],
          homer: ["Even Dottie couldn't run that one down.", "She tried. She really tried."],
          win: ["Dottie does eleven laps of the yard. That means she likes you."],
          lose: ["Dottie has the ball. Dottie is not giving it back."],
        },
      },
      {
        name: "Georgia", emoji: "🐩", size: 1.20,
        pitches: ["fastball", "iceCream", "watermelon", "balloon", "bouncy", "paperPlane"],
        speedMod: 1.00, windowBonus: 1.05,
        special: "chaos",
        dropChance: 0.16,             // she just drops it - free re-pitch
        chargeChance: 0.14,           // she runs the ball at you personally
        lickChance: 0.18,             // the screen gets licked
        lines: {
          during: ["I LOVE YOU", "IS THAT A BALL", "I AM SO HAPPY", "WHAT IF I JUST RAN AT YOU"],
          whiff: ["Georgia did not notice.", "She's just glad you're here.", "Georgia is eating a leaf."],
          weak: ["GEORGIA THINKS THAT WAS AMAZING.", "She's so proud of you.", "Tail: maximum."],
          good: ["GEORGIA IS LOSING HER MIND.", "She's doing zoomies about it."],
          homer: ["GEORGIA HAS ASCENDED.", "She has no idea what happened but she LOVES it."],
          win: ["Georgia licks your entire face. You have won and also been defeated."],
          lose: ["Georgia forgot what she was doing. Go again."],
        },
      },
    ],
  },
};


/* ==========================================================================
   The order you fight them in, and therefore the order bats unlock in.
   ========================================================================== */
const BOSS_LADDER = ["nana", "pop", "kids", "matt", "dogs"];


/* ==========================================================================
   VERSUS - pass-and-play for 2 to 4 people on one device.
   Everybody gets all four characters and (nearly) every bat straight away,
   no matter how far anyone has got in single player.
   ========================================================================== */

const VERSUS = {
  minPlayers: 2,
  maxPlayers: 4,
  maxNameLength: 10,
  defaultNames: ["Player 1", "Player 2", "Player 3", "Player 4"],

  // Who's pitching?
  //   "sameForAll"     - one random boss, everybody faces them. Fair.
  //   "randomEachTurn" - every player draws their own boss. Chaotic, and a bit
  //                      unfair if one person gets Nana and the next gets the dogs.
  bossMode: "sameForAll",
};


/* ==========================================================================
   Desserts Nana throws at your eyeballs (purely visual - never hittable)
   ========================================================================== */
const DESSERTS = ["🥧", "🍰", "🍪", "🧁", "🍩", "🍮", "🥮", "🍫"];


/* ==========================================================================
   FIELDS - every boss plays at their own place.

   `fenceFeet` is purely cosmetic (the ball flies straight over it), so moving
   a fence just changes how the place looks and where "over the wall" starts.

   `scenery` rows are drawn out past the fence at the given distance, so it
   pays to keep them roughly lined up with that field's landmarks.
   ========================================================================== */

const FIELDS = {

  /* ---- Nana: the actual backyard ---------------------------------------- */
  backyard: {
    name: "The Backyard",
    sky: ["#2a4a86", "#7fb5e8", "#cfe8f7"],
    grass: ["#4a9a3e", "#41903a"],
    beyond: ["#4f8a44", "#498040"],
    dirt: "#b9793f",
    fenceFeet: 160,
    fenceColor: "#8a5a2b",              // wooden privacy fence
    fenceCap: "#6d4620",
    fenceText: "🌻  NANA'S YARD  🌻",
    crowd: { count: 5, emoji: ["👵", "🧓", "🐕", "🧒", "🐈"] },
    scenery: [
      { feet: 178, size: 26, items: ["🍅", "🌷", "🪴", "🌻"] },
      { feet: 215, size: 42, items: ["🏠", "🌳", "🏡", "🌲"] },
      { feet: 300, size: 34, items: ["🛻", "🚗", "🏘️", "🛴"] },
      { feet: 430, size: 38, items: ["🏘️", "🌳", "🏠", "🌲"] },
      { feet: 620, size: 38, items: ["☁️", "🛩️", "🎈"] },
      { feet: 820, size: 44, items: ["🛸", "🌙", "🪐"] },
    ],
    landmarks: [
      { min: 160, emoji: "🍅", text: "INTO NANA'S TOMATO PLANTS" },
      { min: 210, emoji: "🏠", text: "OFF THE SIDE OF THE HOUSE" },
      { min: 265, emoji: "🪟", text: "THROUGH THE SHED WINDOW" },
      { min: 330, emoji: "🛻", text: "INTO THE BED OF A PICKUP TRUCK" },
      { min: 420, emoji: "🏘️", text: "THREE HOUSES DOWN" },
      { min: 530, emoji: "🌳", text: "STUCK IN THE BIG OAK. IT LIVES THERE NOW." },
      { min: 660, emoji: "🛩️", text: "OFF A PASSING PLANE" },
      { min: 800, emoji: "🛰️", text: "INTO LOW EARTH ORBIT" },
      { min: 950, emoji: "🌙", text: "IT HIT THE MOON. THE ACTUAL MOON." },
    ],
  },

  /* ---- Pop: the neighbourhood little league field ------------------------ */
  neighborhood: {
    name: "The Neighbourhood Field",
    sky: ["#1e5aa8", "#6fb0e8", "#bfe4f7"],
    grass: ["#3f9a4a", "#38913f"],
    beyond: ["#5f6b52", "#59654e"],
    dirt: "#b9793f",
    fenceFeet: 280,
    fenceColor: "#7d8794",              // chain link
    fenceCap: "#c9ced6",
    fenceText: "⚾  LITTLE LEAGUE FIELD  ⚾",
    crowd: { count: 8, emoji: ["🧑", "👩", "🧒", "👨", "🧢", "👵", "🧔", "👦"] },
    scenery: [
      { feet: 300, size: 32, items: ["🚗", "🚙", "🛻", "🚐"] },
      { feet: 370, size: 34, items: ["🌭", "🥤", "🍦", "🧃"] },
      { feet: 440, size: 40, items: ["🏠", "🌳", "🏡", "🌲"] },
      { feet: 600, size: 42, items: ["🗼", "☁️", "🌳"] },
      { feet: 780, size: 40, items: ["🛩️", "🎈", "☁️"] },
      { feet: 950, size: 44, items: ["🛸", "🌙", "🪐"] },
    ],
    landmarks: [
      { min: 280, emoji: "🧱", text: "OFF THE TOP OF THE FENCE" },
      { min: 305, emoji: "🚗", text: "OVER THE FENCE, INTO THE PARKING LOT" },
      { min: 365, emoji: "🌭", text: "DIRECTLY INTO THE SNACK STAND" },
      { min: 430, emoji: "🪟", text: "THROUGH SOMEBODY'S KITCHEN WINDOW" },
      { min: 510, emoji: "🏠", text: "ONTO A ROOF ACROSS THE STREET" },
      { min: 620, emoji: "🗼", text: "OFF THE WATER TOWER. IT RANG." },
      { min: 780, emoji: "🛰️", text: "INTO LOW EARTH ORBIT" },
      { min: 950, emoji: "🌙", text: "IT HIT THE MOON. THE ACTUAL MOON." },
    ],
  },

  /* ---- Pat & Joey: Boro Park, Milltown ----------------------------------- */
  boroPark: {
    name: "Boro Park, Milltown",
    sky: ["#2a5f9e", "#79b8e8", "#c8e6f5"],
    grass: ["#3a9146", "#34883f"],
    beyond: ["#57774f", "#51704b"],
    dirt: "#b08048",
    fenceFeet: 300,
    fenceColor: "#4a6b52",              // green chain link, like every town park
    fenceCap: "#8fa896",
    fenceText: "⚾  BORO PARK • MILLTOWN  ⚾",
    crowd: { count: 10, emoji: ["🧑", "👦", "👧", "👨", "🧢", "👩", "🧒", "🐕", "👴", "🧔"] },
    scenery: [
      { feet: 325, size: 34, items: ["🛝", "🎠", "🛹", "🧃"] },
      { feet: 385, size: 32, items: ["🎾", "🏀", "🏓", "🥎"] },
      { feet: 445, size: 34, items: ["🏚️", "🌭", "🚰", "🪑"] },
      { feet: 525, size: 36, items: ["🏊", "🛟", "🤽", "🩴"] },
      { feet: 650, size: 42, items: ["🌳", "🌲", "🏘️", "🌳"] },
      { feet: 820, size: 40, items: ["☁️", "🛩️", "🎈"] },
      { feet: 960, size: 44, items: ["🛸", "🌙", "🪐"] },
    ],
    landmarks: [
      { min: 300, emoji: "🧱", text: "OFF THE TOP OF THE FENCE" },
      { min: 330, emoji: "🛝", text: "INTO THE PLAYGROUND" },
      { min: 385, emoji: "🎾", text: "ONTO THE TENNIS COURTS. LOVE-FIFTEEN." },
      { min: 445, emoji: "🌭", text: "INTO THE SNACK SHACK" },
      { min: 525, emoji: "🏊", text: "INTO THE COMMUNITY POOL. EVERYBODY OUT." },
      { min: 650, emoji: "🌳", text: "OVER THE BIG TREES ON MAIN STREET" },
      { min: 800, emoji: "🛰️", text: "INTO LOW EARTH ORBIT" },
      { min: 950, emoji: "🌙", text: "IT HIT THE MOON. THE ACTUAL MOON." },
    ],
  },

  /* ---- Uncle Matt: a ball field wedged into a city ----------------------- */
  cityField: {
    name: "The City Lot",
    sky: ["#26344f", "#5c7fa8", "#9fb6c9"],
    grass: ["#3d8a45", "#37803e"],
    beyond: ["#3f434a", "#3a3e45"],     // asphalt
    dirt: "#9c7248",
    fenceFeet: 320,
    fenceColor: "#5a6470",              // painted concrete wall
    fenceCap: "#8d97a5",
    fenceText: "🚔  CITY PARK — NO BALL PLAYING  🚔",
    crowd: { count: 10, emoji: ["🧑", "👮", "👨", "🧒", "👩", "🧢", "🚶", "👴", "🧔", "👧"] },
    scenery: [
      { feet: 345, size: 34, items: ["🚕", "🚙", "🚓", "🚌"] },
      { feet: 405, size: 32, items: ["🚏", "🚦", "🗑️", "🛵"] },
      { feet: 470, size: 46, items: ["🏢", "🏬", "🏢", "🏨"] },
      { feet: 570, size: 50, items: ["🏙️", "🏢", "🗼"] },
      { feet: 690, size: 40, items: ["🚁", "☁️", "🛫"] },
      { feet: 850, size: 44, items: ["🛰️", "🌙", "🪐"] },
    ],
    landmarks: [
      { min: 320, emoji: "🧱", text: "OFF THE OUTFIELD WALL" },
      { min: 350, emoji: "🚕", text: "OFF THE ROOF OF A TAXI" },
      { min: 410, emoji: "🚏", text: "INTO A BUS SHELTER" },
      { min: 475, emoji: "🏢", text: "OFF A THIRD-FLOOR WINDOW" },
      { min: 570, emoji: "🏙️", text: "CLEAN OVER THE WHOLE BLOCK" },
      { min: 690, emoji: "🚁", text: "OFF A NEWS HELICOPTER" },
      { min: 830, emoji: "🛰️", text: "INTO LOW EARTH ORBIT" },
      { min: 950, emoji: "🌙", text: "IT HIT THE MOON. THE ACTUAL MOON." },
    ],
  },

  /* ---- The Dogs: a real ballpark, at night, under the lights ------------- */
  bigLeague: {
    name: "Backyard Bombers Park",
    sky: ["#03060f", "#0a1330", "#16264a"],
    grass: ["#35934a", "#2c8340"],
    beyond: ["#2a2f3a", "#252a34"],     // packed stands
    dirt: "#a9743f",
    fenceFeet: 400,
    fenceColor: "#1c3a24",              // padded outfield wall
    fenceCap: "#e8d24a",
    fenceText: "⚾  BACKYARD BOMBERS PARK  ⚾",
    crowd: { count: 14, rows: 2, emoji: ["🧑", "👩", "🧒", "👨", "🧢", "👵", "🧔", "👦", "👧", "🐕", "🧓", "👴", "🙌", "📣"] },
    night: true,
    lights: true,
    stars: true,
    scenery: [
      { feet: 425, size: 30, items: ["🙌", "📣", "🎉", "🍿"] },
      { feet: 470, size: 32, items: ["🍺", "🌭", "🥨", "🍦"] },
      { feet: 560, size: 48, items: ["🏟️", "🎪", "🏟️"] },
      { feet: 700, size: 44, items: ["🌃", "🌉", "🎆"] },
      { feet: 900, size: 44, items: ["🌙", "⭐", "🛸"] },
    ],
    landmarks: [
      { min: 400, emoji: "🧱", text: "OFF THE OUTFIELD WALL" },
      { min: 425, emoji: "🎉", text: "INTO THE BLEACHERS" },
      { min: 480, emoji: "🍺", text: "ALL THE WAY TO THE UPPER DECK" },
      { min: 565, emoji: "🏟️", text: "CLEAN OUT OF THE STADIUM" },
      { min: 670, emoji: "🌃", text: "INTO THE CITY SKYLINE" },
      { min: 790, emoji: "🎆", text: "THEY SET OFF THE FIREWORKS FOR THAT ONE" },
      { min: 880, emoji: "🛰️", text: "INTO LOW EARTH ORBIT" },
      { min: 950, emoji: "🌙", text: "IT HIT THE MOON. THE ACTUAL MOON." },
    ],
  },
};


/* ==========================================================================
   LANDMARKS - where the ball ended up, instead of a boring number.
   These are the close-in ones, shared by every field. Anything that clears
   the fence uses that field's own `landmarks` list above.
   ========================================================================== */

const NEAR_LANDMARKS = [
  { min: 0,   emoji: "💨", text: "SWING AND A MISS" },
  { min: 1,   emoji: "🐛", text: "DRIBBLED INTO THE DIRT" },
  { min: 45,  emoji: "🌱", text: "LOST IN THE INFIELD GRASS" },
  { min: 100, emoji: "🧢", text: "BLOOPED INTO SHALLOW CENTER" },
  { min: 170, emoji: "👟", text: "DEEP INTO THE OUTFIELD" },
  { min: 240, emoji: "🏃", text: "WAY BACK, TO THE WARNING TRACK" },
];


/* ==========================================================================
   ANNOUNCER - one silly line after every single swing.
   Buckets: whiff (0 ft), weak (<100), solid (<240), big (<420), monster (420+)
   ========================================================================== */

const ANNOUNCER = {
  whiff: [
    "He's swinging at the weather.",
    "The ball is fine. Nobody touched the ball.",
    "That was a very confident miss.",
    "Beautiful swing. Wrong everything else.",
    "The bat and the ball have never met.",
    "Strike! And honestly, a stylish one.",
    "He swung at a memory of a pitch.",
  ],
  weak: [
    "It moved! Technically!",
    "That ball has given up on life.",
    "A gentle tap. Very polite.",
    "The ball rolled over and went to sleep.",
    "You could walk that ball down.",
    "Folks, a snail is contesting that for the lead.",
    "It went forward. We're counting it.",
    "The infield grass says thank you.",
  ],
  solid: [
    "Now THAT is a baseball hit!",
    "Solid contact! The crowd is mildly upright!",
    "He got a piece of that one!",
    "That'll do it! That'll absolutely do it!",
    "A respectable hit from a respectable person.",
    "Clean as anything. Well struck!",
    "The outfielders are jogging. That's a good sign.",
  ],
  big: [
    "GET OUT THE TAPE MEASURE!",
    "That is GONE and it is not coming back!",
    "Somebody call the neighbours!",
    "OH he crushed that one!",
    "That ball owes us money and it just left town!",
    "It is still climbing! IT IS STILL CLIMBING!",
    "Goodbye. Farewell. Safe travels.",
  ],
  monster: [
    "WHAT ARE WE EVEN WATCHING?!",
    "THAT BALL HAS A PASSPORT NOW!",
    "I AM CONTRACTUALLY OBLIGATED TO SCREAM!",
    "SOMEBODY CHECK ON THAT BALL!",
    "I HAVE CALLED MY FAMILY. THEY ARE ALSO SCREAMING.",
    "THAT IS THE HARDEST ANYONE HAS EVER HIT ANYTHING!",
    "PACK IT UP. GAME OVER. GO HOME.",
  ],
};


/* ==========================================================================
   JUICE - particles, screen shake, crowd
   ========================================================================== */

const JUICE = {
  // Screen shake, in pixels, for a hit of `shakeAtFeet` or more.
  shakeMax: 22,
  shakeAtFeet: 500,
  shakeDecay: 3.2,          // higher = settles faster
  shakeOnClang: 9,          // the frying pan rattles the screen on its own

  // Contact sparks
  contactParticles: 18,
  sweetParticles: 26,
  landingParticles: 14,

  // The crowd itself is defined per-field (see FIELDS). They jump whenever a
  // ball clears that field's fence.

  // ---- Performance safety net ----
  // Emoji are expensive to draw. If the device can't keep up, the game quietly
  // thins out the particles rather than getting choppy. Set adaptive to false
  // to always draw the full amount no matter what.
  adaptive: true,
  slowFrameMs: 14,          // a draw costing more than this counts as struggling
  minParticleScale: 0.25,   // never thin out below a quarter of the particles
};

// What flies off each bat when it connects.
const BAT_DEBRIS = {
  regular: ["✨", "💥"],
  noodle: ["🫧", "💧", "✨"],
  banana: ["🍌", "💛", "✨"],
  fryingPan: ["✨", "⚡", "💥"],
  baguette: ["🥖", "🟤", "✨"],
  frozenFish: ["💦", "🧊", "✨"],
};
