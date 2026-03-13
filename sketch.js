/*
  Week 6 — Example 3: Expanded Tile-Based Level with Camera Follow, Fall Reset, and Scrolling Background

  Course: GBDA302 | Instructors: Dr. Karen Cochrane & David Han
  Date: Feb. 26, 2026

  Controls:
    A or D (Left / Right Arrow)   Horizontal movement
    W (Up Arrow)                  Jump
    Space Bar                     Attack

  Tile key:
    g = groundTile.png       (surface ground)
    d = groundTileDeep.png   (deep ground, below surface)
    L = platformLC.png       (platform left cap)
    R = platformRC.png       (platform right cap)
    [ = wallL.png            (wall left side)
    ] = wallR.png            (wall right side)
      = empty (no sprite)
*/

let player, sensor;
let bgLayers = [];
let playerImg, bgForeImg, bgMidImg, bgFarImg;

let playerAnis = {
  idle: { row: 0, frames: 4, frameDelay: 10 },
  run: { row: 1, frames: 4, frameDelay: 3 },
  jump: { row: 2, frames: 3, frameDelay: Infinity, frame: 0 },
  attack: { row: 3, frames: 6, frameDelay: 2 },
};

let ground, groundDeep, platformsL, platformsR, wallsL, wallsR;
let groundTile1Img, groundTile2Img, platforTileLImg, platforTileRImg, wallTileLImg, wallTileRImg;

//let bgFarX, bgMidX, bgForeX;

let attacking = false; // track if the player is attacking
let attackFrameCounter = 0; // tracking attack animation

// --- TILE MAP ---
// an array that uses the tile key to create the level
let level = [
  "                    g                   ", // row  0
  "                                        ", // row  1
  "                LggR                    ", // row  2
  "     LR   LgR          LR               ", // row  3: upper platforms
  "                                        ", // row  4
  "   LgggR       LR   LgR                 ", // row  5: mid platforms
  "         LgR            g   LggggR      ", // row  6: walls + low platform
  "               LgR                      ", // row  7
  "                                    LggR", // row  8
  "          LgR               LR  LR  [dd]", // row  9: mid-right platform
  "          [d]        gggg           [dd]", // row 10: wall below mid-right platform
  "ggggg  gggggggg   ggggggg  g ggggggggggg", // row 11: surface ground WITH GAPS
  "ddddd  dddddddd   ddddddd    ddddddddddd", // row 12: deep ground
];

// --- LEVEL CONSTANTS ---

// tile width & height
const TILE_W = 24;
const TILE_H = 24;

// animation frames width & height
const FRAME_W = 32;
const FRAME_H = 32;

// level size width & height based on level map
const LEVELW = TILE_W * level[0].length;
const LEVELH = TILE_H * level.length;

// camera view size
// uses tile size to determine how much we can see
const VIEWTILE_W = 10; // how many tiles wide should the camera view be
const VIEWTILE_H = 8; // how many tiles high should the camera view be
const VIEWW = TILE_W * VIEWTILE_W;
const VIEWH = TILE_H * VIEWTILE_H;

// Y-coordinate of player start (4 tiles above the bottom)
const PLAYER_START_Y = LEVELH - TILE_H * 4;

// gravity
const GRAVITY = 10;

function preload() {
  // --- IMAGES ---
  playerImg = loadImage("assets/foxSpriteSheet.png");
  bgFarImg = loadImage("assets/background_layer_1.png");
  bgMidImg = loadImage("assets/background_layer_2.png");
  bgForeImg = loadImage("assets/background_layer_3.png");
  groundTile1Img = loadImage("assets/groundTile.png");
  groundTile2Img = loadImage("assets/groundTileDeep.png");
  platformTileLImg = loadImage("assets/platformLC.png");
  platformTileRImg = loadImage("assets/platformRC.png");
  wallTileLImg = loadImage("assets/wallL.png");
  wallTileRImg = loadImage("assets/wallR.png");
}

function setup() {
  // pixelated rendering with autoscaling
  new Canvas(VIEWW, VIEWH, "pixelated");
  noSmooth();

  // force integer CSS scaling (prevents shimmer/blur)
  applyIntegerScale();
  window.addEventListener("resize", applyIntegerScale);

  // needed to correct an visual artifacts from attempted antialiasing
  allSprites.pixelPerfect = true;

  // uncomment the line below to show the collision box for every sprite
  //allSprites.debug = true;

  world.gravity.y = GRAVITY;

  // --- TILE GROUPS ---
  ground = new Group();
  ground.physics = "static";
  ground.img = groundTile1Img;
  ground.tile = "g";

  groundDeep = new Group();
  groundDeep.physics = "static";
  groundDeep.img = groundTile2Img;
  groundDeep.tile = "d";

  platformsL = new Group();
  platformsL.physics = "static";
  platformsL.img = platformTileLImg;
  platformsL.tile = "L";

  platformsR = new Group();
  platformsR.physics = "static";
  platformsR.img = platformTileRImg;
  platformsR.tile = "R";

  wallsL = new Group();
  wallsL.physics = "static";
  wallsL.img = wallTileLImg;
  wallsL.tile = "[";

  wallsR = new Group();
  wallsR.physics = "static";
  wallsR.img = wallTileRImg;
  wallsR.tile = "]";

  // creates the tiles based on the level map array
  new Tiles(level, 0, 0, TILE_W, TILE_H);

  // --- PLAYER ---
  player = new Sprite(FRAME_W, PLAYER_START_Y, FRAME_W, FRAME_H);
  player.spriteSheet = playerImg;
  player.rotationLock = true; // needed to turn off rotations
  player.anis.w = FRAME_W;
  player.anis.h = FRAME_H;
  player.anis.offset.y = -8; // offset the collision box up
  player.addAnis(playerAnis);

  player.ani = "idle";
  player.w = 18; // set the width of the collsion box
  player.h = 12; // set the height of the collsion box
  player.friction = 0;
  player.bounciness = 0;

  // --- GROUND SENSOR --- for use when detecting if the player is standing on the ground
  sensor = new Sprite();
  sensor.x = player.x;
  sensor.y = player.y + player.h / 2;
  sensor.w = player.w;
  sensor.h = 2;
  sensor.mass = 0.01;
  sensor.removeColliders();
  sensor.visible = false;
  let sensorJoint = new GlueJoint(player, sensor);
  sensorJoint.visible = false;

  // --- BACKGROUND  ---
  // Parallax backgrounds
  bgLayers = [
    { img: bgFarImg, speed: 0.2 },
    { img: bgMidImg, speed: 0.4 },
    { img: bgForeImg, speed: 0.6 },
  ];

  // we need to turn off the automated physics
  // so we can manually control when to advance it
  // the automated phyiscs can cause rendering issues
  world.autoStep = false;
}

function draw() {
  background(69, 61, 79);

  // manually advance the physics engine each time through the draw loop
  world.step();

  // --- CAMERA ---
  // assign the width and height of the camera view
  camera.width = VIEWW;
  camera.height = VIEWH;

  // camera follow player
  let targetX = constrain(player.x, VIEWW / 2, LEVELW - VIEWW / 2 - TILE_W / 2);
  let targetY = constrain(player.y, VIEWH / 2 - TILE_H * 2, LEVELH - VIEWH / 2 - TILE_H);

  // smooth + snap
  camera.x = Math.round(lerp(camera.x || targetX, targetX, 0.1));
  camera.y = Math.round(lerp(camera.y || targetY, targetY, 0.1));

  // --- PLAYER CONTROLS ---
  // first check to see if the player is on the ground or a platform
  let grounded = sensor.overlapping(ground) || sensor.overlapping(platformsL) || sensor.overlapping(platformsR);

  // -- ATTACK INPUT --
  if (grounded && !attacking && kb.presses("space")) {
    attacking = true;
    attackFrameCounter = 0;
    player.vel.x = 0;
    player.ani.frame = 0;
    player.ani = "attack";
    player.ani.play(); // plays once to end
  }

  // -- JUMP --
  if (grounded && kb.presses("up")) {
    player.vel.y = -4.5;
  }

  // --- STATE MACHINE ---
  if (attacking) {
    attackFrameCounter++;
    // Attack lasts ~6 frames * frameDelay 2 = 12 cycles (adjust if needed)
    if (attackFrameCounter > 12) {
      attacking = false;
      attackFrameCounter = 0;
    }
  } else if (!grounded) {
    player.ani = "jump";
    player.ani.frame = player.vel.y < 0 ? 0 : 1;
  } else {
    player.ani = kb.pressing("left") || kb.pressing("right") ? "run" : "idle";
  }

  // --- MOVEMENT ---
  if (!attacking) {
    player.vel.x = 0;
    if (kb.pressing("left")) {
      player.vel.x = -1.5;
      player.mirror.x = true;
    } else if (kb.pressing("right")) {
      player.vel.x = 1.5;
      player.mirror.x = false;
    }
  }

  // --- PLAYER BOUNDS ---
  player.x = constrain(player.x, FRAME_W / 2, LEVELW - FRAME_W / 2);

  // --- BACKGROUNDS (screen space) ---
  camera.off();
  imageMode(CORNER);

  // hard-disable smoothing at the canvas context level
  drawingContext.imageSmoothingEnabled = false;

  for (const layer of bgLayers) {
    const img = layer.img;
    const w = img.width; // background images are 341px wide

    // camera.x is already rounded, but keep the scroll pixel-snapped
    let x = Math.round((-camera.x * layer.speed) % w);

    // keep x in [-w, 0] so we can draw forward
    if (x > 0) x -= w;

    // draw enough copies to fill the view
    for (let tx = x; tx < VIEWW + w; tx += w) {
      image(img, tx, 0);
    }
  }

  camera.on();

  // --- PLAYER LOSE STATE ---
  // falls off level
  if (player.y > LEVELH + TILE_H * 3) {
    player.x = FRAME_W;
    player.y = PLAYER_START_Y;
  }

  // --- PIXEL SNAP (render only) ---
  // this is needed to help with some blurring that happens
  // with pixel art based animations
  const px = player.x,
    py = player.y;
  const sx = sensor.x,
    sy = sensor.y;

  player.x = Math.round(player.x);
  player.y = Math.round(player.y);
  sensor.x = Math.round(sensor.x);
  sensor.y = Math.round(sensor.y);

  allSprites.draw();

  player.x = px;
  player.y = py;
  sensor.x = sx;
  sensor.y = sy;
}

function applyIntegerScale() {
  const c = document.querySelector("canvas");
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEWW, window.innerHeight / VIEWH)));
  c.style.width = VIEWW * scale + "px";
  c.style.height = VIEWH * scale + "px";
}
