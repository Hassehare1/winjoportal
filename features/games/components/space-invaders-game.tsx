"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameStatus = "ready" | "running" | "paused" | "lost";
type DifficultyKey = "rookie" | "normal" | "ace";
type SoundEffect = "player_shoot" | "enemy_hit" | "player_hit" | "lost" | "level_up";

type DifficultyPreset = {
  label: string;
  startLives: number;
  enemySpeedMultiplier: number;
  enemyFireIntervalMultiplier: number;
  playerShotCooldownMultiplier: number;
  enemyDropStep: number;
};

type Enemy = {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  alive: boolean;
};

type Bullet = {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  owner: "player" | "enemy";
};

type Star = {
  x: number;
  y: number;
  r: number;
  alpha: number;
};

type EngineState = {
  status: GameStatus;
  score: number;
  lives: number;
  level: number;
  difficulty: DifficultyKey;
  playerX: number;
  moveLeft: boolean;
  moveRight: boolean;
  wantsToShoot: boolean;
  shootCooldownMs: number;
  playerShotCooldownMs: number;
  enemyDirection: number;
  enemySpeed: number;
  enemyShootTimerMs: number;
  enemyShootIntervalMs: number;
  enemyDropStep: number;
  enemyFrame: 0 | 1;
  enemyAnimationTimerMs: number;
  enemies: Enemy[];
  bullets: Bullet[];
  stars: Star[];
  soundQueue: SoundEffect[];
};

type HudState = {
  status: GameStatus;
  score: number;
  lives: number;
  level: number;
  difficulty: DifficultyKey;
};

const DIFFICULTY_PRESETS: Record<DifficultyKey, DifficultyPreset> = {
  rookie: {
    label: "Rookie",
    startLives: 4,
    enemySpeedMultiplier: 0.86,
    enemyFireIntervalMultiplier: 1.2,
    playerShotCooldownMultiplier: 0.82,
    enemyDropStep: 18
  },
  normal: {
    label: "Normal",
    startLives: 3,
    enemySpeedMultiplier: 1,
    enemyFireIntervalMultiplier: 1,
    playerShotCooldownMultiplier: 1,
    enemyDropStep: 24
  },
  ace: {
    label: "Ace",
    startLives: 2,
    enemySpeedMultiplier: 1.2,
    enemyFireIntervalMultiplier: 0.82,
    playerShotCooldownMultiplier: 1.18,
    enemyDropStep: 28
  }
};

const GAME_WIDTH = 820;
const GAME_HEIGHT = 540;
const PLAYER_SPRITE = [
  "W.........W.",
  "W.........W.",
  "W....C....W.",
  "W...W.W...W.",
  "W..W...W..W.",
  "W.W.....W.W.",
  "WW.......WW.",
  "W.........W."
];
const PLAYER_PIXEL = 4;
const PLAYER_WIDTH = PLAYER_SPRITE[0]?.length ? PLAYER_SPRITE[0].length * PLAYER_PIXEL : 48;
const PLAYER_HEIGHT = PLAYER_SPRITE.length * PLAYER_PIXEL;
const PLAYER_Y = GAME_HEIGHT - 24;
const PLAYER_SPEED = 420;
const PLAYER_SHOT_SPEED = 560;
const BASE_PLAYER_SHOT_COOLDOWN_MS = 230;

const ENEMY_SPRITES = [
  [
    "..XX..XX....",
    ".XXXXXXXX...",
    "XX.XXXX.XX..",
    "XXXXXXXXXX..",
    "X.XXXXXX.X..",
    "...X..X.....",
    "..X....X....",
    ".X......X..."
  ],
  [
    "...X..X.....",
    "..XXXXXX....",
    ".X.XXXX.X...",
    "XXXXXXXXXX..",
    "XX.X..X.XX..",
    "...XX.XX....",
    "..X....X....",
    ".X......X..."
  ]
] as const;

const ENEMY_PIXEL = 3;
const ENEMY_WIDTH = ENEMY_SPRITES[0][0].length * ENEMY_PIXEL;
const ENEMY_HEIGHT = ENEMY_SPRITES[0].length * ENEMY_PIXEL;
const ENEMY_GAP_X = 16;
const ENEMY_GAP_Y = 16;
const ENEMY_ROWS = 4;
const ENEMY_COLS = 10;
const ENEMY_SHOT_SPEED = 260;
const BASE_ENEMY_SPEED = 44;
const BASE_ENEMY_INTERVAL_MS = 1060;
const ENEMY_MIN_INTERVAL_MS = 320;
const ENEMY_ANIMATION_INTERVAL_MS = 220;

const HIGH_SCORE_STORAGE_KEY = "winjo_invaders_high_score_v1";

const initialHud: HudState = {
  status: "ready",
  score: 0,
  lives: DIFFICULTY_PRESETS.normal.startLives,
  level: 1,
  difficulty: "normal"
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function createStars() {
  return Array.from({ length: 100 }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    r: Math.random() * 1.5 + 0.25,
    alpha: Math.random() * 0.8 + 0.2
  }));
}

function createEnemyWave(level: number): Enemy[] {
  const formationWidth = ENEMY_COLS * ENEMY_WIDTH + (ENEMY_COLS - 1) * ENEMY_GAP_X;
  const startX = (GAME_WIDTH - formationWidth) / 2;
  const startY = 58 + Math.min(level - 1, 4) * 4;
  const enemies: Enemy[] = [];

  for (let row = 0; row < ENEMY_ROWS; row += 1) {
    for (let col = 0; col < ENEMY_COLS; col += 1) {
      enemies.push({
        x: startX + col * (ENEMY_WIDTH + ENEMY_GAP_X),
        y: startY + row * (ENEMY_HEIGHT + ENEMY_GAP_Y),
        width: ENEMY_WIDTH,
        height: ENEMY_HEIGHT,
        row,
        alive: true
      });
    }
  }

  return enemies;
}

function getDifficultyScaling(level: number, difficulty: DifficultyKey) {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const levelIndex = Math.max(level - 1, 0);
  const curve = 1 + Math.min(levelIndex * 0.09, 0.95) + Math.min(Math.pow(levelIndex, 1.18) * 0.02, 0.9);
  const enemySpeed = BASE_ENEMY_SPEED * preset.enemySpeedMultiplier * curve;
  const enemyInterval = clamp(
    (BASE_ENEMY_INTERVAL_MS * preset.enemyFireIntervalMultiplier) / (1 + levelIndex * 0.08),
    ENEMY_MIN_INTERVAL_MS,
    1600
  );
  const playerShotCooldown = BASE_PLAYER_SHOT_COOLDOWN_MS * preset.playerShotCooldownMultiplier;

  return {
    enemySpeed,
    enemyInterval,
    playerShotCooldown,
    enemyDropStep: preset.enemyDropStep
  };
}

function createInitialState(): EngineState {
  const difficulty: DifficultyKey = "normal";
  const scaling = getDifficultyScaling(1, difficulty);
  return {
    status: "ready",
    score: 0,
    lives: DIFFICULTY_PRESETS[difficulty].startLives,
    level: 1,
    difficulty,
    playerX: GAME_WIDTH / 2,
    moveLeft: false,
    moveRight: false,
    wantsToShoot: false,
    shootCooldownMs: 0,
    playerShotCooldownMs: scaling.playerShotCooldown,
    enemyDirection: 1,
    enemySpeed: scaling.enemySpeed,
    enemyShootTimerMs: scaling.enemyInterval,
    enemyShootIntervalMs: scaling.enemyInterval,
    enemyDropStep: scaling.enemyDropStep,
    enemyFrame: 0,
    enemyAnimationTimerMs: ENEMY_ANIMATION_INTERVAL_MS,
    enemies: createEnemyWave(1),
    bullets: [],
    stars: createStars(),
    soundQueue: []
  };
}

function restartLevel(engine: EngineState, level: number) {
  const scaling = getDifficultyScaling(level, engine.difficulty);
  engine.level = level;
  engine.enemyDirection = 1;
  engine.enemySpeed = scaling.enemySpeed;
  engine.enemyShootIntervalMs = scaling.enemyInterval;
  engine.enemyShootTimerMs = scaling.enemyInterval;
  engine.playerShotCooldownMs = scaling.playerShotCooldown;
  engine.enemyDropStep = scaling.enemyDropStep;
  engine.enemyFrame = 0;
  engine.enemyAnimationTimerMs = ENEMY_ANIMATION_INTERVAL_MS;
  engine.enemies = createEnemyWave(level);
  engine.bullets = [];
}

function resetGame(engine: EngineState) {
  engine.status = "running";
  engine.score = 0;
  engine.lives = DIFFICULTY_PRESETS[engine.difficulty].startLives;
  engine.playerX = GAME_WIDTH / 2;
  engine.moveLeft = false;
  engine.moveRight = false;
  engine.wantsToShoot = false;
  engine.shootCooldownMs = 0;
  engine.soundQueue = [];
  restartLevel(engine, 1);
}

function setDifficulty(engine: EngineState, difficulty: DifficultyKey) {
  engine.difficulty = difficulty;
  resetGame(engine);
}

function buildHudState(engine: EngineState): HudState {
  return {
    status: engine.status,
    score: engine.score,
    lives: engine.lives,
    level: engine.level,
    difficulty: engine.difficulty
  };
}

function pickEnemyShooter(enemies: Enemy[]) {
  const byColumn = new Map<number, Enemy>();
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const col = Math.round(enemy.x / (ENEMY_WIDTH + ENEMY_GAP_X));
    const existing = byColumn.get(col);
    if (!existing || enemy.y > existing.y) {
      byColumn.set(col, enemy);
    }
  }

  const shooters = Array.from(byColumn.values());
  if (shooters.length === 0) return null;
  return shooters[Math.floor(Math.random() * shooters.length)] ?? null;
}

function addPlayerBullet(engine: EngineState) {
  engine.bullets.push({
    x: engine.playerX - 2,
    y: PLAYER_Y - PLAYER_HEIGHT - 10,
    width: 4,
    height: 14,
    velocityY: -PLAYER_SHOT_SPEED,
    owner: "player"
  });
  engine.soundQueue.push("player_shoot");
}

function addEnemyBullet(engine: EngineState) {
  const shooter = pickEnemyShooter(engine.enemies);
  if (!shooter) return;

  engine.bullets.push({
    x: shooter.x + shooter.width / 2 - 2,
    y: shooter.y + shooter.height + 3,
    width: 4,
    height: 12,
    velocityY: ENEMY_SHOT_SPEED + engine.level * 12,
    owner: "enemy"
  });
}

function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  sprite: readonly string[],
  x: number,
  y: number,
  pixelSize: number,
  palette: Record<string, string>
) {
  for (let row = 0; row < sprite.length; row += 1) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col += 1) {
      const token = line[col];
      if (token === ".") continue;
      const color = palette[token] ?? palette.default;
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
    }
  }
}

function drawPlayerW(ctx: CanvasRenderingContext2D, centerX: number) {
  const left = Math.round(centerX - PLAYER_WIDTH / 2);
  const top = PLAYER_Y - PLAYER_HEIGHT;

  ctx.shadowColor = "rgba(34, 211, 238, 0.7)";
  ctx.shadowBlur = 9;
  drawPixelSprite(ctx, PLAYER_SPRITE, left, top, PLAYER_PIXEL, {
    W: "#67e8f9",
    C: "#22d3ee"
  });
  ctx.shadowBlur = 0;
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, frame: 0 | 1) {
  const colors = ["#fb7185", "#f97316", "#e879f9", "#a78bfa"];
  const color = colors[enemy.row] ?? "#f97316";
  drawPixelSprite(ctx, ENEMY_SPRITES[frame], enemy.x, enemy.y, ENEMY_PIXEL, {
    X: color
  });
}

function drawScene(ctx: CanvasRenderingContext2D, engine: EngineState) {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(1, "#111827");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  for (const star of engine.stars) {
    ctx.fillStyle = `rgba(226, 232, 240, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(148, 163, 184, 0.25)";
  ctx.fillRect(0, PLAYER_Y + 6, GAME_WIDTH, 2);

  for (const enemy of engine.enemies) {
    if (enemy.alive) {
      drawEnemy(ctx, enemy, engine.enemyFrame);
    }
  }

  for (const bullet of engine.bullets) {
    ctx.fillStyle = bullet.owner === "player" ? "#22d3ee" : "#f97316";
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  }

  drawPlayerW(ctx, engine.playerX);
}

function updateEngine(engine: EngineState, dtMs: number) {
  const dt = dtMs / 1000;
  const playerMinX = PLAYER_WIDTH / 2 + 8;
  const playerMaxX = GAME_WIDTH - PLAYER_WIDTH / 2 - 8;

  if (engine.moveLeft) {
    engine.playerX -= PLAYER_SPEED * dt;
  }
  if (engine.moveRight) {
    engine.playerX += PLAYER_SPEED * dt;
  }
  engine.playerX = clamp(engine.playerX, playerMinX, playerMaxX);

  engine.shootCooldownMs = Math.max(0, engine.shootCooldownMs - dtMs);
  if (engine.wantsToShoot && engine.shootCooldownMs <= 0) {
    addPlayerBullet(engine);
    engine.shootCooldownMs = engine.playerShotCooldownMs;
  }

  engine.enemyAnimationTimerMs -= dtMs;
  if (engine.enemyAnimationTimerMs <= 0) {
    engine.enemyFrame = engine.enemyFrame === 0 ? 1 : 0;
    engine.enemyAnimationTimerMs = ENEMY_ANIMATION_INTERVAL_MS;
  }

  let leftMost = Number.POSITIVE_INFINITY;
  let rightMost = Number.NEGATIVE_INFINITY;
  let lowestEnemy = Number.NEGATIVE_INFINITY;

  for (const enemy of engine.enemies) {
    if (!enemy.alive) continue;
    enemy.x += engine.enemyDirection * engine.enemySpeed * dt;
    leftMost = Math.min(leftMost, enemy.x);
    rightMost = Math.max(rightMost, enemy.x + enemy.width);
    lowestEnemy = Math.max(lowestEnemy, enemy.y + enemy.height);
  }

  if (leftMost <= 14 || rightMost >= GAME_WIDTH - 14) {
    engine.enemyDirection *= -1;
    for (const enemy of engine.enemies) {
      if (enemy.alive) {
        enemy.y += engine.enemyDropStep;
      }
    }
  }

  if (lowestEnemy >= PLAYER_Y - 4) {
    engine.status = "lost";
    engine.soundQueue.push("lost");
    return;
  }

  engine.enemyShootTimerMs -= dtMs;
  if (engine.enemyShootTimerMs <= 0) {
    addEnemyBullet(engine);
    engine.enemyShootTimerMs = engine.enemyShootIntervalMs;
  }

  const nextBullets: Bullet[] = [];
  const playerRect = {
    x: engine.playerX - PLAYER_WIDTH / 2 + 2,
    y: PLAYER_Y - PLAYER_HEIGHT,
    width: PLAYER_WIDTH - 4,
    height: PLAYER_HEIGHT
  };

  for (const bullet of engine.bullets) {
    const moved: Bullet = {
      ...bullet,
      y: bullet.y + bullet.velocityY * dt
    };

    if (moved.y < -20 || moved.y > GAME_HEIGHT + 20) {
      continue;
    }

    if (moved.owner === "player") {
      let enemyHit = false;
      for (const enemy of engine.enemies) {
        if (!enemy.alive) continue;
        if (intersects(moved, enemy)) {
          enemy.alive = false;
          const rowBonus = ENEMY_ROWS - enemy.row;
          const difficultyBonus = engine.difficulty === "ace" ? 1.35 : engine.difficulty === "rookie" ? 0.9 : 1;
          engine.score += Math.round((18 + rowBonus * 6) * difficultyBonus);
          engine.soundQueue.push("enemy_hit");
          enemyHit = true;
          break;
        }
      }
      if (!enemyHit) {
        nextBullets.push(moved);
      }
    } else if (intersects(moved, playerRect)) {
      engine.lives -= 1;
      engine.soundQueue.push("player_hit");
      if (engine.lives <= 0) {
        engine.status = "lost";
        engine.soundQueue.push("lost");
        return;
      }
    } else {
      nextBullets.push(moved);
    }
  }

  engine.bullets = nextBullets;

  const aliveEnemies = engine.enemies.filter((enemy) => enemy.alive).length;
  if (aliveEnemies === 0) {
    const levelClearBonus = engine.difficulty === "ace" ? 180 : engine.difficulty === "rookie" ? 110 : 140;
    engine.score += levelClearBonus;
    engine.soundQueue.push("level_up");
    restartLevel(engine, engine.level + 1);
  }
}

function useSoundEngine() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === "undefined") return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    async (frequency: number, durationMs: number, type: OscillatorType, gainPeak: number, endFrequency?: number) => {
      const context = await ensureAudioContext();
      if (!context) return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      if (typeof endFrequency === "number") {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + durationMs / 1000);
      }

      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainPeak, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + durationMs / 1000);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + durationMs / 1000 + 0.02);
    },
    [ensureAudioContext]
  );

  const playEffect = useCallback(
    async (effect: SoundEffect) => {
      try {
        if (effect === "player_shoot") {
          await playTone(780, 60, "square", 0.04, 640);
          return;
        }
        if (effect === "enemy_hit") {
          await playTone(240, 90, "sawtooth", 0.05, 150);
          return;
        }
        if (effect === "player_hit") {
          await playTone(160, 140, "triangle", 0.06, 90);
          return;
        }
        if (effect === "level_up") {
          await playTone(420, 90, "square", 0.03, 620);
          await playTone(640, 110, "square", 0.03, 920);
          return;
        }
        if (effect === "lost") {
          await playTone(220, 130, "triangle", 0.05, 140);
          await playTone(140, 190, "triangle", 0.05, 80);
        }
      } catch {
        // Audio should fail silently if browser blocks sound.
      }
    },
    [playTone]
  );

  return {
    ensureAudioContext,
    playEffect
  };
}

export function SpaceInvadersGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineState | null>(null);
  const frameRef = useRef<number | null>(null);
  const previousFrameTimeRef = useRef<number | null>(null);

  const [hud, setHud] = useState<HudState>(initialHud);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  });
  const [soundOn, setSoundOn] = useState(true);
  const [difficulty, setDifficultyState] = useState<DifficultyKey>("normal");

  const highScoreRef = useRef(highScore);
  const { ensureAudioContext, playEffect } = useSoundEngine();

  const syncHud = useCallback((engine: EngineState) => {
    const next = buildHudState(engine);
    if (next.score > highScoreRef.current) {
      highScoreRef.current = next.score;
      setHighScore(next.score);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(next.score));
      }
    }

    setHud((prev) => {
      if (
        prev.status === next.status &&
        prev.level === next.level &&
        prev.lives === next.lives &&
        prev.score === next.score &&
        prev.difficulty === next.difficulty
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const flushSoundQueue = useCallback(
    (engine: EngineState) => {
      if (!soundOn || engine.soundQueue.length === 0) {
        engine.soundQueue = [];
        return;
      }

      const queue = [...engine.soundQueue];
      engine.soundQueue = [];
      for (const effect of queue) {
        void playEffect(effect);
      }
    },
    [playEffect, soundOn]
  );

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    void ensureAudioContext();
    resetGame(engine);
    syncHud(engine);
  }, [ensureAudioContext, syncHud]);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.status === "running") {
      engine.status = "paused";
    } else if (engine.status === "paused") {
      engine.status = "running";
    }
    syncHud(engine);
  }, [syncHud]);

  const applyDifficulty = useCallback(
    (nextDifficulty: DifficultyKey) => {
      setDifficultyState(nextDifficulty);
      const engine = engineRef.current;
      if (!engine) return;
      setDifficulty(engine, nextDifficulty);
      syncHud(engine);
    },
    [syncHud]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;

    const engine = createInitialState();
    engineRef.current = engine;
    drawScene(context, engine);

    const loop = (timestamp: number) => {
      if (!engineRef.current) return;

      if (previousFrameTimeRef.current === null) {
        previousFrameTimeRef.current = timestamp;
      }
      const elapsed = clamp(timestamp - previousFrameTimeRef.current, 0, 40);
      previousFrameTimeRef.current = timestamp;

      if (engine.status === "running") {
        updateEngine(engine, elapsed);
      }

      drawScene(context, engine);
      syncHud(engine);
      flushSoundQueue(engine);
      frameRef.current = window.requestAnimationFrame(loop);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const current = engineRef.current;
      if (!current) return;

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        current.moveLeft = true;
        event.preventDefault();
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        current.moveRight = true;
        event.preventDefault();
      }
      if (event.key === " ") {
        void ensureAudioContext();
        if (current.status === "ready" || current.status === "lost") {
          resetGame(current);
        }
        if (current.status === "paused") {
          current.status = "running";
        }
        current.wantsToShoot = true;
        syncHud(current);
        event.preventDefault();
      }
      if (event.key.toLowerCase() === "p") {
        togglePause();
        event.preventDefault();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const current = engineRef.current;
      if (!current) return;

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        current.moveLeft = false;
        event.preventDefault();
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        current.moveRight = false;
        event.preventDefault();
      }
      if (event.key === " ") {
        current.wantsToShoot = false;
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    frameRef.current = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [ensureAudioContext, flushSoundQueue, syncHud, togglePause]);

  const setControlState = useCallback(
    (control: "left" | "right" | "shoot", active: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (control === "left") {
        engine.moveLeft = active;
      }
      if (control === "right") {
        engine.moveRight = active;
      }
      if (control === "shoot") {
        if (active) {
          void ensureAudioContext();
        }
        if (active && (engine.status === "ready" || engine.status === "lost")) {
          resetGame(engine);
        }
        if (active && engine.status === "paused") {
          engine.status = "running";
        }
        engine.wantsToShoot = active;
        syncHud(engine);
      }
    },
    [ensureAudioContext, syncHud]
  );

  const statusMessage =
    hud.status === "ready"
      ? "Tryck Starta eller Space for att borja."
      : hud.status === "paused"
        ? "Pausad. Tryck P for att fortsatta."
        : hud.status === "lost"
          ? "Game over. Starta igen."
          : `Niva ${hud.level} - ${DIFFICULTY_PRESETS[hud.difficulty].label}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18.5rem]">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-card">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="w-full rounded-xl border border-slate-700 bg-slate-950"
            role="img"
            aria-label="Space invaders spelplan med ett W-format skepp."
          />
          {hud.status !== "running" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/55">
              <button
                type="button"
                onClick={startGame}
                className="pointer-events-auto rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                {hud.status === "lost" ? "Spela igen" : "Starta spel"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 md:hidden">
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100"
            onPointerDown={() => setControlState("left", true)}
            onPointerUp={() => setControlState("left", false)}
            onPointerCancel={() => setControlState("left", false)}
          >
            Vaster
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100"
            onPointerDown={() => setControlState("shoot", true)}
            onPointerUp={() => setControlState("shoot", false)}
            onPointerCancel={() => setControlState("shoot", false)}
          >
            Skjut
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100"
            onPointerDown={() => setControlState("right", true)}
            onPointerUp={() => setControlState("right", false)}
            onPointerCancel={() => setControlState("right", false)}
          >
            Hoger
          </button>
        </div>
      </div>

      <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="font-heading text-xl font-bold text-slate-900">Status</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-slate-600">Poang</dt>
            <dd className="font-semibold text-slate-900">{hud.score}</dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-slate-600">Highscore</dt>
            <dd className="font-semibold text-slate-900">{highScore}</dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-slate-600">Liv</dt>
            <dd className="font-semibold text-slate-900">{hud.lives}</dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-slate-600">Niva</dt>
            <dd className="font-semibold text-slate-900">{hud.level}</dd>
          </div>
        </dl>

        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
          {statusMessage}
        </p>

        <div className="mt-4 space-y-2">
          <label htmlFor="difficulty" className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
            Svarighetskurva
          </label>
          <select
            id="difficulty"
            name="difficulty"
            value={difficulty}
            onChange={(event) => applyDifficulty(event.target.value as DifficultyKey)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="rookie">Rookie (snallare)</option>
            <option value="normal">Normal</option>
            <option value="ace">Ace (tuffare)</option>
          </select>
          <p className="text-xs text-slate-600">Byte av lage startar om rundan med ny kurva.</p>
        </div>

        <div className="mt-5 space-y-2 text-xs text-slate-600">
          <p className="font-semibold uppercase tracking-[0.12em] text-slate-700">Kontroller</p>
          <p>`A/D` eller `Piltangenter`: flytta</p>
          <p>`Space`: skjut och starta</p>
          <p>`P`: pausa/fortsatt</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={togglePause}
            disabled={hud.status === "ready" || hud.status === "lost"}
          >
            {hud.status === "paused" ? "Fortsatt" : "Pausa"}
          </button>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={() => {
              setSoundOn((prev) => !prev);
              void ensureAudioContext();
            }}
          >
            {soundOn ? "Ljud: Pa" : "Ljud: Av"}
          </button>
        </div>
      </aside>
    </div>
  );
}
