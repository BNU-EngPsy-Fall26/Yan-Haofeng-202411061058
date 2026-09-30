// ============================================================
// lab.js
// 概念实验室模块。
// 负责三类交互可视化：双分布与 criterion、ROC 曲线、
// 先验概率/支付矩阵与最优 β、c。所有结果随滑块实时联动。
// ============================================================

function syncLabD(value) {
  $("labDSlider").value = value;
  $("rocDSlider").value = value;
  $("costDSlider").value = value;
}

function updateLabAll() {
  updateDistributionPanel();
  updateRocPanel();
  updateCostPanel();
}

// ===== 双分布、混淆矩阵与 SDT 指标联动 =====
function updateDistributionPanel() {
  const d = Number($("labDSlider").value);
  const c = Number($("labCSlider").value);

  $("labDValue").textContent = d.toFixed(1);
  $("labCValue").textContent = c.toFixed(1);

  const hit = 1 - normalCDF(c - d / 2);
  const fa = 1 - normalCDF(c + d / 2);
  const miss = 1 - hit;
  const cr = 1 - fa;
  const beta = Math.exp(d * c);
  const auc = normalCDF(d / Math.sqrt(2));

  $("labHit").textContent = hit.toFixed(2);
  $("labMiss").textContent = miss.toFixed(2);
  $("labFA").textContent = fa.toFixed(2);
  $("labCR").textContent = cr.toFixed(2);
  $("labBeta").textContent = beta.toFixed(2);
  $("labAuc").textContent = auc.toFixed(2);

  $("labMatrixH").textContent = hit.toFixed(2);
  $("labMatrixM").textContent = miss.toFixed(2);
  $("labMatrixFA").textContent = fa.toFixed(2);
  $("labMatrixCR").textContent = cr.toFixed(2);

  drawDistributions(d, c);
}

function drawDistributions(d, c) {
  const canvas = $("distributionCanvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const padL = 70;
  const padR = 30;
  const padT = 42;
  const padB = 62;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const xMin = -4;
  const xMax = 4;
  const maxY = 0.43;
  const sx = (x) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y) => padT + plotH - (y / maxY) * plotH;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1727";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(137,169,204,0.12)";
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(sx(i), padT);
    ctx.lineTo(sx(i), padT + plotH);
    ctx.stroke();
  }

  ctx.strokeStyle = "#6d8199";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  const noiseMu = -d / 2;
  const signalMu = d / 2;

  // 四种结果区域：Noise 左=CR、右=FA；Signal 左=Miss、右=Hit。
  fillNormalArea(ctx, sx, sy, noiseMu, xMin, Math.min(c, xMax), "rgba(50,196,141,0.13)");
  fillNormalArea(ctx, sx, sy, noiseMu, Math.max(c, xMin), xMax, "rgba(255,104,104,0.13)");
  fillNormalArea(ctx, sx, sy, signalMu, xMin, Math.min(c, xMax), "rgba(255,184,102,0.12)");
  fillNormalArea(ctx, sx, sy, signalMu, Math.max(c, xMin), xMax, "rgba(95,179,255,0.12)");

  drawNormalCurve(ctx, sx, sy, noiseMu, "#5fb3ff");
  drawNormalCurve(ctx, sx, sy, signalMu, "#ff7d7d");

  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(sx(c), padT);
  ctx.lineTo(sx(c), padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#ffd166";
  ctx.font = "15px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(`c = ${c.toFixed(1)}`, Math.min(w - 90, sx(c) + 8), padT + 18);

  ctx.fillStyle = "#91a7bf";
  ctx.textAlign = "center";
  for (let i = -4; i <= 4; i++) {
    ctx.fillText(String(i), sx(i), padT + plotH + 26);
  }
  ctx.fillText("内部证据 x", padL + plotW / 2, h - 14);

  drawLegendItem(ctx, w - 330, 26, "#5fb3ff", "Noise");
  drawLegendItem(ctx, w - 225, 26, "#ff7d7d", "Signal");
  drawLegendItem(ctx, w - 105, 26, "#ffd166", "criterion");
}

function fillNormalArea(ctx, sx, sy, mu, fromX, toX, color) {
  if (toX <= fromX) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sx(fromX), sy(0));
  for (let x = fromX; x <= toX + 0.001; x += 0.03) {
    ctx.lineTo(sx(x), sy(normalPDF(x, mu, 1)));
  }
  ctx.lineTo(sx(toX), sy(0));
  ctx.closePath();
  ctx.fill();
}

function drawNormalCurve(ctx, sx, sy, mu, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  let first = true;
  for (let x = -4; x <= 4.001; x += 0.03) {
    const y = normalPDF(x, mu, 1);
    if (first) {
      ctx.moveTo(sx(x), sy(y));
      first = false;
    } else {
      ctx.lineTo(sx(x), sy(y));
    }
  }
  ctx.stroke();
}

function drawLegendItem(ctx, x, y, color, text) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 18, 4);
  ctx.fillStyle = "#b9c9da";
  ctx.font = "14px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 26, y + 5);
}

// ===== ROC 曲线 =====
function updateRocPanel() {
  const d = Number($("rocDSlider").value);
  const c = Number($("rocCSlider").value);
  $("rocDValue").textContent = d.toFixed(1);
  $("rocCValue").textContent = c.toFixed(1);

  const hit = 1 - normalCDF(c - d / 2);
  const fa = 1 - normalCDF(c + d / 2);
  const auc = normalCDF(d / Math.sqrt(2));
  $("rocFA").textContent = fa.toFixed(2);
  $("rocHit").textContent = hit.toFixed(2);
  $("rocAuc").textContent = auc.toFixed(2);
  drawRoc(d, c);
}

function drawRoc(d, c) {
  const canvas = $("rocCanvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const padL = 84;
  const padR = 40;
  const padT = 36;
  const padB = 70;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const sx = (x) => padL + x * plotW;
  const sy = (y) => padT + (1 - y) * plotH;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1727";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(137,169,204,0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const p = i / 10;
    ctx.beginPath();
    ctx.moveTo(sx(p), padT);
    ctx.lineTo(sx(p), padT + plotH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padL, sy(p));
    ctx.lineTo(padL + plotW, sy(p));
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(180,195,210,0.35)";
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0));
  ctx.lineTo(sx(1), sy(1));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#5fb3ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  let first = true;
  for (let k = 4; k >= -4; k -= 0.03) {
    const fa = 1 - normalCDF(k + d / 2);
    const hit = 1 - normalCDF(k - d / 2);
    if (first) {
      ctx.moveTo(sx(fa), sy(hit));
      first = false;
    } else {
      ctx.lineTo(sx(fa), sy(hit));
    }
  }
  ctx.stroke();

  const currentFA = 1 - normalCDF(c + d / 2);
  const currentHit = 1 - normalCDF(c - d / 2);
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(sx(currentFA), sy(currentHit), 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#dcecff";
  ctx.font = "15px Segoe UI";
  ctx.textAlign = "center";
  for (let i = 0; i <= 5; i++) {
    const p = i / 5;
    ctx.fillText(p.toFixed(1), sx(p), padT + plotH + 28);
  }
  ctx.save();
  ctx.translate(22, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("P(Hit)", 0, 0);
  ctx.restore();
  ctx.fillText("P(False Alarm)", padL + plotW / 2, h - 18);
}

// ===== 先验概率、支付矩阵与最优判定标准 =====
function updateCostPanel() {
  const pSignal = Number($("priorSlider").value);
  const d = Number($("costDSlider").value);
  const rewardHit = clampNonNegative($("hitRewardInput").value);
  const costMiss = clampNonNegative($("missCostInput").value);
  const costFA = clampNonNegative($("faCostInput").value);
  const rewardCR = clampNonNegative($("crRewardInput").value);

  $("priorValue").textContent = pSignal.toFixed(2);
  $("costDValue").textContent = d.toFixed(1);

  const pNoise = 1 - pSignal;
  const denominator = rewardHit + costMiss;
  const numerator = rewardCR + costFA;

  if (denominator <= 0 || numerator <= 0) {
    $("betaOpt").textContent = "—";
    $("cOpt").textContent = "—";
    $("costInterpret").textContent = "支付矩阵两侧至少需要有一个正的收益或代价，才能计算最优标准。";
    return;
  }

  const betaOpt = (pNoise / pSignal) * (numerator / denominator);
  const cOpt = Math.log(betaOpt) / d;
  $("betaOpt").textContent = betaOpt.toFixed(2);
  $("cOpt").textContent = cOpt.toFixed(2);

  let text;
  if (cOpt < -0.2) {
    text = "最优标准偏宽松：当前漏报代价较高、Hit收益较高或信号更常见，系统应更容易触发“制动”，以减少漏报。";
  } else if (cOpt > 0.2) {
    text = "最优标准偏保守：当前误报代价较高、CR收益较高或信号更少见，系统应更谨慎地触发“制动”。";
  } else {
    text = "最优标准接近中性：在当前先验概率与支付矩阵下，两种判断倾向较为平衡。";
  }
  $("costInterpret").textContent = text;
}

function clampNonNegative(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
