let video;
let handpose;
let predictions = [];

let backgroundImg;
let cloudImg;
let clouds = [];

let bgX = 0;
let score = 0;
let isGameOver = false;
let restartButton;

let level = 0;
let trapSpeed = 5;
let lastLevelAnnounced = -1;

let player = {
  x: 100,
  y: 310,
  size: 60,
  velocityY: 0,
  isJumping: false
};

let gravity = 0.96;
let jumpForce = -23;
let previousY = null;

let playerImg;
let trap1, trap2;
let trapFrame = 0;
let trapFrameTimer = 0;
let traps = [];

let jumpSound, deathSound, levelUpSound;
let handFlashColor = [0, 255, 0];
let lastDetectedTime = -1000;

function preload() {
  playerImg = loadImage("assets/rabbit-bw.gif");
  trap1 = loadImage("assets/trap-1.png");
  trap2 = loadImage("assets/trap-2.png");
  backgroundImg = loadImage("assets/background.png");
  cloudImg = loadImage("assets/cloud.png");

  jumpSound = loadSound("assets/jump-sound.mp3");
  deathSound = loadSound("assets/death-sound.mp3");
  levelUpSound = loadSound("assets/level-up-sound.mp3");
}


function setup() {
  createCanvas(800, 400);

  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  video.style('transform', 'scaleX(-1)');

  handpose = ml5.handpose(video, { flipHorizontal: true }, modelReady);
  handpose.on("predict", results => predictions = results);

  setTimeout(spawnTraps, 3000);

  for (let i = 0; i < 3; i++) {
    clouds.push({
      x: random(width),
      y: random(30, 100),
      size: random(40, 60),
      speed: random(0.5, 1)
    });
  }

  restartButton = createButton('Restart');
  restartButton.position(width / 2 - 40, height / 2 + 40);
  restartButton.size(80, 30);
  restartButton.mousePressed(() => location.reload());
  restartButton.hide();
}

function modelReady() {
  console.log("Handpose model loaded");
}

function draw() {
  background(250);

  // Scrolling background
  image(backgroundImg, bgX, height - backgroundImg.height);
  image(backgroundImg, bgX + backgroundImg.width, height - backgroundImg.height);
  if (!isGameOver) {
    bgX -= 2;
    if (bgX <= -backgroundImg.width) bgX = 0;
  }

  // Clouds
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

  // Webcam feed (top left corner)
  push();
  translate(320, 0);
  scale(-1, 1);
  image(video, 0, 0, 320, 240);
  drawHandDots(); // 🟢 draw landmarks over camera
  pop();

  // Score and Level
  if (!isGameOver) {
    score++;
    let currentLevel = floor(score / 1000);
    if (currentLevel > lastLevelAnnounced) {
      trapSpeed++;
      levelUpSound.play();
      level = currentLevel;
      lastLevelAnnounced = currentLevel;
    }
  }

  fill(0);
  textSize(20);
  textAlign(RIGHT, TOP);
  text("Score: " + nf(score, 5), width - 20, 20);
  text("Level: " + level, width - 20, 50);

  handlePlayer();
  updateTraps();
  handleHandGestures();

  if (isGameOver) {
    fill(255, 0, 0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text("Game Over", width / 2, height / 2);
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
  if (trapFrameTimer > 10) {
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
      restartButton.show();
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
  if (predictions.length > 0) {
    let hand = predictions[0];
    let wristY = hand.landmarks[0][1];
    let palmBaseY = hand.landmarks[9][1];
    let handY = (wristY + palmBaseY) / 2;

    if (previousY !== null) {
      let speedY = previousY - handY;
      if (speedY > 6 && handY < previousY && !player.isJumping && !isGameOver) {
        player.velocityY = jumpForce;
        player.isJumping = true;
        jumpSound.play();

        // Flash orange when jump is triggered
        lastDetectedTime = millis();
        handFlashColor = [255, 165, 0];
      }
    }
    previousY = handY;
  }
}

function drawHandDots() {
  let currentTime = millis();

  // Revert to green after 500ms
  if (currentTime - lastDetectedTime > 500) {
    handFlashColor = [0, 255, 0];
  }

  for (let hand of predictions) {
    for (let i = 0; i < hand.landmarks.length; i++) {
      let [x, y] = hand.landmarks[i];
      fill(handFlashColor);
      noStroke();
      ellipse(x, y, 8, 8); // already inside mirrored space
    }
  }
}
