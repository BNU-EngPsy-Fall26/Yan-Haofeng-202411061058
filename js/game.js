// ============================================================
// game.js
// 自动驾驶检测游戏模块。
// 负责：30 个平衡 trial、限时刺激、F/J 反应、即时反馈、
// H/M/FA/CR 统计、结果页展示、历史记录与 Canvas 刺激生成。
// ============================================================

const STIMULUS_MS = 1000;
const FEEDBACK_MS = 520;
const TOTAL_TRIALS = 30;
const HISTORY_KEY = "sdt_autodrive_history_final";

let gameState = null;
let stimulusTimer = null;
let feedbackTimer = null;
let sessionHistory = [];

function prepareGameInstructions() {
  cancelGameFlow();
  const targetD = Number($("difficultySlider").value);
  $("instructionDprime").textContent = targetD.toFixed(1);
  showScreen("instructionScreen");
}


// 说明页按 Space 开始。使用 event.code 可稳定识别空格键，
// 并阻止浏览器默认的页面滚动行为。
function handleInstructionKeydown(event) {
  if (!$("instructionScreen").classList.contains("active")) return;
  if (event.repeat) return;
  if (event.code !== "Space") return;

  const tag = document.activeElement ? document.activeElement.tagName : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  event.preventDefault();
  startGame();
}

function startGame() {
  cancelGameFlow();

  const targetD = Number($("difficultySlider").value);
  gameState = {
    targetD,
    trials: makeBalancedTrials(TOTAL_TRIALS),
    index: 0,
    counts: { H: 0, M: 0, FA: 0, CR: 0 }
  };

  $("trialTotal").textContent = TOTAL_TRIALS;
  $("gameDprime").textContent = targetD.toFixed(1);
  $("feedbackBox").className = "feedback-box";
  $("feedbackBox").textContent = "准备开始……";
  showScreen("gameScreen");
  showTrial();
}

function cancelGameFlow() {
  clearTimeout(stimulusTimer);
  clearTimeout(feedbackTimer);
  stimulusTimer = null;
  feedbackTimer = null;

  const brake = $("brakeBtn");
  const go = $("goBtn");
  if (brake) brake.disabled = true;
  if (go) go.disabled = true;

  const cover = $("stimulusCover");
  if (cover) cover.classList.add("hidden");
}

// ===== Trial 生成与实验流程 =====
function makeBalancedTrials(n) {
  const half = n / 2;
  const arr = [];
  for (let i = 0; i < half; i++) arr.push(true);
  for (let i = 0; i < half; i++) arr.push(false);

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showTrial() {
  if (!gameState || gameState.index >= gameState.trials.length) {
    finishGame();
    return;
  }

  const actualSignal = gameState.trials[gameState.index];
  const mu = actualSignal ? gameState.targetD / 2 : -gameState.targetD / 2;
  const evidence = normalRandom(mu, 1);
  gameState.current = { actualSignal, evidence };

  $("trialIndex").textContent = gameState.index + 1;
  $("progressBar").style.width = `${(gameState.index / TOTAL_TRIALS) * 100}%`;

  $("stimulusCover").classList.add("hidden");
  $("brakeBtn").disabled = true;
  $("goBtn").disabled = true;
  $("feedbackBox").className = "feedback-box";
  $("feedbackBox").textContent = "请观察道路画面……";

  drawRoadScene(actualSignal, evidence);

  stimulusTimer = setTimeout(() => {
    $("stimulusCover").classList.remove("hidden");
    $("brakeBtn").disabled = false;
    $("goBtn").disabled = false;
    $("feedbackBox").textContent = "请根据刚才的画面作答。";
  }, STIMULUS_MS);
}

function recordResponse(choseBrake) {
  if (!gameState || $("brakeBtn").disabled || $("goBtn").disabled) return;

  $("brakeBtn").disabled = true;
  $("goBtn").disabled = true;

  const { actualSignal } = gameState.current;
  let code;
  let text;
  let good;

  if (actualSignal && choseBrake) {
    code = "H";
    text = "击中：成功发现行人并及时制动。";
    good = true;
  } else if (actualSignal && !choseBrake) {
    code = "M";
    text = "漏报：未及时识别行人风险。";
    good = false;
  } else if (!actualSignal && choseBrake) {
    code = "FA";
    text = "误报：道路无行人，发生了不必要制动。";
    good = false;
  } else {
    code = "CR";
    text = "正确拒斥：道路无行人，正确继续行驶。";
    good = true;
  }

  gameState.counts[code] += 1;
  $("feedbackBox").className = `feedback-box ${good ? "good" : "bad"}`;
  $("feedbackBox").textContent = text;

  feedbackTimer = setTimeout(() => {
    gameState.index += 1;
    showTrial();
  }, FEEDBACK_MS);
}

function handleGameKeydown(event) {
  if (!$("gameScreen").classList.contains("active")) return;
  if (event.repeat) return;

  const tag = document.activeElement ? document.activeElement.tagName : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  const key = event.key.toLowerCase();
  if (key === "f" && !$("brakeBtn").disabled) {
    event.preventDefault();
    flashResponseKey($("brakeBtn"));
    recordResponse(true);
  } else if (key === "j" && !$("goBtn").disabled) {
    event.preventDefault();
    flashResponseKey($("goBtn"));
    recordResponse(false);
  }
}

function flashResponseKey(button) {
  button.classList.add("key-pressed");
  setTimeout(() => button.classList.remove("key-pressed"), 140);
}

function finishGame() {
  clearTimeout(stimulusTimer);
  clearTimeout(feedbackTimer);
  $("progressBar").style.width = "100%";
  renderResults();
  saveCurrentRound();
  renderHistory();
  showScreen("resultScreen");
}

// ===== 结果统计与展示 =====
function renderResults() {
  const { H, M, FA, CR } = gameState.counts;
  const metrics = computeSDTMetrics(gameState.counts);

  $("hitCount").textContent = H;
  $("missCount").textContent = M;
  $("faCount").textContent = FA;
  $("crCount").textContent = CR;

  $("hitRate").textContent = metrics.hitRate.toFixed(2);
  $("faRate").textContent = metrics.faRate.toFixed(2);
  $("observedD").textContent = metrics.observedD.toFixed(2);
  $("criterionC").textContent = metrics.criterionC.toFixed(2);
  $("accuracy").textContent = `${(metrics.accuracy * 100).toFixed(1)}%`;
  $("targetD").textContent = gameState.targetD.toFixed(2);

  const note = $("correctionNote");
  if (metrics.usedCorrection) {
    note.classList.remove("hidden");
    note.textContent = "本局出现 0 或 1 的极端击中率/误报率。为避免 Z 分数无穷大，仅在计算 d′ 与 c 时对极端比例进行了边界修正；页面显示的 P(Hit) 与 P(FA) 仍为原始比例。";
  } else {
    note.classList.add("hidden");
    note.textContent = "";
  }

  let criterionText;
  if (metrics.criterionC > 0.2) {
    criterionText = "你的判定标准偏保守：只有在较确定时才倾向于制动，因此通常会减少误报，但可能增加漏报。";
  } else if (metrics.criterionC < -0.2) {
    criterionText = "你的判定标准偏宽松：较容易选择制动，因此通常会减少漏报，但可能增加误报。";
  } else {
    criterionText = "你的判定标准接近中性：在当前数据下，没有表现出明显的保守或宽松偏向。";
  }
  $("criterionExplain").textContent = criterionText;
}

// ===== 多局历史记录 =====
function saveCurrentRound() {
  if (!gameState) return;
  const metrics = computeSDTMetrics(gameState.counts);
  const record = {
    id: Date.now(),
    targetD: gameState.targetD,
    observedD: metrics.observedD,
    criterionC: metrics.criterionC,
    accuracy: metrics.accuracy,
    hitRate: metrics.hitRate,
    faRate: metrics.faRate
  };

  sessionHistory.push(record);
  sessionHistory = sessionHistory.slice(-20);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessionHistory));
  } catch (error) {
    // file:// 环境中若浏览器限制 localStorage，仍保留本次页面会话的数据。
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed.slice(-20);
  } catch (error) {
    // 忽略读取失败，使用空历史。
  }
  return [];
}

function clearHistory() {
  sessionHistory = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    // 忽略存储限制。
  }
  renderHistory();
}

function renderHistory() {
  const table = $("historyTable");
  if (!table) return;

  if (sessionHistory.length === 0) {
    table.innerHTML = '<div class="history-empty">暂无历史记录。完成一局后会自动显示在这里。</div>';
    drawHistoryChart([]);
    return;
  }

  const recent = sessionHistory.slice(-8).reverse();
  table.innerHTML = `
    <div class="history-row history-row-head">
      <span>局次</span><span>设定 d′</span><span>实测 d′</span><span>c</span><span>准确率</span>
    </div>
    ${recent.map((r, index) => `
      <div class="history-row">
        <span>#${sessionHistory.length - index}</span>
        <span>${r.targetD.toFixed(2)}</span>
        <span>${r.observedD.toFixed(2)}</span>
        <span>${r.criterionC.toFixed(2)}</span>
        <span>${(r.accuracy * 100).toFixed(1)}%</span>
      </div>`).join("")}
  `;

  drawHistoryChart(sessionHistory.slice(-10));
}

function drawHistoryChart(records) {
  const canvas = $("historyCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1727";
  ctx.fillRect(0, 0, w, h);

  if (records.length === 0) {
    ctx.fillStyle = "#8fa6bd";
    ctx.font = "18px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("完成至少一局后显示多局对比", w / 2, h / 2);
    return;
  }

  const padL = 70;
  const padR = 30;
  const padT = 32;
  const padB = 54;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxD = Math.max(3.5, ...records.map(r => Math.max(r.targetD, r.observedD))) + 0.3;
  const minD = Math.min(0, ...records.map(r => Math.min(r.targetD, r.observedD))) - 0.2;
  const xAt = (i) => records.length === 1 ? padL + plotW / 2 : padL + (i / (records.length - 1)) * plotW;
  const yAt = (value) => padT + plotH - ((value - minD) / (maxD - minD)) * plotH;

  ctx.strokeStyle = "rgba(137,169,204,0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i / 4) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#8fa6bd";
  ctx.font = "14px Segoe UI";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const value = maxD - (i / 4) * (maxD - minD);
    ctx.fillText(value.toFixed(1), padL - 12, padT + (i / 4) * plotH + 5);
  }

  drawHistorySeries(ctx, records, xAt, yAt, "targetD", "#5fb3ff");
  drawHistorySeries(ctx, records, xAt, yAt, "observedD", "#ffb866");

  ctx.textAlign = "center";
  records.forEach((_, i) => {
    ctx.fillStyle = "#8fa6bd";
    ctx.fillText(`#${sessionHistory.length - records.length + i + 1}`, xAt(i), h - 18);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#5fb3ff";
  ctx.fillRect(w - 255, 24, 18, 4);
  ctx.fillStyle = "#b9c9da";
  ctx.fillText("系统设定 d′", w - 228, 30);
  ctx.fillStyle = "#ffb866";
  ctx.fillRect(w - 125, 24, 18, 4);
  ctx.fillStyle = "#b9c9da";
  ctx.fillText("实测 d′", w - 98, 30);
}

function drawHistorySeries(ctx, records, xAt, yAt, key, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  records.forEach((record, i) => {
    const x = xAt(i);
    const y = yAt(record[key]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  records.forEach((record, i) => {
    ctx.beginPath();
    ctx.arc(xAt(i), yAt(record[key]), 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---------- 游戏画面 ---------- */

// ===== Canvas 夜间道路刺激 =====
// 系统设定 d′ 通过目标清晰度、类人干扰物相似度、遮挡和候选物数量
// 调节视觉可分辨性；刺激呈现时长保持固定，避免把时长混入难度操纵。
function drawRoadScene(actualSignal, evidence) {
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const profile = getDifficultyProfile(gameState.targetD);
  const sceneSeed = 101 + gameState.index * 97 + Math.round(gameState.targetD * 10) * 13;

  ctx.clearRect(0, 0, w, h);
  drawNightRoadBackground(ctx, w, h, sceneSeed);

  const objects = buildCandidateObjects(actualSignal, evidence, profile, sceneSeed, w, h);
  objects.sort((a, b) => a.y - b.y).forEach((object) => {
    if (object.kind === "pedestrian") {
      drawPedestrianCandidate(ctx, object, profile);
    } else {
      drawDistractorCandidate(ctx, object, profile);
    }
  });

  drawHud(ctx, w, gameState.targetD, objects.length);
}

function getDifficultyProfile(targetD) {
  const ease = clamp01((targetD - 0.5) / 2.5);
  const hardness = 1 - ease;
  return {
    ease,
    hardness,
    baseBlur: lerp(7.2, 1.0, ease),
    targetContrast: lerp(0.40, 0.92, ease),
    limbVisibility: lerp(0.28, 0.96, ease),
    occlusionChance: lerp(0.72, 0.12, ease),
    occlusionAmount: lerp(0.52, 0.12, ease),
    lureSimilarity: lerp(0.88, 0.36, ease),
    peripheralSpread: lerp(225, 150, ease)
  };
}

function buildCandidateObjects(actualSignal, evidence, profile, seed, w, h) {
  const chanceThree = 0.12 + profile.hardness * 0.73;
  const objectCount = pseudo(seed + 11) < chanceThree ? 3 : 2;
  const slots = [
    { x: 0.33, y: 0.66 },
    { x: 0.43, y: 0.57 },
    { x: 0.52, y: 0.64 },
    { x: 0.60, y: 0.55 },
    { x: 0.69, y: 0.66 }
  ];

  // 按当前 trial 的 seed 打乱候选位置，避免被试学会“人总在某个位置”。
  const shuffled = slots.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(pseudo(seed + i * 31) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const selected = shuffled.slice(0, objectCount);
  let targetIndex = -1;
  if (actualSignal) {
    // 低 d′ 时更可能把行人放在稍偏的位置；高 d′ 时位置仍随机，但偏心程度较小。
    targetIndex = Math.floor(pseudo(seed + 77) * objectCount);
  }

  const evidenceNorm = clamp01(0.5 + evidence * 0.16);
  return selected.map((slot, index) => {
    const xJitter = (pseudo(seed + 120 + index * 7) - 0.5) * 38;
    const yJitter = (pseudo(seed + 170 + index * 11) - 0.5) * 22;
    const x = slot.x * w + xJitter;
    const y = slot.y * h + yJitter;
    const perspective = clamp(0.60 + ((y / h) - 0.50) * 1.65, 0.54, 1.08);

    if (index === targetIndex) {
      const clarity = clamp01(0.18 + profile.ease * 0.48 + evidenceNorm * 0.38);
      const occluded = pseudo(seed + 240 + index * 13) < profile.occlusionChance;
      return {
        kind: "pedestrian",
        x,
        y,
        scale: perspective,
        clarity,
        blur: Math.max(0.6, profile.baseBlur * (1.18 - clarity * 0.45)),
        contrast: clamp(0.28 + profile.targetContrast * 0.52 + clarity * 0.20, 0.25, 0.95),
        limbVisibility: clamp(profile.limbVisibility * (0.60 + clarity * 0.55), 0.18, 1),
        occluded,
        occlusionAmount: profile.occlusionAmount * (0.82 + pseudo(seed + 300 + index) * 0.30)
      };
    }

    // Noise trial 中的 evidence 越高，最像人的干扰物越容易“骗”过观察者。
    const lureBoost = actualSignal ? 0 : (evidenceNorm - 0.5) * 0.34;
    const similarity = clamp01(profile.lureSimilarity + lureBoost + (pseudo(seed + 330 + index * 19) - 0.5) * 0.16);
    const typePick = pseudo(seed + 410 + index * 23);
    const type = similarity > 0.66 ? "humanlike" : (typePick < 0.5 ? "sign" : typePick < 0.78 ? "bollard" : "shrub");
    return {
      kind: "distractor",
      type,
      x,
      y,
      scale: perspective,
      similarity,
      blur: Math.max(0.5, profile.baseBlur * (0.72 + similarity * 0.32)),
      alpha: clamp(0.34 + similarity * 0.46, 0.30, 0.82),
      occluded: pseudo(seed + 510 + index * 29) < profile.occlusionChance * 0.48,
      occlusionAmount: profile.occlusionAmount * 0.70
    };
  });
}

function drawNightRoadBackground(ctx, w, h, seed) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#050d18");
  sky.addColorStop(0.56, "#091522");
  sky.addColorStop(1, "#131f2d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 远处灯光，让场景保持夜间驾驶感，同时避免形成固定的目标线索。
  for (let i = 0; i < 20; i++) {
    const x = pseudo(seed + i * 17) * w;
    const y = 52 + pseudo(seed + i * 29) * 130;
    const r = 1 + pseudo(seed + i * 41) * 2.4;
    ctx.fillStyle = `rgba(255,221,164,${0.12 + pseudo(seed + i * 53) * 0.36})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#161f2a";
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.34);
  ctx.lineTo(w * 0.66, h * 0.34);
  ctx.lineTo(w * 0.94, h);
  ctx.lineTo(w * 0.06, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#68727e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.34);
  ctx.lineTo(w * 0.06, h);
  ctx.moveTo(w * 0.66, h * 0.34);
  ctx.lineTo(w * 0.94, h);
  ctx.stroke();

  ctx.strokeStyle = "rgba(228,234,239,0.66)";
  ctx.lineWidth = 5;
  ctx.setLineDash([32, 30]);
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.38);
  ctx.lineTo(w * 0.50, h);
  ctx.stroke();
  ctx.setLineDash([]);

  const beam = ctx.createRadialGradient(w * 0.5, h * 0.92, 22, w * 0.5, h * 0.76, 390);
  beam.addColorStop(0, "rgba(244,238,197,0.19)");
  beam.addColorStop(1, "rgba(244,238,197,0)");
  ctx.fillStyle = beam;
  ctx.fillRect(0, h * 0.34, w, h * 0.66);

  drawBackgroundClutter(ctx, w, h, seed);

  // 轻微夜视噪声，不随 d′ 改变，作为所有条件共同背景。
  ctx.fillStyle = "rgba(210,225,235,0.035)";
  for (let i = 0; i < 70; i++) {
    const x = pseudo(seed + 700 + i * 3) * w;
    const y = 150 + pseudo(seed + 900 + i * 5) * (h - 160);
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

function drawBackgroundClutter(ctx, w, h, seed) {
  // 路边柱与护栏只作为背景，不计入 2–3 个候选物体。
  ctx.fillStyle = "rgba(108,121,135,0.27)";
  for (let i = 0; i < 4; i++) {
    const left = pseudo(seed + i * 37) > 0.5;
    const x = left ? 58 + pseudo(seed + i * 43) * 150 : w - 210 + pseudo(seed + i * 47) * 140;
    const y = 205 + pseudo(seed + i * 59) * 105;
    ctx.fillRect(x, y, 7, 45 + pseudo(seed + i * 61) * 60);
  }
  ctx.strokeStyle = "rgba(124,139,151,0.27)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(735, 320);
  ctx.lineTo(930, 395);
  ctx.stroke();
}

function drawPedestrianCandidate(ctx, object, profile) {
  const { x, y, scale, clarity, blur, contrast, limbVisibility, occluded, occlusionAmount } = object;
  const bodyAlpha = clamp(0.26 + contrast * 0.56, 0.25, 0.88);
  const limbAlpha = bodyAlpha * limbVisibility;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.shadowColor = `rgba(220,232,242,${0.08 + clarity * 0.20})`;
  ctx.shadowBlur = 8 + blur * 1.8;

  // 头部在低 d′ 时更暗、更不完整。
  ctx.fillStyle = `rgba(190,204,216,${bodyAlpha * (0.70 + clarity * 0.30)})`;
  ctx.beginPath();
  ctx.ellipse(0, -45, 12 + clarity * 2.5, 13 + clarity * 2.5, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // 躯干故意做成不规则轮廓，避免“标准火柴人”成为过强线索。
  ctx.beginPath();
  ctx.moveTo(-14, -29);
  ctx.lineTo(13, -31);
  ctx.lineTo(19, 20);
  ctx.lineTo(-18, 20);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(207,219,230,${limbAlpha})`;
  ctx.lineWidth = 4.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (limbVisibility > 0.34) {
    ctx.moveTo(-9, 17);
    ctx.lineTo(-19 - (1 - clarity) * 5, 67);
  }
  if (limbVisibility > 0.47 || pseudo(x + y) > 0.44) {
    ctx.moveTo(9, 17);
    ctx.lineTo(20 + (1 - clarity) * 4, 67);
  }
  if (limbVisibility > 0.56) {
    ctx.moveTo(-13, -18);
    ctx.lineTo(-31, 12 + clarity * 6);
  }
  if (limbVisibility > 0.70) {
    ctx.moveTo(13, -18);
    ctx.lineTo(31, 13);
  }
  ctx.stroke();
  ctx.restore();

  if (occluded) drawForegroundOccluder(ctx, object, occlusionAmount);
}

function drawDistractorCandidate(ctx, object, profile) {
  const { type, x, y, scale, similarity, blur, alpha, occluded, occlusionAmount } = object;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.fillStyle = `rgba(166,181,194,${alpha})`;
  ctx.strokeStyle = `rgba(197,209,220,${alpha * 0.92})`;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  if (type === "humanlike") {
    // “似人非人”：圆形路牌/反光牌 + 立柱 + 横向支架。低 d′ 时轮廓与人更接近。
    const headY = -43;
    ctx.beginPath();
    ctx.ellipse(0, headY, 11 + similarity * 3, 11 + similarity * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8 - similarity * 2, -30, 16 + similarity * 4, 52);
    ctx.beginPath();
    ctx.moveTo(-8, 16);
    ctx.lineTo(-15 - similarity * 5, 65);
    ctx.moveTo(8, 16);
    ctx.lineTo(14 + similarity * 5, 64);
    if (similarity > 0.72) {
      ctx.moveTo(-8, -17);
      ctx.lineTo(-27, 7);
      ctx.moveTo(8, -17);
      ctx.lineTo(25, 5);
    }
    ctx.stroke();
  } else if (type === "sign") {
    ctx.fillRect(-5, -24, 10, 88);
    ctx.beginPath();
    ctx.arc(0, -43, 24, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "bollard") {
    ctx.beginPath();
    ctx.roundRect(-15, -35, 30, 93, 8);
    ctx.fill();
    ctx.fillStyle = `rgba(218,225,232,${alpha * 0.55})`;
    ctx.fillRect(-15, -9, 30, 9);
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 57, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-4, 33, 8, 36);
  }
  ctx.restore();

  if (occluded) drawForegroundOccluder(ctx, object, occlusionAmount);
}

function drawForegroundOccluder(ctx, object, amount) {
  const width = 78 * object.scale;
  const height = (26 + amount * 56) * object.scale;
  const top = object.y + (18 + (1 - amount) * 26) * object.scale;
  ctx.save();
  ctx.fillStyle = "rgba(18,28,38,0.96)";
  ctx.fillRect(object.x - width / 2, top, width, height);
  ctx.strokeStyle = "rgba(102,118,130,0.75)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(object.x - width / 2 - 5, top + 5);
  ctx.lineTo(object.x + width / 2 + 5, top + 5);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, w, targetD, objectCount) {
  ctx.fillStyle = "rgba(3,9,16,0.61)";
  ctx.fillRect(22, 20, 275, 82);
  ctx.strokeStyle = "rgba(89,176,255,0.58)";
  ctx.strokeRect(22, 20, 275, 82);
  ctx.fillStyle = "#9cd2ff";
  ctx.font = "18px Segoe UI";
  ctx.fillText("ADAS NIGHT VISION", 42, 49);
  ctx.fillStyle = "#d9ecff";
  ctx.font = "14px Segoe UI";
  ctx.fillText(`SYSTEM d′ = ${targetD.toFixed(1)}`, 42, 73);
  ctx.fillText(`CANDIDATES = ${objectCount}`, 160, 73);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function pseudo(seed) {
  const x = Math.sin(seed * 999.91) * 43758.5453;
  return x - Math.floor(x);
}
