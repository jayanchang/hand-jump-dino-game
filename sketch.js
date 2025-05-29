// Optimized Hand Jump Dino Game with reduced lag
let video, handpose, predictions = [];

let backgroundImg, cloudImg, playerImg, trap1, trap2;
let jumpSound, deathSound, levelUpSound;
let clouds = [], traps = [];

let bgX = 0, score = 0, level = 0;
let isGameOver = false;
let trapSpeed = 5;
let lastLevelAnnounced = -1;
let lastDetectedTime = -1000;
let previousY = null;
let trapFrame = 0, trapFrameTimer = 0;
let lastPredictionTime = 0;
let predictionInterval = 120; // Less frequent prediction for performance
let handCooldown = 400;      // Cooldown to prevent jump spam

let restartButton, restartShown = false;

let player = {
  x: 100,
  y: 310,
  size: 60,
  velocityY: 0,
  isJumping: false
};

const gravity = 0.96;
const jumpForce = -22;

function preload() {
  playerImg = loadImage("rabbit-bw.gif");
  trap1 = loadImage("trap-1.png");
  trap2 = loadImage("trap-2.png");
  backgroundImg = loadImage("background.png");
  cloudImg = loadImage("cloud.png");

  jumpSound = loadSound("jump-sound.mp3");
  deathSound = loadSound("death-sound.mp3");
  levelUpSound = loadSound("level-up-sound.mp3");
}

function setup() {
  let cnv = createCanvas(800, 400);
  cnv.parent("game-container");

  video = createCapture(VIDEO);
  video.size(160, 120); // Slightly smaller for performance
  video.hide();
  video.parent("game-container");

  noSmooth(); // Disable canvas smoothing for a small perf boost

  handpose = ml5.handpose(video, { flipHorizontal: true }, () => {
    console.log("Handpose loaded");
  });
  handpose.on("predict", results => predictions = results);

  for (let i = 0; i < 3; i++) {
    clouds.push({
      x: random(width),
      y: random(30, 100),
      size: random(40, 60),
      speed: random(0.5, 1)
    });
  }

  restartButton = createButton('Restart');
  restartButton.parent("game-container");
  restartButton.size(80, 30);
  restartButton.mousePressed(() => location.reload());
  restartButton.hide();

  setTimeout(spawnTraps, 2000);
}

function draw() {
  background(250);

  // Scroll background
  image(backgroundImg, bgX, height - backgroundImg.height);
  image(backgroundImg, bgX + backgroundImg.width, height - backgroundImg.height);
  if (!isGameOver) {
    bgX -= 2;
    if (bgX <= -backgroundImg.width) bgX = 0;
  }

  // Draw clouds
  for (let c of clouds) {
    image(cloudImg, c.x, c.y, c.size, c.size);
    if (!isGameOver) {
      c.x -= c.speed;
      if (c.x + c.size < 0) {
        c.x = width + random(50, 100);
        c.y = random(30, height / 2);
      }
    }
  }

  // Draw mirrored webcam aligned to top-left
  push();
  translate(video.width, 0);
  scale(-1, 1);
  image(video, 0, 0, video.width, video.height);
  pop();

  // Score and level system
  if (!isGameOver) {
    score++;
    let currentLevel = floor(score / 500);
    if (currentLevel > lastLevelAnnounced) {
      trapSpeed++;
      levelUpSound.play();
      level = currentLevel;
      lastLevelAnnounced = currentLevel;
    }
  }

  // HUD
  fill(0);
  textSize(20);
  textAlign(RIGHT, TOP);
  text(`Score: ${nf(score, 5)}`, width - 20, 20);
  text(`Level: ${level}`, width - 20, 50);

  handlePlayer();
  updateTraps();
  handleHandGestures();

  if (isGameOver) {
    fill(255, 0, 0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text("Game Over", width / 2, height / 2);

    if (!restartShown) {
      restartButton.position(canvas.offsetLeft + width / 2 - 40, canvas.offsetTop + height / 2 + 30);
      restartButton.show();
      restartShown = true;
    }
  }
}

function handlePlayer() {
  if (!isGameOver) {
    player.velocityY += gravity;
    player.y += player.velocityY;
  }
  if (player.y >= 310) {
    player.y = 310;
    player.velocityY = 0;
    player.isJumping = false;
  }
  imageMode(CENTER);
  image(playerImg, player.x, player.y, player.size, player.size);
}

function updateTraps() {
  trapFrameTimer++;
  if (trapFrameTimer > 5) {
    trapFrame = (trapFrame + 1) % 2;
    trapFrameTimer = 0;
  }

  for (let i = traps.length - 1; i >= 0; i--) {
    let t = traps[i];
    if (!isGameOver) t.x -= trapSpeed;

    imageMode(CENTER);
    image(trapFrame === 0 ? trap1 : trap2, t.x + t.w / 2, t.y + t.h / 2, t.w, t.h);

    let buffer = 0.6;
    if (
      player.x + (player.size / 2) * buffer > t.x &&
      player.x - (player.size / 2) * buffer < t.x + t.w &&
      player.y + (player.size / 2) * buffer > t.y &&
      !isGameOver
    ) {
      isGameOver = true;
      deathSound.play();
    }

    if (t.x + t.w < 0) {
      traps.splice(i, 1);
      if (traps.length === 0 && !isGameOver) spawnTraps();
    }
  }
}

function spawnTraps() {
  let count = random() < 0.5 ? 1 : 2;
  let spacing = 0;
  for (let i = 0; i < count; i++) {
    let w = random(50, 70);
    let h = random(50, 70);
    traps.push({
      x: width + spacing,
      y: 310 - h / 2,
      w: w,
      h: h
    });
    spacing += random(30, 50);
  }
}

function handleHandGestures() {
  let now = millis();
  if (now - lastPredictionTime < predictionInterval) return;
  lastPredictionTime = now;

  if (predictions.length > 0) {
    let hand = predictions[0];
    let wristY = hand.landmarks[0][1];
    let palmBaseY = hand.landmarks[9][1];
    let handY = (wristY + palmBaseY) / 2;

    if (previousY !== null) {
      let speedY = previousY - handY;
      if (
        speedY > 3.5 &&
        handY < previousY &&
        !player.isJumping &&
        !isGameOver &&
        now - lastDetectedTime > handCooldown
      ) {
        player.velocityY = jumpForce;
        player.isJumping = true;
        jumpSound.play();
        lastDetectedTime = now;
      }
    }
    previousY = handY;
  }
}
