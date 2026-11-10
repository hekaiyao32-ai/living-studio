/*
 * Twist — 空间构图 + 非均匀矩形台阶
 *
 * 原始色段生成、运动及点击切换逻辑保留。
 * 空间投影不使用随机数。
 */

// ========================================
// 原动画参数
// ========================================

const SETTINGS = {
  seed: 20240921,
  bands: 6,
  inward: true,
  mirrorX: false,
  mirrorY: false,
  speed: 1,
  lengthRange: [1, 2],
  lengthQuantum: 1,
  lengthBias: 2,
  colorHistory: 2,

  palette: [
    "#ed1e79", "#e6e6e6",
    "#662d91", "#00a99d",
    "#29abe2", "#333333",
    "#ffff9b", "#c4e9fb"
  ]
};

// ========================================
// 空间参数
// ========================================

const DEPTH = {
  enabled: true,

  // 0～3，对应按键 5～8
  layout: 0,

  sourceCenter: 0.34,

  // 鼠标视差幅度，0 为关闭
  parallax: 0.055,

  // 侧面明暗，0 为原始颜色
  shading: 0.24
};

// entry：入口半宽、半高
// back：远端半宽、半高
// offset：远端偏移，使用标准化坐标
const LAYOUTS = [
  {
    name: "竖向远端",
    entry: [0.80, 0.92],
    back: [0.12, 0.23],
    offset: [0, 0]
  },
  {
    name: "横向远端",
    entry: [0.92, 0.80],
    back: [0.27, 0.11],
    offset: [0, 0]
  },
  {
    name: "方形深井",
    entry: [0.86, 0.86],
    back: [0.17, 0.17],
    offset: [0, 0]
  },
  {
    name: "偏心深井",
    entry: [0.84, 0.90],
    back: [0.14, 0.20],
    offset: [0.075, -0.045]
  }
];

// 非均匀的空间节奏
// 每两项对应一个平台和一个下沉侧面
const SOURCE_WEIGHTS = [
  0.24, 0.12,
  0.10, 0.12,
  0.08, 0.12,
  0.06, 0.16
];

// 各层实际下沉距离比例
const DEPTH_WEIGHTS = [
  0.13, 0.20, 0.28, 0.39
];

// 平台尺寸变化的累计比例
const PLATFORM_PROGRESS = [
  0, 0.55, 0.85, 1
];

const BAND_OPTIONS = [
  3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 14, 16, 18, 24, 48, 72
];

const PALETTES = [
  SETTINGS.palette.slice(),

  [
    "#ff6600", "#33cc99", "#ed1e79", "#662d91",
    "#29abe2", "#009245", "#ffff00", "#ff0000"
  ],

  [
    "#00a99d", "#666666", "#c4e9fb",
    "#29abe2", "#cccccc", "#fccdff"
  ],

  [
    "#595959", "#808080", "#404040",
    "#303030", "#999999", "#000000"
  ],

  ["#ffff9b", "#6600ff"],
  ["#000000", "#ffffff"],
  ["#ff4d2e", "#ff9f1c", "#ffe66d", "#37123c", "#17152e"],
  ["#003f5c", "#2f4b7c", "#a05195", "#f95d6a", "#ffa600"],
  ["#092e20", "#187a55", "#9acb75", "#eaf0ce", "#dcb67a"],
  ["#160f29", "#5b2a86", "#ff5fd7", "#00e5ff", "#f4f1ff"],
  ["#14213d", "#fca311", "#e5e5e5", "#ffffff", "#080f20"],
  ["#071e22", "#1d7874", "#85c7c4", "#d7f9f1", "#ffcb77"],
  ["#4a1942", "#893168", "#d65d91", "#f5b7c9", "#fdf0d5"],
  ["#0b132b", "#1c2541", "#3a506b", "#5bc0be", "#f0ffff"],
  ["#e63946", "#f1faee", "#a8dadc", "#457b9d", "#1d3557"],
  ["#202020", "#e8ff00", "#00e7a5", "#ff6b00", "#f7f7f2"]
];

let runs = [];
let parts = [];
let columns, rows;
let cellW, cellH;
let total;
let lengthMin, lengthMax;
let paused = false;

let sceneCache = null;
const shadeCache = new Map();

const pointerTarget = { x: 0, y: 0 };
const viewOffset = { x: 0, y: 0 };


// ========================================
// 初始化
// ========================================

function setup() {
  initGestureUI();
  const canvas = createCanvas(
    windowWidth,
    windowHeight
  );

  WORLD.display = canvas.elt;

  pixelDensity(
    Math.min(window.devicePixelRatio || 1, 2)
  );

  canvas.style("display", "block");
  canvas.style("touch-action", "none");

  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";

  canvas.elt.addEventListener(
    "pointerup",
    newVariation
  );

  canvas.elt.addEventListener(
    "pointermove",
    event => {
      const bounds =
        canvas.elt.getBoundingClientRect();

      pointerTarget.x = constrain(
        2 * (event.clientX - bounds.left) /
        bounds.width - 1,
        -1, 1
      );

      pointerTarget.y = constrain(
        2 * (event.clientY - bounds.top) /
        bounds.height - 1,
        -1, 1
      );
    }
  );

  canvas.elt.addEventListener(
    "pointerleave",
    () => {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
    }
  );

  noStroke();

  describe(
    "自动向前穿梭的旋转万花筒隧道。张手破碎，握拳复原，伸指切换配色，整体随手掌方向晃动。"
  );

  rebuild();
  resetFX();
}


// ========================================
// 原始螺旋路径
// ========================================

function rebuild() {
  randomSeed(SETTINGS.seed);

  const n = Math.max(
    3,
    Math.round(SETTINGS.bands)
  );

  if (width >= height) {
    rows = n;
    columns = Math.max(
      n,
      Math.round(n * width / height)
    );
  } else {
    columns = n;
    rows = Math.max(
      n,
      Math.round(n * height / width)
    );
  }

  cellW = width / columns;
  cellH = height / rows;
  total = columns * rows;

  const cells = [];
  let left = 0;
  let right = columns - 1;
  let top = 0;
  let bottom = rows - 1;

  while (left <= right && top <= bottom) {
    for (let y = bottom; y >= top; y--) {
      cells.push([left, y]);
    }

    left++;
    if (left > right) break;

    for (let x = left; x <= right; x++) {
      cells.push([x, top]);
    }

    top++;
    if (top > bottom) break;

    for (let y = top; y <= bottom; y++) {
      cells.push([right, y]);
    }

    right--;
    if (left > right) break;

    for (let x = right; x >= left; x--) {
      cells.push([x, bottom]);
    }

    bottom--;
  }

  for (const cell of cells) {
    if (SETTINGS.mirrorX) {
      cell[0] = columns - 1 - cell[0];
    }
    if (SETTINGS.mirrorY) {
      cell[1] = rows - 1 - cell[1];
    }
  }

  if (!SETTINGS.inward) cells.reverse();

  runs = [];

  cells.forEach(([x, y], i) => {
    const prev = i > 0
      ? cells[i - 1]
      : [
          2 * x - cells[1][0],
          2 * y - cells[1][1]
        ];

    const dx = x - prev[0];
    const dy = y - prev[1];
    const last = runs[runs.length - 1];

    if (
      last &&
      last.dx === dx &&
      last.dy === dy
    ) {
      last.end = i + 1;
    } else {
      runs.push({
        x, y, dx, dy,
        start: i,
        end: i + 1
      });
    }
  });

  const quantum = Math.max(
    0.01,
    SETTINGS.lengthQuantum
  );

  [lengthMin, lengthMax] =
    SETTINGS.lengthRange.map(value =>
      Math.max(
        quantum,
        Math.ceil(
          value * Math.sqrt(total) / quantum
        ) * quantum
      )
    );

  lengthMax = Math.max(lengthMin, lengthMax);

  parts = [{
    start: total - random(lengthMin, lengthMax),
    ink: random(SETTINGS.palette)
  }];

  while (parts[0].start > 0) {
    prependPart();
  }
}


// ========================================
// 原始色段生成
// ========================================

function prependPart() {
  let u = random();
  const p = SETTINGS.lengthBias;

  u = u < 0.5
    ? 0.5 * Math.pow(2 * u, p)
    : 1 - 0.5 * Math.pow(2 - 2 * u, p);

  const segmentLength =
    lengthMin + (lengthMax - lengthMin) * u;

  const historyCount = Math.min(
    SETTINGS.colorHistory,
    SETTINGS.palette.length - 1
  );

  const history = parts.slice(0, historyCount);

  let choices = SETTINGS.palette.filter(
    ink => !history.some(
      segment => segment.ink === ink
    )
  );

  const distinctColors = new Set(
    parts.map(segment => segment.ink)
  );

  if (
    distinctColors.size === 1 &&
    SETTINGS.palette.length > 1
  ) {
    choices = choices.filter(
      ink => ink !== parts[0].ink
    );
  }

  if (!choices.length) {
    choices = SETTINGS.palette;
  }

  parts.unshift({
    start: parts[0].start - segmentLength,
    ink: random(choices)
  });
}


// ========================================
// 主动画
// ========================================

function drawArtwork() {
  const dt = Math.min(deltaTime, 100);

  if (!paused) {
    const distance =
      dt / 17 *
      0.001 *
      Math.pow(SETTINGS.bands, 0.8) *
      Math.max(0, SETTINGS.speed);

    for (const part of parts) {
      part.start += distance;
    }

    while (parts[0].start > 0) {
      prependPart();
    }

    while (
      parts.length > 1 &&
      parts[parts.length - 1].start >= total
    ) {
      parts.pop();
    }

    const response = 1 - Math.exp(-dt * 0.008);
    const amount = constrain(
      DEPTH.parallax,
      0,
      0.10
    );

    viewOffset.x += (
      pointerTarget.x * amount - viewOffset.x
    ) * response;

    viewOffset.y += (
      pointerTarget.y * amount - viewOffset.y
    ) * response;
  }

  const scene = DEPTH.enabled
    ? getDepthScene()
    : null;

  let index = 0;

  for (const run of runs) {
    let s = run.start;

    while (s < run.end) {
      while (
        index + 1 < parts.length &&
        parts[index + 1].start <= s
      ) {
        index++;
      }

      const nextBoundary =
        index + 1 < parts.length
          ? parts[index + 1].start
          : total;

      const end = Math.min(
        run.end,
        nextBoundary
      );

      fill(parts[index].ink);

      paintRun(
        run,
        s - run.start,
        end - run.start,
        scene
      );

      s = end;
    }
  }
}


// ========================================
// 色块绘制
// ========================================

function paintRun(run, a, b, scene) {
  let x0, x1, y0, y1;

  if (run.dx !== 0) {
    x0 = run.dx > 0
      ? run.x + a
      : run.x + 1 - b;

    x1 = run.dx > 0
      ? run.x + b
      : run.x + 1 - a;

    y0 = run.y;
    y1 = run.y + 1;
  } else {
    x0 = run.x;
    x1 = run.x + 1;

    y0 = run.dy > 0
      ? run.y + a
      : run.y + 1 - b;

    y1 = run.dy > 0
      ? run.y + b
      : run.y + 1 - a;
  }

  if (!scene) {
    const d = pixelDensity();
    const snap = value =>
      Math.round(value * d) / d;

    const x = snap(x0 * cellW);
    const y = snap(y0 * cellH);

    rect(
      x,
      y,
      snap(x1 * cellW) - x,
      snap(y1 * cellH) - y
    );

    return;
  }

  if (x1 <= x0 || y1 <= y0) return;

  const left = 2 * x0 / columns - 1;
  const right = 2 * x1 / columns - 1;
  const top = 2 * y0 / rows - 1;
  const bottom = 2 * y1 / rows - 1;

  const polygon = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ];

  const ctx = drawingContext;
  const baseInk = ctx.fillStyle;

  ctx.save();
  ctx.lineWidth = 0.65 / pixelDensity();
  ctx.lineJoin = "round";

  for (const face of scene.faces) {
    if (
      right <= face.minX ||
      left >= face.maxX ||
      bottom <= face.minY ||
      top >= face.maxY
    ) {
      continue;
    }

    const piece = clipPolygon(
      polygon,
      face.polygon
    );

    if (piece.length < 3) continue;

    const ink = getShadedColor(
      baseInk,
      constrain(DEPTH.shading, 0, 1) * face.shade
    );

    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.beginPath();

    for (let i = 0; i < piece.length; i++) {
      const point = applyProjection(
        piece[i],
        face.matrix
      );

      const x = (point[0] + 1) * width / 2;
      const y = (point[1] + 1) * height / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();

    // 同色扩边仅用于消除亚像素接缝
    ctx.stroke();
    ctx.fill();
  }

  ctx.restore();
}


// ========================================
// 非均匀台阶结构
// ========================================

function getDepthScene() {
  const layoutIndex = Math.round(
    constrain(DEPTH.layout, 0, LAYOUTS.length - 1)
  );

  const source = constrain(
    DEPTH.sourceCenter,
    0.10,
    0.80
  );

  const layout = LAYOUTS[layoutIndex];
  const signature =
    JSON.stringify(layout) + "|" + source;

  if (
    !sceneCache ||
    sceneCache.signature !== signature
  ) {
    sceneCache = buildScene(
      layout,
      source,
      signature
    );
  }

  const scene = sceneCache;

  if (
    !Number.isFinite(scene.lastViewX) ||
    Math.abs(scene.lastViewX - viewOffset.x) > 0.000001 ||
    Math.abs(scene.lastViewY - viewOffset.y) > 0.000001
  ) {
    updateProjectionMatrices(scene);
  }

  return scene;
}


function buildScene(layout, source, signature) {
  const finalZ =
    Math.min(
      layout.entry[0] / layout.back[0],
      layout.entry[1] / layout.back[1]
    ) * 0.75 - 1;

  const endWorld = [
    layout.back[0] * (1 + finalZ),
    layout.back[1] * (1 + finalZ)
  ];

  const levels = [{
    r: 1,
    w: 1,
    h: 1,
    z: 0
  }];

  let usedSource = 0;
  let z = 0;

  for (let i = 0; i < 4; i++) {
    const progress = PLATFORM_PROGRESS[i];

    const worldW =
      layout.entry[0] +
      (endWorld[0] - layout.entry[0]) * progress;

    const worldH =
      layout.entry[1] +
      (endWorld[1] - layout.entry[1]) * progress;

    // 平台：保持深度，改变宽高
    usedSource += SOURCE_WEIGHTS[2 * i];

    levels.push({
      r: 1 - (1 - source) * usedSource,
      w: worldW / (1 + z),
      h: worldH / (1 + z),
      z
    });

    // 下沉侧面：保持世界尺寸，增加深度
    z += finalZ * DEPTH_WEIGHTS[i];
    usedSource += SOURCE_WEIGHTS[2 * i + 1];

    levels.push({
      r: 1 - (1 - source) * usedSource,
      w: worldW / (1 + z),
      h: worldH / (1 + z),
      z
    });
  }

  const sourceRings = levels.map(
    level => rectangleCorners(
      level.r,
      level.r
    )
  );

  const faces = [];

  for (let band = 0; band < levels.length - 1; band++) {
    const outer = sourceRings[band];
    const inner = sourceRings[band + 1];

    const platform = band % 2 === 0;

    const shades = platform
      ? [0.10, 0.16, 0.06, 0.12]
      : [0.20, 0.85, 0.35, 0.60];

    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;

      faces.push(addBounds({
        polygon: [
          outer[side],
          outer[next],
          inner[next],
          inner[side]
        ],
        band,
        side,
        center: false,
        shade: shades[side]
      }));
    }
  }

  faces.push(addBounds({
    polygon: sourceRings[sourceRings.length - 1],
    center: true,
    shade: 0.95
  }));

  return {
    signature,
    layout,
    finalZ,
    levels,
    faces,
    lastViewX: NaN,
    lastViewY: NaN
  };
}


// ========================================
// 入口比例、远端偏移与鼠标视差
// ========================================

function updateProjectionMatrices(scene) {
  const targetRings = scene.levels.map(level => {
    const depthProgress = level.z / scene.finalZ;
    const parallaxDepth = 1 - 1 / (1 + level.z);

    const cx =
      scene.layout.offset[0] * depthProgress +
      viewOffset.x * parallaxDepth;

    const cy =
      scene.layout.offset[1] * depthProgress +
      viewOffset.y * parallaxDepth;

    return rectangleCorners(
      level.w,
      level.h,
      cx,
      cy
    );
  });

  for (const face of scene.faces) {
    let target;

    if (face.center) {
      target = targetRings[targetRings.length - 1];
    } else {
      const outer = targetRings[face.band];
      const inner = targetRings[face.band + 1];

      const side = face.side;
      const next = (side + 1) % 4;

      target = [
        outer[side],
        outer[next],
        inner[next],
        inner[side]
      ];
    }

    face.matrix = solveProjection(
      face.polygon,
      target
    );
  }

  scene.lastViewX = viewOffset.x;
  scene.lastViewY = viewOffset.y;
}


function rectangleCorners(w, h, cx = 0, cy = 0) {
  return [
    [cx - w, cy - h],
    [cx + w, cy - h],
    [cx + w, cy + h],
    [cx - w, cy + h]
  ];
}


function addBounds(face) {
  const xs = face.polygon.map(p => p[0]);
  const ys = face.polygon.map(p => p[1]);

  face.minX = Math.min(...xs);
  face.maxX = Math.max(...xs);
  face.minY = Math.min(...ys);
  face.maxY = Math.max(...ys);

  return face;
}


// ========================================
// 四边形到四边形的透视变换
// ========================================

function solveProjection(source, target) {
  const equations = [];

  for (let i = 0; i < 4; i++) {
    const [x, y] = source[i];
    const [u, v] = target[i];

    equations.push(
      [x, y, 1, 0, 0, 0, -u * x, -u * y, u],
      [0, 0, 0, x, y, 1, -v * x, -v * y, v]
    );
  }

  for (let column = 0; column < 8; column++) {
    let pivot = column;

    for (let row = column + 1; row < 8; row++) {
      if (
        Math.abs(equations[row][column]) >
        Math.abs(equations[pivot][column])
      ) {
        pivot = row;
      }
    }

    if (Math.abs(equations[pivot][column]) < 1e-12) {
      throw new Error("空间面退化，请检查入口和远端尺寸。");
    }

    [
      equations[column],
      equations[pivot]
    ] = [
      equations[pivot],
      equations[column]
    ];

    const divisor = equations[column][column];

    for (let j = column; j < 9; j++) {
      equations[column][j] /= divisor;
    }

    for (let row = 0; row < 8; row++) {
      if (row === column) continue;

      const factor = equations[row][column];

      for (let j = column; j < 9; j++) {
        equations[row][j] -=
          factor * equations[column][j];
      }
    }
  }

  return equations.map(row => row[8]).concat(1);
}


function applyProjection(point, matrix) {
  const x = point[0];
  const y = point[1];

  const denominator =
    matrix[6] * x + matrix[7] * y + 1;

  return [
    (
      matrix[0] * x +
      matrix[1] * y +
      matrix[2]
    ) / denominator,

    (
      matrix[3] * x +
      matrix[4] * y +
      matrix[5]
    ) / denominator
  ];
}


// ========================================
// 多边形裁剪
// ========================================

function clipPolygon(polygon, region) {
  let output = polygon;

  for (let edge = 0; edge < region.length; edge++) {
    if (!output.length) break;

    const A = region[edge];
    const B = region[(edge + 1) % region.length];

    const input = output;
    output = [];

    let previous = input[input.length - 1];
    let previousSide = edgeSide(A, B, previous);

    for (const current of input) {
      const currentSide = edgeSide(A, B, current);

      const previousInside = previousSide >= 0;
      const currentInside = currentSide >= 0;

      if (previousInside !== currentInside) {
        const t =
          previousSide /
          (previousSide - currentSide);

        output.push([
          previous[0] +
            t * (current[0] - previous[0]),

          previous[1] +
            t * (current[1] - previous[1])
        ]);
      }

      if (currentInside) output.push(current);

      previous = current;
      previousSide = currentSide;
    }
  }

  return output;
}


function edgeSide(A, B, point) {
  return (
    (B[0] - A[0]) * (point[1] - A[1]) -
    (B[1] - A[1]) * (point[0] - A[0])
  );
}


// ========================================
// 台阶侧面明暗
// ========================================

function getShadedColor(baseInk, shade) {
  if (shade <= 0) return baseInk;

  const key = baseInk + "|" + shade;

  if (shadeCache.has(key)) {
    return shadeCache.get(key);
  }

  const c = color(baseInk);
  const factor = 1 - shade;

  const r = Math.round(red(c) * factor);
  const g = Math.round(green(c) * factor);
  const b = Math.round(blue(c) * factor);

  const result = `rgb(${r},${g},${b})`;

  shadeCache.set(key, result);
  return result;
}


// ========================================
// 原始点击生成逻辑
// ========================================

function newVariation() {
  const previousPalette = SETTINGS.palette.join(',');
  SETTINGS.seed = (SETTINGS.seed + 1) >>> 0;
  TUNNEL_LOOK.index = (TUNNEL_LOOK.index + 1) % TUNNEL_STYLES.length;
  randomSeed(SETTINGS.seed);

  SETTINGS.bands = random(BAND_OPTIONS);

  SETTINGS.inward = random() < 0.5;
  SETTINGS.mirrorX = random() < 0.5;
  SETTINGS.mirrorY = random() < 0.5;

  SETTINGS.palette = random(PALETTES.filter(palette => palette.join(',') !== previousPalette)).slice();

  SETTINGS.lengthRange = random([
    [0.01, 0.01],
    [0.02, 0.3],
    [0.1, 1.25],
    [0.5, 1],
    [1, 2]
  ]).slice();

  SETTINGS.lengthQuantum = random([
    0.1, 0.25, 0.5, 1, 1, 1
  ]);

  SETTINGS.lengthBias = random([1, 2, 3]);
  SETTINGS.colorHistory = random([0, 1, 2, 3]);

  rebuild();
  WORLD.ready = false;
  if (FX.mode === 'float' || FX.mode === 'return') FX.stylePending = true;
}


// ========================================
// 键盘操作
// ========================================

function keyPressed() {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (key === 'p' || key === 'P') { stopCamera(false); switchStyle(); return false; }
  if (key === 'b' || key === 'B') { stopCamera(false); recallFragments(); return false; }
  if (key === 'f' || key === 'F') { stopCamera(false); setGesture('fist'); return false; }
  if (key === 'o' || key === 'O') { stopCamera(false); setGesture('open'); return false; }
  if (key === 'h' || key === 'H') { togglePanel(); return false; }
  if (key === ' ') {
    stopCamera(false); FX.gesture = 'none';
    if (FLIGHT.stopped) { resumeMotion(); FLIGHT.active = true; }
    else { FLIGHT.stopped = true; FLIGHT.active = false; FLIGHT.stoppedAt = millis(); paused = true; }
    return false;
  }
  if (FX.mode === 'float' || FX.mode === 'return') return;

  if (key === "r" || key === "R") {
    newVariation();
  }

  if (key === "d" || key === "D") {
    DEPTH.enabled = !DEPTH.enabled;
  }

  if (key === "s" || key === "S") {
    saveCanvas(
      "twist-space-" + SETTINGS.seed,
      "png"
    );
  }

  // 原来的配色与密度预设
  if (key.length === 1 && "1234".includes(key)) {
    const preset = Number(key) - 1;

    SETTINGS.bands = [6, 12, 24, 48][preset];

    const paletteIndex = [0, 1, 3, 5][preset];

    SETTINGS.palette =
      PALETTES[paletteIndex].slice();

    SETTINGS.lengthRange = [
      [1, 2],
      [0.5, 1],
      [0.1, 1.25],
      [0.02, 0.3]
    ][preset].slice();

    rebuild();
  }

  // 空间构图单独切换，不重置色块动画
  if (key.length === 1 && "5678".includes(key)) {
    DEPTH.layout = Number(key) - 5;
    sceneCache = null;
  }
}


function windowResized() {
  resetFX();
  resizeCanvas(windowWidth, windowHeight);
  rebuild();
}

// 支持 Teachable Machine 自训练分类器与 MediaPipe 内置手势。
const GESTURE_CONFIG = { confidence: 0.7, stableMs: 240, lostMs: 750, frameMs: 50 };
const FX = { mode: 'normal', gesture: 'none', pieces: [], snapshot: null,
  burstPending: false, returnAt: 0, stylePending: false,
  motion: { x: 0, y: 0, activeUntil: 0 } };
const VIEWING_MODES = Object.freeze({
  gentle: { name: '舒缓', speed: 1.1, rotation: 0.035, sway: 0.45, tilt: 0.2 },
  still: { name: '隧道静止', speed: 0, rotation: 0, sway: 0.35, tilt: 0 },
  original: { name: '原速穿梭', speed: 5.4, rotation: 0.732, sway: 1, tilt: 1 }
});
const VIEWING = { mode: 'gentle' };
const VIEWING_STORAGE = 'eastern-mood-viewing-v1';
function viewingProfile() { return VIEWING_MODES[VIEWING.mode]; }

const FLIGHT = { engaged: true, active: true, stopped: false, stoppedAt: 0,
  distance: 0, angle: 0, speed: 1.1, rotationSpeed: 0.035, blend: 1, origin: null };
const STYLE_POINT = { armed: true };
const FLIGHT_CROSS_SECTION = [[-1,-0.72],[-0.72,-1],[0.72,-1],[1,-0.72],[1,0.72],[0.72,1],[-0.72,1],[-1,0.72]];
function radialSection(count, radius = 1.25, innerRadius = radius, lobes = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / count;
    const r = lobes ? radius + Math.cos(angle * lobes) * 0.18 : i % 2 ? innerRadius : radius;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });
}

const TUNNEL_STYLES = [
  { name: '折角方井', points: FLIGHT_CROSS_SECTION, twist: 0.19, strips: 3, spin: 1 },
  { name: '六角蜂巢', points: radialSection(6, 1.35), twist: 0.11, strips: 3, spin: -1 },
  { name: '三棱棱镜', points: radialSection(3, 1.65), twist: 0.14, strips: 4, spin: 1 },
  { name: '星芒隧道', points: radialSection(12, 1.5, 0.88), twist: 0.08, strips: 2, spin: -1 },
  { name: '菱形光井', points: [[0,-1.5],[1.25,0],[0,1.5],[-1.25,0]], twist: 0.23, strips: 3, spin: 1 },
  { name: '圆环漩涡', points: radialSection(16, 1.22), twist: 0.06, strips: 2, spin: -1 },
  { name: '花瓣螺旋', points: radialSection(16, 1.24, 1.24, 4), twist: 0.12, strips: 3, spin: 1 },
  { name: '方框折叠', points: [[-1.12,-1.12],[1.12,-1.12],[1.12,1.12],[-1.12,1.12]], twist: -0.11, strips: 4, spin: -1 }
];
const TUNNEL_LOOK = { index: 0 };
const FLIGHT_SPACING = 0.6;
const WORLD = { display: null, buffer: null, context: null, ready: false };
const SWAY = { x: 0, y: 0, tilt: 0, targetX: 0, targetY: 0, targetTilt: 0, lastSeen: 0, anchor: null };
const CAM = { video: null, stream: null, recognizer: null, running: false, loading: false,
  token: 0, raf: null, candidate: '', candidateFrames: 0, candidateLast: -Infinity, palmShape: false, palmShapeAt: -Infinity, since: 0, lastGood: 0, lastVideoTime: -1,
  lastFrameAt: -Infinity, hand: null, source: 'mediapipe', customModel: null, customSettings: null, predicting: false, tracker: null, lastTrackAt: -Infinity, lastTrackVideoTime: -1 };
let fxUI;

function resetFX() {
  FX.mode = 'normal'; FX.gesture = 'none';
  FX.motion.activeUntil = 0;
  FX.pieces = []; FX.snapshot = null; FX.burstPending = false; FX.stylePending = false;
  WORLD.ready = false; resetSceneSway();
  Object.assign(FLIGHT, { engaged: true, active: true, stopped: false, stoppedAt: 0, distance: 0, angle: 0, speed: viewingProfile().speed, rotationSpeed: viewingProfile().rotation, blend: 1, origin: null });
  STYLE_POINT.armed = true;
  paused = false;
}

function resumeMotion() {
  if (FLIGHT.stopped) {
    const duration = Math.max(0, millis() - FLIGHT.stoppedAt);
    if (FX.mode === 'return') FX.returnAt += duration;
    if (FX.mode === 'float') FX.burstAt += duration;
  }
  FLIGHT.stopped = false; paused = false;
}

function beginReturn() {
  if (FX.mode !== 'float') return;
  FX.mode = 'return'; FX.returnAt = millis();
  FX.pieces.forEach(p => { p.rx = p.x; p.ry = p.y; p.ra = p.angle; p.rs = p.scale; });
}

function restoreTunnel() {
  resumeMotion(); FLIGHT.engaged = true; FLIGHT.active = true;
  FX.burstPending = false; FX.motion.activeUntil = 0; STYLE_POINT.armed = true;
  if (FX.mode === 'float' || FX.mode === 'return') beginReturn();
}

function recallFragments() {
  FX.gesture = 'fist'; restoreTunnel();
}

function switchStyle() {
  newVariation(); STYLE_POINT.armed = false;
}

function setGesture(next) {
  if (next === FX.gesture) return;
  FX.gesture = next;
  if (next === 'fist') restoreTunnel();
  else if (next === 'point') {
    // 一次伸指仅切换一次；保持手势时不会连续换色。
    if (STYLE_POINT.armed) switchStyle();
  } else if (next === 'open') {
    resumeMotion(); FLIGHT.active = false; STYLE_POINT.armed = true;
    if (FX.mode !== 'float') FX.burstPending = true;
  }
}

// 相机在重复的空间单元中前进：固定的世界截面持续向画面外扩张。
function flightRing(worldIndex) {
  const z = Math.max(0.04, worldIndex * FLIGHT_SPACING - FLIGHT.distance);
  const projection = Math.max(width, height) * 0.65 / (z + 0.62);
  const style = TUNNEL_STYLES[TUNNEL_LOOK.index];
  const angle = FLIGHT.angle + worldIndex * style.twist;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  const pulse = 1 + Math.sin(worldIndex * 0.53) * 0.045;
  const cx = width / 2 + pointerTarget.x * Math.min(width, height) * 0.025;
  const cy = height / 2 + pointerTarget.y * Math.min(width, height) * 0.025;
  return style.points.map(([x, y]) => {
    x *= 1.08 * pulse; y *= 1.04 * pulse;
    return [cx + (x * cosine - y * sine) * projection,
      cy + (x * sine + y * cosine) * projection];
  });
}

function paintFlightPolygon(points, ink) {
  const ctx = drawingContext;
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function drawFlight(dt) {
  if (FLIGHT.active) {
    const profile = viewingProfile(), response = 1 - Math.exp(-dt * 3.4);
    FLIGHT.speed += (profile.speed - FLIGHT.speed) * response;
    FLIGHT.rotationSpeed += (profile.rotation - FLIGHT.rotationSpeed) * response;
    FLIGHT.distance += FLIGHT.speed * dt;
    FLIGHT.angle += FLIGHT.rotationSpeed * dt * TUNNEL_STYLES[TUNNEL_LOOK.index].spin;
    FLIGHT.blend = Math.min(1, FLIGHT.blend + dt * 1.7);
  }
  // 短暂交叠原画面，避免从矩形台阶硬切至旋转隧道。
  if (FLIGHT.origin && FLIGHT.blend < 1) image(FLIGHT.origin, 0, 0, width, height);
  const ctx = drawingContext;
  ctx.save(); ctx.globalAlpha = FLIGHT.blend;
  ctx.fillStyle = '#101017'; ctx.fillRect(0, 0, width, height);
  const first = Math.floor(FLIGHT.distance / FLIGHT_SPACING) + 1;
  const style = TUNNEL_STYLES[TUNNEL_LOOK.index];
  const ringCount = style.points.length >= 12 ? 30 : 37;
  const rings = Array.from({ length: ringCount }, (_, i) => flightRing(first - 1 + i));
  const palette = SETTINGS.palette;
  const stripCount = Math.min(4, style.strips + (SETTINGS.bands >= 24 ? 1 : 0));
  paintFlightPolygon(rings[rings.length - 1], getShadedColor(palette[0], 0.75));
  // 从远到近画对称色块。各层旋转角不同，形成万花筒式深度。
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let band = rings.length - 2; band >= 0; band--) {
    const near = rings[band], far = rings[band + 1];
    const world = first - 1 + band;
    const sideCount = near.length;
    for (let side = 0; side < sideCount; side++) {
      const next = (side + 1) % sideCount;
      for (let strip = 0; strip < stripCount; strip++) {
        const a = strip / stripCount, b = (strip + 1) / stripCount;
        const symmetry = sideCount % 2 ? sideCount : sideCount / 2;
        const mirroredSide = Math.min(side % symmetry, symmetry - 1 - side % symmetry);
        const ink = palette[(world + mirroredSide * 2 + Math.min(strip, stripCount - 1 - strip)) % palette.length];
        // 量化明暗，避免连续运动让颜色缓存无限增长。
        const shade = Math.round(Math.min(0.72, band * 0.017 + (side % 2) * 0.06) * 24) / 24;
        paintFlightPolygon([mix(near[side], near[next], a), mix(near[side], near[next], b),
          mix(far[side], far[next], b), mix(far[side], far[next], a)], getShadedColor(ink, shade));
      }
    }
  }
  ctx.restore();
  if (FLIGHT.blend === 1) FLIGHT.origin = null;
}

function updateFXLabel() {
  if (!fxUI) return;
  const label = FLIGHT.stopped ? '手动暂停 · 随手晃动'
    : FX.mode === 'float' ? '张手 · 大小不规则碎片'
    : FX.mode === 'return' ? '握拳 · 复原隧道'
    : FLIGHT.active ? TUNNEL_STYLES[TUNNEL_LOOK.index].name + ' · ' + viewingProfile().name
    : FLIGHT.engaged ? '万花筒隧道' : '空间流动';
  if (fxUI.state.textContent !== label) fxUI.state.textContent = label;
}

function resetSceneSway() {
  Object.assign(SWAY, { x: 0, y: 0, tilt: 0, targetX: 0, targetY: 0, targetTilt: 0, lastSeen: 0, anchor: null });
}

function updateSceneSway(dt, now) {
  if (now - SWAY.lastSeen > 600) {
    SWAY.targetX = 0; SWAY.targetY = 0; SWAY.targetTilt = 0; SWAY.anchor = null;
    if (CAM.running) STYLE_POINT.armed = true;
  }
  const response = 1 - Math.exp(-dt * 8);
  SWAY.x += (SWAY.targetX - SWAY.x) * response;
  SWAY.y += (SWAY.targetY - SWAY.y) * response;
  SWAY.tilt += (SWAY.targetTilt - SWAY.tilt) * response;
}

function setSceneSwayTarget(x, y, now) {
  const side = Math.min(width, height), profile = viewingProfile();
  SWAY.targetX = constrain(x, -1, 1) * side * 0.09 * profile.sway;
  SWAY.targetY = constrain(y, -1, 1) * side * 0.07 * profile.sway;
  SWAY.targetTilt = constrain(x, -1, 1) * 0.045 * profile.tilt;
  SWAY.lastSeen = now;
}

function ensureWorldBuffer() {
  const w = WORLD.display.width || Math.round(width * pixelDensity());
  const h = WORLD.display.height || Math.round(height * pixelDensity());
  if (!WORLD.buffer) { WORLD.buffer = document.createElement('canvas'); WORLD.context = WORLD.buffer.getContext('2d', { alpha: false }); }
  if (WORLD.buffer.width !== w || WORLD.buffer.height !== h) {
    WORLD.buffer.width = w; WORLD.buffer.height = h; WORLD.ready = false;
  }
}

function cacheWorldFrame() {
  const ctx = WORLD.context;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(WORLD.display, 0, 0, WORLD.buffer.width, WORLD.buffer.height);
  WORLD.ready = true;
}

function captureWorldFrame() {
  if (!WORLD.ready) return get();
  const snapshot = createImage(WORLD.buffer.width, WORLD.buffer.height);
  snapshot.canvas.getContext('2d').drawImage(WORLD.buffer, 0, 0);
  return snapshot;
}

function presentWorldFrame() {
  const ctx = drawingContext;
  const w = WORLD.buffer.width, h = WORLD.buffer.height, ratio = w / width;
  // 整个世界共用一个变换，碎片相对位置和吸回目标不受手势摇动破坏。
  const overscan = 1 + Math.max(Math.abs(SWAY.x) / width, Math.abs(SWAY.y) / height) * 2 + Math.abs(SWAY.tilt) * 1.8;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#101017'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2 + SWAY.x * ratio, h / 2 + SWAY.y * ratio);
  ctx.rotate(SWAY.tilt); ctx.scale(overscan, overscan);
  ctx.drawImage(WORLD.buffer, -w / 2, -h / 2);
  ctx.restore();
}

function draw() {
  const now = millis();
  if (CAM.running && now - CAM.lastGood > GESTURE_CONFIG.lostMs) setGesture('none');
  const dt = Math.min(deltaTime || 16.7, 50) / 1000;
  updateSceneSway(dt, now); ensureWorldBuffer();
  if (FX.stylePending && FX.snapshot) {
    // 替换同一尺寸的碎片纹理，保持碎片位置及复原路径不变。
    background('#101017'); drawFlight(0); FX.snapshot = get(); FX.stylePending = false;
  }
  if (!FLIGHT.stopped || !WORLD.ready) {
    if (FX.mode === 'normal') {
      if (FLIGHT.engaged) drawFlight(dt);
      else { background('#101017'); drawArtwork(); }
      if (FX.burstPending) { FX.burstPending = false; explodeFrame(); }
    } else {
      background('#101017'); drawFragments(dt);
    }
    cacheWorldFrame();
  }
  presentWorldFrame(); updateFXLabel();
}

function shardArea(polygon) {
  return Math.abs(polygon.reduce((sum, p, i) => {
    const next = polygon[(i + 1) % polygon.length]; return sum + p[0] * next[1] - next[0] * p[1];
  }, 0)) / 2;
}

function clipShardHalfPlane(polygon, nx, ny, limit) {
  const output = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = nx * a[0] + ny * a[1] - limit, db = nx * b[0] + ny * b[1] - limit;
    const aInside = da <= 1e-7, bInside = db <= 1e-7;
    if (aInside) output.push(a);
    if (aInside !== bInside) {
      const t = da / (da - db);
      output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return output;
}

function buildShardCells(w, h, rng = Math.random) {
  if (w <= 0 || h <= 0) return [];
  const columns = Math.max(4, Math.min(18, Math.round(Math.sqrt(84 * w / h))));
  const rows = Math.max(4, Math.min(18, Math.round(84 / columns)));
  const seeds = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const dense = (row + column * 2) % 7 === 0;
      if (!dense && (row * 3 + column) % 5 === 0) continue;
      const divisions = dense ? 3 : 1;
      for (let sy = 0; sy < divisions; sy++) for (let sx = 0; sx < divisions; sx++) {
        seeds.push([(column + (sx + 0.2 + rng() * 0.6) / divisions) * w / columns,
          (row + (sy + 0.2 + rng() * 0.6) / divisions) * h / rows]);
      }
    }
  }
  const cells = [];
  for (let i = 0; i < seeds.length; i++) {
    const a = seeds[i]; let polygon = [[0,0],[w,0],[w,h],[0,h]];
    for (let j = 0; j < seeds.length && polygon.length >= 3; j++) {
      if (i === j) continue;
      const b = seeds[j];
      polygon = clipShardHalfPlane(polygon, b[0] - a[0], b[1] - a[1],
        (b[0] * b[0] + b[1] * b[1] - a[0] * a[0] - a[1] * a[1]) / 2);
    }
    if (polygon.length < 3 || shardArea(polygon) < 0.0001) continue;
    let twiceArea = 0, cx = 0, cy = 0;
    polygon.forEach((p, index) => {
      const next = polygon[(index + 1) % polygon.length], cross = p[0] * next[1] - next[0] * p[1];
      twiceArea += cross; cx += (p[0] + next[0]) * cross; cy += (p[1] + next[1]) * cross;
    });
    cells.push({ polygon, area: Math.abs(twiceArea) / 2, cx: cx / (3 * twiceArea), cy: cy / (3 * twiceArea) });
  }
  return cells;
}

function explodeFrame() {
  FX.snapshot = get(); FX.pieces = [];
  const source = FX.snapshot.canvas, ratio = source.width / width;
  const cells = buildShardCells(width, height), meanArea = width * height / cells.length;
  for (const cell of cells) {
    const { polygon, area, cx: ox, cy: oy } = cell;
    const left = Math.min(...polygon.map(p => p[0])), right = Math.max(...polygon.map(p => p[0]));
    const top = Math.min(...polygon.map(p => p[1])), bottom = Math.max(...polygon.map(p => p[1]));
    const dx = ox - width / 2, dy = oy - height / 2, distance = Math.hypot(dx, dy) || 1;
    const mass = Math.max(0.45, Math.min(2.8, Math.sqrt(area / meanArea)));
    const speed = (110 + Math.random() * 220) / Math.sqrt(mass);
    FX.pieces.push({ ox, oy, x: ox, y: oy, w: right - left, h: bottom - top, area,
      polygon: polygon.map(([x,y]) => [x - ox, y - oy]), tx: left - ox, ty: top - oy,
      sx: left * ratio, sy: top * ratio, sw: (right - left) * ratio, sh: (bottom - top) * ratio,
      vx: dx / distance * speed, vy: dy / distance * speed,
      angle: 0, spin: (Math.random() - 0.5) * 2.4 / Math.sqrt(mass), scale: 1,
      z: 0.65 + Math.random() * 0.95, phase: Math.random() * Math.PI * 2 });
  }
  FX.mode = 'float'; FX.burstAt = millis();
}

function drawFragments(dt) {
  const ctx = drawingContext;
  const returning = FX.mode === 'return';
  const t = returning ? Math.min(1, (millis() - FX.returnAt) / 1450) : 0;
  const ease = t * t * t * (t * (t * 6 - 15) + 10);
  const age = (millis() - FX.burstAt) / 1000;
  const active = !returning && FX.gesture === 'open' && millis() < FX.motion.activeUntil;
  for (const p of FX.pieces) {
    if (returning) {
      p.x = p.rx + (p.ox - p.rx) * ease;
      p.y = p.ry + (p.oy - p.ry) * ease;
      p.angle = p.ra * (1 - ease); p.scale = p.rs + (1 - p.rs) * ease;
    } else {
      p.vx *= Math.exp(-dt * 2.1); p.vy *= Math.exp(-dt * 2.1);
      // 一点向原位置的弱回拉，防止碎片长期漂出画面。
      p.vx += (p.ox - p.x) * dt * 0.07;
      p.vy += (p.oy - p.y) * dt * 0.07;
      if (active) {
        const dx = p.x - FX.motion.x, dy = p.y - FX.motion.y;
        const d = Math.hypot(dx, dy), radius = Math.min(width, height) * 0.28;
        if (d < radius) {
          const force = (1 - d / radius) * 700 * dt;
          p.vx += dx / Math.max(d, 1) * force;
          p.vy += dy / Math.max(d, 1) * force;
        }
      }
      p.x += (p.vx + Math.sin(age * 0.7 + p.phase) * 8 * p.z) * dt;
      p.y += (p.vy + Math.cos(age * 0.6 + p.phase) * 7 * p.z) * dt;
      p.angle += p.spin * dt * (0.1 + Math.exp(-age * 2));
      p.scale = 1 + Math.min(age, 1) * (p.z - 1) * 0.22;
    }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.scale(p.scale, p.scale);
    ctx.beginPath(); ctx.moveTo(p.polygon[0][0], p.polygon[0][1]);
    for (let i = 1; i < p.polygon.length; i++) ctx.lineTo(p.polygon[i][0], p.polygon[i][1]);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(FX.snapshot.canvas, p.sx, p.sy, p.sw, p.sh, p.tx, p.ty, p.w, p.h);
    ctx.restore();
  }
  if (returning && t === 1) {
    // 完整呈现冻结的原帧，再继续相同的空间状态。
    image(FX.snapshot, 0, 0, width, height);
    FX.mode = 'normal';
    FX.pieces = []; FX.snapshot = null;
  }
}

function setViewingMode(mode, persist = true) {
  const previous = viewingProfile();
  VIEWING.mode = Object.prototype.hasOwnProperty.call(VIEWING_MODES, mode) ? mode : 'gentle';
  const profile = viewingProfile();
  // 降低强度立即生效；提高强度通过 drawFlight 平缓加速，不跳转视角。
  FLIGHT.speed = Math.min(FLIGHT.speed, profile.speed);
  FLIGHT.rotationSpeed = Math.min(FLIGHT.rotationSpeed, profile.rotation);
  SWAY.targetX *= profile.sway / previous.sway;
  SWAY.targetY *= profile.sway / previous.sway;
  SWAY.targetTilt = previous.tilt ? SWAY.targetTilt * profile.tilt / previous.tilt : 0;
  WORLD.ready = false;
  if (fxUI) {
    fxUI.panel.querySelector('#viewing-mode').value = VIEWING.mode;
    fxUI.panel.querySelector('#viewing-help').textContent = VIEWING.mode === 'still'
      ? '隧道停止前进和旋转；手势换色、破碎、复原与轻微随手晃动仍可使用。'
      : VIEWING.mode === 'gentle' ? '低速前进、轻微旋转，随手晃动幅度也更小。觉得眼晕时可切换「隧道静止」。'
      : '恢复原来的快速前进、旋转与晃动强度。可随时切回舒缓或静止。';
  }
  if (persist) { try { localStorage.setItem(VIEWING_STORAGE, VIEWING.mode); } catch {} }
  updateFXLabel();
}

function restoreViewingMode() {
  let mode = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'still' : 'gentle';
  try {
    const saved = localStorage.getItem(VIEWING_STORAGE);
    if (Object.prototype.hasOwnProperty.call(VIEWING_MODES, saved)) mode = saved;
  } catch { /* 无法存储时使用舒缓或系统减少动态效果设置。 */ }
  setViewingMode(mode, false);
}

function initGestureUI() {
  const panel = document.createElement('aside');
  panel.id = 'gesture-panel';
  panel.innerHTML = `<div class="panel-top"><strong>EASTERN MOOD / 手势空间</strong><span id="fx-state" role="status"></span></div>
    <div class="viewing-controls"><label for="viewing-mode">观看模式<select id="viewing-mode"><option value="gentle">舒缓（默认推荐）</option><option value="still">隧道静止 · 停止前进与旋转</option><option value="original">原速穿梭</option></select></label><p class="note" id="viewing-help" role="status"></p></div>
    <section class="gesture-guide" aria-labelledby="gesture-guide-title">
      <h2 id="gesture-guide-title">手势操作指南</h2>
      <p class="gesture-guide-intro">默认以舒缓模式播放万花筒隧道；可在上方选择静止观看。开启摄像头并允许访问后，让整只手出现在镜头中，做出手势并短暂停留。</p>
      <dl class="gesture-guide-list">
        <div><dt>张开手掌</dt><dd>五指自然展开，掌心朝向镜头。画面会爆开成大小不一的不规则碎片，并漂浮旋转。</dd></div>
        <div><dt>握紧拳头</dt><dd>收拢手指握拳。碎片会吸回并拼成完整隧道，按你选择的观看模式继续；静止模式下保持静止。</dd></div>
        <div><dt>伸出一根食指</dt><dd>食指向上，其余手指收拢。每次切换一组配色与隧道形态，共有 16 套配色、8 种形态。保持伸指只切换一次；握拳或张手后，再伸指可再次切换。</dd></div>
        <div><dt>移动手掌</dt><dd>将手向左、右、上、下移动，整个空间会跟随晃动；隧道与碎片状态均有效。</dd></div>
      </dl>
      <p class="note gesture-guide-manual">不开摄像头也可用下方按钮测试：P 换风格、F 握拳复原、O 张手破碎、B 复原；鼠标移动可模拟整体晃动。</p>
    </section>
    <div class="actions"><button id="test-point">切换风格 P</button><button id="test-fist">握拳复原 F</button><button id="test-open">张手破碎 O</button><button id="test-recall">复原 B</button><button id="test-reset">重置</button><button id="camera-stop">关闭摄像头</button></div>
    <details open><summary>摄像头与手势设置</summary>
    <label>识别方式<select id="recognition-mode"><option value="mediapipe">MediaPipe 内置手势（默认）</option><option value="custom">自训练模型 · Teachable Machine</option></select></label>
    <div id="custom-model-settings">
      <label>训练后的模型链接<input id="model-url" type="url" value="https://teachablemachine.withgoogle.com/models/2LIHAcsuj/" placeholder="粘贴 Teachable Machine 上传后生成的链接" autocomplete="off" spellcheck="false"></label>
      <div class="labels"><label>握拳类别（恢复通道）<input id="fist-label" value="fist" spellcheck="false"></label><label>张手类别（爆开，可留空）<input id="open-label" value="open" placeholder="选填，例如 open" spellcheck="false"></label></div>
      <label>一根手指类别（切换配色风格）<input id="point-label" value="Pointing" spellcheck="false"></label>
      <p class="note"><a href="https://teachablemachine.withgoogle.com/train/image" target="_blank" rel="noopener noreferrer">打开 Teachable Machine 训练 ↗</a><br>已接入你的训练模型：Pointing（伸出手指）＝切换风格，fist＝复原并继续万花筒，open＝破碎。更换模型时可修改链接和类别名；训练项目请另存备份。</p>
      <p class="note">进入即播放万花筒隧道；握拳让碎片复原并继续播放。通道和碎片都会随手掌方向整体晃动。未开摄像头时可用鼠标模拟。类别名须与训练项目一致，设置仅保存在当前浏览器。</p>
    </div>
    <div class="labels"><label id="custom-confidence-setting">自训练门槛（%）<input id="recognition-confidence" type="number" min="50" max="99" step="1" value="85"></label><label id="mediapipe-confidence-setting" hidden>MediaPipe 门槛（%）<input id="mediapipe-confidence" type="number" min="50" max="99" step="1" value="65"></label><label>稳定时间（毫秒）<input id="recognition-stability" type="number" min="100" max="1500" step="50" value="300"></label></div>
    <button id="camera-start">开启摄像头 · MediaPipe</button>
    <p class="note" id="recognition-help">默认使用 MediaPipe，直接开启摄像头即可；也可切换到自训练模型。</p>
    <p class="note">摄像头画面仅在当前浏览器内处理，不上传。</p></details>
    <div id="camera-status" role="status">MediaPipe 默认模式 · 点击开启摄像头，或用 P / F / O / B 测试</div>`;
  document.body.appendChild(panel);
  fxUI = { panel, state: panel.querySelector('#fx-state'), status: panel.querySelector('#camera-status') };
  panel.querySelector('#test-point').onclick = () => { stopCamera(false); switchStyle(); };
  panel.querySelector('#test-recall').onclick = () => { stopCamera(false); recallFragments(); };
  panel.querySelector('#test-fist').onclick = () => { stopCamera(false); setGesture('fist'); };
  panel.querySelector('#test-open').onclick = () => { stopCamera(false); setGesture('open'); };
  panel.querySelector('#test-reset').onclick = () => { stopCamera(); resetFX(); };
  document.querySelector('#panel-toggle').onclick = togglePanel;
  panel.querySelector('#camera-start').onclick = startCamera;
  panel.querySelector('#camera-stop').onclick = () => stopCamera();
  restoreViewingMode();
  panel.querySelector('#viewing-mode').onchange = event => setViewingMode(event.target.value);
  restoreRecognitionSettings();
  updateRecognitionMode();
  for (const id of RECOGNITION_FIELDS) {
    panel.querySelector('#' + id).addEventListener('change', () => {
      stopCamera(); saveRecognitionSettings(); updateRecognitionMode();
    });
  }
  window.addEventListener('pagehide', () => stopCamera());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (CAM.running || CAM.loading)) {
      stopCamera(); setCameraStatus('页面已切到后台，摄像头已关闭 · 返回后可重新开启');
    }
  });
  window.addEventListener('pointermove', e => {
    if (!CAM.running && !CAM.loading && !panel.contains(e.target)) {
      setSceneSwayTarget(2 * e.clientX / width - 1, 2 * e.clientY / height - 1, millis());
    }
  });
}

const DEFAULT_MODE_REVISION = 'mediapipe-default-v1';
const DEFAULT_MODEL_REVISION = '2LIHAcsuj-pointing-v2';
const DEFAULT_MODEL_SETTINGS = Object.freeze({
  'recognition-mode': 'mediapipe',
  'model-url': 'https://teachablemachine.withgoogle.com/models/2LIHAcsuj/',
  'fist-label': 'fist', 'open-label': 'open', 'point-label': 'Pointing'
});
const RECOGNITION_FIELDS = ['recognition-mode', 'model-url', 'fist-label', 'open-label', 'point-label', 'recognition-confidence', 'mediapipe-confidence', 'recognition-stability'];
const RECOGNITION_STORAGE = 'eastern-mood-recognition-v1';

function restoreRecognitionSettings() {
  for (const [id, value] of Object.entries(DEFAULT_MODEL_SETTINGS)) fxUI.panel.querySelector('#' + id).value = value;
  try {
    const saved = JSON.parse(localStorage.getItem(RECOGNITION_STORAGE) || '{}') || {};
    const currentDefaults = saved.defaultModelRevision === DEFAULT_MODEL_REVISION;
    for (const id of RECOGNITION_FIELDS) {
      if (id === 'recognition-mode' && saved.defaultModeRevision !== DEFAULT_MODE_REVISION) continue;
      // 新模型首次发布时迁移旧链接和类别；此后保留访客自行修改的设置。
      if (!currentDefaults && Object.prototype.hasOwnProperty.call(DEFAULT_MODEL_SETTINGS, id)) continue;
      if (typeof saved[id] === 'string') fxUI.panel.querySelector('#' + id).value = saved[id];
    }
    const mode = fxUI.panel.querySelector('#recognition-mode');
    if (!['custom', 'mediapipe'].includes(mode.value)) mode.value = 'mediapipe';
  } catch { /* 存储不可用时仍使用站点默认模型。 */ }
}

function saveRecognitionSettings() {
  try {
    const values = Object.fromEntries(RECOGNITION_FIELDS.map(id => [id, fxUI.panel.querySelector('#' + id).value]));
    values.defaultModelRevision = DEFAULT_MODEL_REVISION;
    values.defaultModeRevision = DEFAULT_MODE_REVISION;
    localStorage.setItem(RECOGNITION_STORAGE, JSON.stringify(values));
  } catch { /* 设置无需依赖本地存储。 */ }
}

function updateRecognitionMode() {
  const custom = fxUI.panel.querySelector('#recognition-mode').value === 'custom';
  const hasModel = Boolean(fxUI.panel.querySelector('#model-url').value.trim());
  fxUI.panel.querySelector('#custom-model-settings').hidden = !custom;
  fxUI.panel.querySelector('#custom-confidence-setting').hidden = !custom;
  fxUI.panel.querySelector('#mediapipe-confidence-setting').hidden = custom;
  fxUI.panel.querySelector('#recognition-help').textContent = custom
    ? (hasModel ? '训练模型已配置，点击开启摄像头即可使用；也可用手动按钮测试。' : '请填入模型链接，再开启摄像头；也可用手动按钮测试。')
    : '两种模式动作一致：伸指换风格、握拳复原继续、张手破碎。MediaPipe 已开启张掌关键点辅助，请让手掌朝向镜头、手指自然张开并保持片刻。';
  updateCameraButton();
  setCameraStatus(custom ? (hasModel ? '自训练模型已配置 · 点击开启摄像头，或用 P / F / O / B 测试' : '自训练模式 · 填入模型链接后开启，可先用 P / F / O / B 测试') : 'MediaPipe 模式 · 点击开启摄像头');
}

function normalizeModelLabel(value) {
  const label = String(value || '').trim().toLowerCase();
  // 既有训练文件的第三类保持原样，网站用有意义的名称作为兼容别名。
  return label === 'class 3' || label === 'class3' ? 'pointing' : label;
}

function readRecognitionSettings() {
  const value = id => fxUI.panel.querySelector('#' + id).value.trim();
  const mode = value('recognition-mode');
  const confidence = Number(value(mode === 'mediapipe' ? 'mediapipe-confidence' : 'recognition-confidence')) / 100;
  const stableMs = Number(value('recognition-stability'));
  if (!Number.isFinite(confidence) || confidence < 0.5 || confidence > 0.99 || !Number.isFinite(stableMs) || stableMs < 100 || stableMs > 1500) {
    throw new Error('识别门槛须为 50–99%，稳定时间须为 100–1500 毫秒');
  }
  if (mode === 'mediapipe') return { mode, confidence, stableMs };
  if (mode !== 'custom') throw new Error('请选择一种识别方式');
  const input = value('model-url');
  if (!input) throw new Error('请先训练并上传模型，将生成的链接填入模型链接栏');
  let url;
  try {
    url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || /[\[\]<>]|\.\.\./.test(input)) throw new Error();
    url.search = ''; url.hash = '';
    if (url.pathname.endsWith('/model.json')) url.pathname = url.pathname.slice(0, -10);
    else if (!url.pathname.endsWith('/')) url.pathname += '/';
  } catch { throw new Error('请填写有效的 HTTPS 模型分享链接或 model.json 链接'); }
  const fist = value('fist-label'), open = value('open-label'), point = value('point-label');
  const labels = [fist, open, point].filter(Boolean).map(normalizeModelLabel);
  if (!fist || !point || new Set(labels).size !== labels.length) throw new Error('握拳与一指类别不能为空，各类别名称必须不同');
  return { mode, confidence, stableMs, modelURL: new URL('model.json', url).href,
    metadataURL: new URL('metadata.json', url).href, fist, open, point };
}

function setCameraStatus(message) {
  if (fxUI && fxUI.status.textContent !== message) fxUI.status.textContent = message;
}

function updateCameraButton() {
  if (!fxUI) return;
  const button = fxUI.panel.querySelector('#camera-start');
  button.disabled = CAM.loading || CAM.running;
  button.textContent = CAM.loading ? '正在准备识别…' : CAM.running ? '摄像头已开启'
    : fxUI.panel.querySelector('#recognition-mode').value === 'custom' ? '加载自训练模型并开启摄像头' : '开启摄像头 · MediaPipe';
}

function stopCamera(resetGesture = true) {
  CAM.running = false; CAM.loading = false; CAM.token++;
  if (CAM.raf !== null) cancelAnimationFrame(CAM.raf);
  CAM.raf = null;
  if (CAM.stream) CAM.stream.getTracks().forEach(track => track.stop());
  if (CAM.video) { CAM.video.pause(); CAM.video.srcObject = null; CAM.video.remove(); }
  if (CAM.recognizer) CAM.recognizer.close();
  if (CAM.tracker) CAM.tracker.close();
  if (CAM.customModel) CAM.customModel.close();
  CAM.stream = null; CAM.video = null; CAM.recognizer = null; CAM.hand = null;
  CAM.customModel = null; CAM.customSettings = null; CAM.predicting = false; CAM.tracker = null;
  CAM.lastTrackAt = -Infinity; CAM.lastTrackVideoTime = -1; CAM.palmShape = false; CAM.palmShapeAt = -Infinity;
  SWAY.targetX = 0; SWAY.targetY = 0; SWAY.targetTilt = 0; SWAY.anchor = null; SWAY.lastSeen = 0;
  STYLE_POINT.armed = true;
  CAM.candidate = ''; CAM.candidateFrames = 0; CAM.candidateLast = -Infinity; CAM.lastGood = 0; CAM.lastVideoTime = -1; CAM.lastFrameAt = -Infinity;
  FX.motion.activeUntil = 0;
  if (resetGesture) setGesture('none');
  updateCameraButton();
  setCameraStatus('摄像头已关闭 · 可用 P / F / O / B 测试，鼠标移动可模拟整体晃动');
}

function togglePanel() {
  fxUI.panel.hidden = !fxUI.panel.hidden;
  const button = document.querySelector('#panel-toggle');
  button.setAttribute('aria-expanded', String(!fxUI.panel.hidden));
  button.textContent = fxUI.panel.hidden ? '显示控制 H' : '收起控制 H';
}

async function loadGestureRecognizer() {
  const { FilesetResolver, GestureRecognizer } = await import('/eastern-mood/vendor/mediapipe/vision_bundle.mjs');
  const fileset = await FilesetResolver.forVisionTasks('/eastern-mood/vendor/mediapipe/wasm');
  return GestureRecognizer.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/eastern-mood/vendor/mediapipe/gesture_recognizer.task', delegate: 'CPU' },
    runningMode: 'VIDEO', numHands: 1,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
    cannedGesturesClassifierOptions: {
      categoryAllowlist: ['Closed_Fist', 'Open_Palm', 'Pointing_Up'], scoreThreshold: 0
    }
  });
}

async function loadHandTracker() {
  // 复用已部署的官方模型，只取关键点；动作仍由自训练模型判断。
  const tracker = await loadGestureRecognizer();
  return {
    detectForVideo(video, timestamp) { return tracker.recognizeForVideo(video, timestamp); },
    close() { tracker.close(); }
  };
}

let customRuntimePromise;
function loadRecognitionScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = path;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error('识别组件加载失败，请刷新后重试')); };
    document.head.appendChild(script);
  });
}

async function loadCustomModel(settings) {
  if (!customRuntimePromise) {
    customRuntimePromise = (async () => {
      if (!window.tf) await loadRecognitionScript('/eastern-mood/vendor/custom-model/tf.min.js');
      if (!window.tmImage) await loadRecognitionScript('/eastern-mood/vendor/custom-model/teachablemachine-image.min.js');
    })().catch(error => { customRuntimePromise = null; throw error; });
  }
  await customRuntimePromise;
  const response = await fetch(settings.metadataURL);
  if (!response.ok) throw new Error('无法读取模型信息，请确认已上传 TensorFlow.js 模型并复制正确链接');
  const metadata = await response.json();
  const labels = Array.isArray(metadata.labels) ? metadata.labels.map(normalizeModelLabel) : [];
  for (const name of [settings.fist, settings.open, settings.point].filter(Boolean)) {
    if (!labels.includes(normalizeModelLabel(name))) throw new Error('模型没有类别「' + name + '」，请核对类别名；未训练张手时可将张手类别留空');
  }
  const raw = await tmImage.load(settings.modelURL, metadata);
  let active = 0, closing = false, disposed = false;
  const dispose = () => {
    // 0.8.5 的公开 dispose 指向训练模型；推理实例释放实际加载的 LayersModel。
    if (closing && active === 0 && !disposed) { disposed = true; raw.model.dispose(); }
  };
  return {
    async predict(video) {
      active++;
      try { return await raw.predict(video, true); } // 与训练时的镜像预览一致。
      finally { active--; dispose(); }
    },
    close() { closing = true; dispose(); }
  };
}

async function startCamera() {
  if (CAM.loading || CAM.running) return;
  stopCamera();
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus('当前浏览器不支持摄像头访问，请使用 HTTPS 并尝试新版 Chrome、Edge 或 Safari；也可用手动按钮体验');
    return;
  }
  let settings;
  try { settings = readRecognitionSettings(); }
  catch (error) { setCameraStatus(error.message); return; }
  CAM.source = settings.mode; CAM.customSettings = settings;
  GESTURE_CONFIG.confidence = settings.confidence; GESTURE_CONFIG.stableMs = settings.stableMs;
  saveRecognitionSettings();
  const token = CAM.token;
  CAM.loading = true; updateCameraButton();
  try {
    setCameraStatus('请允许摄像头访问…');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false
    });
    if (token !== CAM.token) { stream.getTracks().forEach(track => track.stop()); return; }
    CAM.stream = stream;
    stream.getTracks().forEach(track => track.addEventListener('ended', () => {
      if (token === CAM.token) { stopCamera(); setCameraStatus('摄像头已断开，请检查设备后重新开启'); }
    }, { once: true }));
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.autoplay = true; video.srcObject = stream;
    video.className = CAM.source === 'custom' ? 'camera-preview custom-preview' : 'camera-preview'; video.setAttribute('aria-label', '镜像摄像头预览');
    CAM.video = video; document.body.appendChild(video);
    await video.play();
    if (token !== CAM.token) return;
    setCameraStatus(settings.mode === 'custom' ? '正在加载你的手势模型与手掌定位…' : '正在加载手势识别与手掌定位，首次开启请稍候…');
    const loaded = await Promise.allSettled(settings.mode === 'custom'
      ? [loadCustomModel(settings), loadHandTracker()] : [loadGestureRecognizer()]);
    const failure = loaded.find(result => result.status === 'rejected');
    if (failure || token !== CAM.token) {
      loaded.forEach(result => { if (result.status === 'fulfilled') result.value.close(); });
      if (token !== CAM.token) return;
      throw failure.reason;
    }
    if (settings.mode === 'custom') { CAM.customModel = loaded[0].value; CAM.tracker = loaded[1].value; }
    else CAM.recognizer = loaded[0].value;
    CAM.loading = false; CAM.running = true; CAM.lastGood = millis();
    updateCameraButton();
    setCameraStatus(settings.mode === 'custom' ? '自训练模型已就绪 · 伸指换风格、张手破碎、握拳复原继续；移动手掌可整体晃动' : '识别已就绪 · 伸指换风格、握拳复原继续、张手破碎；移动手掌可整体晃动');
    CAM.raf = requestAnimationFrame(timestamp => recognizeCameraFrame(token, timestamp));
  } catch (error) {
    if (token !== CAM.token) return;
    stopCamera();
    const message = error.name === 'NotAllowedError' ? '未获得摄像头权限，请在浏览器中允许访问后重试'
      : error.name === 'NotFoundError' ? '未找到摄像头，请连接设备后重试'
      : error.name === 'NotReadableError' ? '摄像头暂不可用，请关闭其他占用摄像头的应用后重试'
      : (error.message || '识别启动失败，请检查网络后重试');
    setCameraStatus(message + ' · 仍可用手动按钮体验');
  }
}

function recognizeCameraFrame(token, timestamp) {
  if (!CAM.running || token !== CAM.token) return;
  try {
    const video = CAM.video;
    // 定位独立于分类和动画状态：握拳待机、吸回及碎片漂浮时都继续追踪。
    if (CAM.tracker && video.readyState >= 2 && video.videoWidth > 0 &&
        video.currentTime !== CAM.lastTrackVideoTime && timestamp - CAM.lastTrackAt >= 90) {
      CAM.lastTrackAt = timestamp; CAM.lastTrackVideoTime = video.currentTime;
      const tracking = CAM.tracker.detectForVideo(video, timestamp);
      CAM.palmShape = isOpenPalmShape(tracking.landmarks?.[0], tracking.worldLandmarks?.[0]);
      CAM.palmShapeAt = millis();
      updateHandMotion(tracking.landmarks?.[0], millis());
    }
    if (!CAM.predicting && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== CAM.lastVideoTime &&
        timestamp - CAM.lastFrameAt >= GESTURE_CONFIG.frameMs) {
      CAM.lastVideoTime = video.currentTime; CAM.lastFrameAt = timestamp;
      if (CAM.source === 'custom') {
        CAM.predicting = true;
        const settings = CAM.customSettings;
        CAM.customModel.predict(video).then(results => {
          if (CAM.running && token === CAM.token) applyCustomResult(results, millis(), settings);
        }).catch(error => {
          if (token !== CAM.token) return;
          stopCamera(); setCameraStatus('自训练识别中断：' + error.message + ' · 可重新开启或用手动按钮');
        }).finally(() => { if (token === CAM.token) CAM.predicting = false; });
      } else {
        const result = CAM.recognizer.recognizeForVideo(video, timestamp);
        applyHandResult(result, millis());
      }
    }
    CAM.raf = requestAnimationFrame(next => recognizeCameraFrame(token, next));
  } catch {
    stopCamera();
    setCameraStatus('手势识别中断，请重新开启摄像头 · 仍可用手动按钮体验');
  }
}

function applyCustomResult(results, now, settings) {
  const ranked = (results || []).filter(result => Number.isFinite(result.probability)).slice()
    .sort((a, b) => b.probability - a.probability);
  const best = ranked[0], second = ranked[1];
  const label = normalizeModelLabel(best?.className);
  // 两个类别接近时不动作，避免在握拳与张手的过渡帧误触。
  const assistedOpen = Boolean(settings.open && label === normalizeModelLabel(settings.open) && CAM.palmShape && now - CAM.palmShapeAt <= 300);
  const certain = assistedOpen || best && best.probability >= settings.confidence && (!second || best.probability - second.probability >= 0.15);
  const next = certain ? label === normalizeModelLabel(settings.fist) ? 'fist'
    : label === normalizeModelLabel(settings.point) ? 'point'
    : settings.open && label === normalizeModelLabel(settings.open) ? 'open' : 'unknown' : 'unknown';
  if (next !== CAM.candidate) { CAM.candidate = next; CAM.since = now; }
  if (next !== 'unknown') {
    CAM.lastGood = now;
    if (now - CAM.since >= settings.stableMs) setGesture(next);
  } else if (now - CAM.lastGood > GESTURE_CONFIG.lostMs) setGesture('none');
  const name = next === 'fist' ? '握拳 · 复原继续' : next === 'point' ? '伸指 · 切换风格' : next === 'open' ? '张手 · 破碎' : '等待明确手势';
  const evidence = assistedOpen ? '模型与掌形确认' : `${best ? Math.round(best.probability * 100) : 0}%`;
  setCameraStatus(`${name} · ${evidence} · ${next === 'unknown' ? '未触发' : now - CAM.since < settings.stableMs ? '请保持片刻' : '已确认'}`);
}

const MEDIAPIPE_ACTIONS = { Closed_Fist: 'fist', Open_Palm: 'open', Pointing_Up: 'point' };

function isOpenPalmShape(landmarks, worldLandmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  if (landmarks.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  // 过小或离开画面的手不触发辅助动作。
  if ([0, 5, 8, 9, 12, 13, 16, 17, 20].some(i => landmarks[i].x < -0.1 || landmarks[i].x > 1.1 || landmarks[i].y < -0.1 || landmarks[i].y > 1.1)) return false;
  const aspect = CAM.video?.videoWidth && CAM.video?.videoHeight ? CAM.video.videoHeight / CAM.video.videoWidth : 1;
  const normalized = landmarks.map(p => ({ x: p.x, y: p.y * aspect, z: Number.isFinite(p.z) ? p.z : 0 }));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  if (distance(normalized[5], normalized[17]) < 0.025 || distance(normalized[0], normalized[9]) < 0.025) return false;
  const worldValid = worldLandmarks?.length === 21 && worldLandmarks.every(p => p && [p.x, p.y, p.z].every(Number.isFinite));
  const points = worldValid && distance(worldLandmarks[5], worldLandmarks[17]) > 0.00001 ? worldLandmarks : normalized;
  const angle = (a, b, c) => {
    const ab = [a.x - b.x, a.y - b.y, a.z - b.z], cb = [c.x - b.x, c.y - b.y, c.z - b.z];
    const length = Math.hypot(...ab) * Math.hypot(...cb);
    if (length < 1e-9) return 0;
    return Math.acos(constrain(ab.reduce((sum, value, i) => sum + value * cb[i], 0) / length, -1, 1)) * 180 / Math.PI;
  };
  let extended = 0, relaxed = 0;
  for (const base of [5, 9, 13, 17]) {
    const pipAngle = angle(points[base], points[base + 1], points[base + 2]);
    const dipAngle = angle(points[base + 1], points[base + 2], points[base + 3]);
    const reach = distance(points[base + 3], points[0]) / Math.max(distance(points[base + 1], points[0]), 1e-6);
    if (pipAngle >= 150 && dipAngle >= 145 && reach > 1.08) extended++;
    if (pipAngle >= 135 && dipAngle >= 130 && reach > 1.02) relaxed++;
  }
  // 四根长指展开，允许一根手指略弯；不用屏幕上下关系，支持手掌转向。
  return extended >= 3 && relaxed === 4;
}

function applyHandResult(result, now) {
  const best = result.gestures?.[0]?.[0];
  const palmShape = isOpenPalmShape(result.landmarks?.[0], result.worldLandmarks?.[0]);
  const modelAction = MEDIAPIPE_ACTIONS[best?.categoryName];
  const next = palmShape ? 'open' : best?.score >= GESTURE_CONFIG.confidence && modelAction ? modelAction : 'none';
  if (next !== 'none') {
    if (next !== CAM.candidate || now - CAM.candidateLast > 600) {
      CAM.candidate = next; CAM.since = now; CAM.candidateFrames = 0;
    }
    CAM.candidateFrames++; CAM.candidateLast = now; CAM.lastGood = now;
    const stable = now - CAM.since >= GESTURE_CONFIG.stableMs && CAM.candidateFrames >= 3;
    if (stable) setGesture(next);
    const label = next === 'fist' ? '握拳 · 复原继续' : next === 'point' ? '伸指 · 切换风格' : '张手 · 破碎';
    const evidence = palmShape ? '掌形确认' : `${Math.round(best.score * 100)}%`;
    setCameraStatus(`${label} · ${evidence} · ${stable ? '已识别' : '请保持片刻'}`);
  } else {
    // 少量低分帧不重置稳定计时，持续缺手或换动作才重新等待。
    if (now - CAM.candidateLast > 140) { CAM.candidate = ''; CAM.candidateFrames = 0; }
    if (now - CAM.lastGood > GESTURE_CONFIG.lostMs) setGesture('none');
    const label = modelAction === 'open' ? '张手' : modelAction === 'fist' ? '握拳' : modelAction === 'point' ? '伸指' : '';
    setCameraStatus(result.landmarks?.length
      ? (label ? `检测到手 · 候选${label} ${Math.round(best.score * 100)}%（门槛 ${Math.round(GESTURE_CONFIG.confidence * 100)}%），请保持片刻`
        : '已检测到手 · 请让手掌朝向镜头并自然张开手指')
      : '未检测到手 · 请将单手完整放入镜头');
  }
  updateHandMotion(result.landmarks?.[0], now);
}

function updateHandMotion(landmarks, now) {
  const points = [0, 5, 9, 13, 17].map(index => landmarks?.[index]);
  if (points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    CAM.hand = null; return;
  }
  // 与镜像预览一致；以首次看到手掌的位置为中心，避免一出现就突然偏移。
  const x = constrain(1 - points.reduce((sum, point) => sum + point.x, 0) / points.length, 0, 1);
  const y = constrain(points.reduce((sum, point) => sum + point.y, 0) / points.length, 0, 1);
  if (!SWAY.anchor || now - SWAY.lastSeen > 600) SWAY.anchor = { x, y };
  setSceneSwayTarget((x - SWAY.anchor.x) * 2.4, (y - SWAY.anchor.y) * 2.4, now);
  CAM.hand = { x, y, at: now };
  FX.motion.activeUntil = 0;
}
