// ============================================================
// sdt.js
// 信号检测论数学工具。
// 提供标准正态分布 PDF/CDF/Z 反变换，并根据 H/M/FA/CR 计算
// P(Hit)、P(FA)、d′、c 与准确率。
// 仅当比例恰好为 0 或 1 时进行边界修正，以避免 Z=±∞。
// ============================================================

function $(id) {
  return document.getElementById(id);
}

function normalPDF(x, mean = 0, sd = 1) {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// Peter John Acklam 的标准正态分布反函数近似
function normalInv(p) {
  if (p <= 0 || p >= 1) {
    throw new Error("normalInv requires 0 < p < 1");
  }

  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479806614716e+01,
     2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00
  ];
  const d = [
     7.784695709041462e-03,
     3.224671290700398e-01,
     2.445134137142996e+00,
     3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q;
  let r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function normalRandom(mean = 0, sd = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + sd * z;
}

// 只在击中率或误报率恰好为 0/1 时修正，普通比例保持原值。
function correctExtremeRate(rate, n) {
  if (rate === 0) return 0.5 / n;
  if (rate === 1) return 1 - 0.5 / n;
  return rate;
}

function computeSDTMetrics(counts) {
  const { H, M, FA, CR } = counts;
  const nSignal = H + M;
  const nNoise = FA + CR;

  const hitRate = H / nSignal;
  const faRate = FA / nNoise;
  const accuracy = (H + CR) / (nSignal + nNoise);

  const hitForZ = correctExtremeRate(hitRate, nSignal);
  const faForZ = correctExtremeRate(faRate, nNoise);
  const usedCorrection = hitForZ !== hitRate || faForZ !== faRate;

  const zH = normalInv(hitForZ);
  const zFA = normalInv(faForZ);

  return {
    hitRate,
    faRate,
    accuracy,
    observedD: zH - zFA,
    criterionC: -0.5 * (zH + zFA),
    usedCorrection,
    hitForZ,
    faForZ
  };
}
