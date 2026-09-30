// ============================================================
// app.js
// 页面切换与全局事件绑定。
// 这里不负责 SDT 计算或刺激绘制，只负责把各模块连接起来。
// ============================================================

const screens = ["homeScreen", "instructionScreen", "gameScreen", "resultScreen", "labScreen"];

function showScreen(id) {
  const gameWasActive = $("gameScreen").classList.contains("active");
  if (gameWasActive && id !== "gameScreen") {
    cancelGameFlow();
  }

  screens.forEach((screenId) => {
    $(screenId).classList.toggle("active", screenId === id);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindSyncedRangeNumber(sliderId, numberId) {
  const slider = $(sliderId);
  const number = $(numberId);

  slider.addEventListener("input", () => {
    number.value = slider.value;
    updateCostPanel();
  });

  number.addEventListener("input", () => {
    if (number.value === "") return;
    const min = Number(number.min);
    const max = Number(number.max);
    const value = Math.min(max, Math.max(min, Number(number.value)));
    if (!Number.isFinite(value)) return;
    slider.value = value;
    updateCostPanel();
  });

  number.addEventListener("change", () => {
    const min = Number(number.min);
    const max = Number(number.max);
    let value = Number(number.value);
    if (!Number.isFinite(value)) value = Number(slider.value);
    value = Math.min(max, Math.max(min, value));
    number.value = value;
    slider.value = value;
    updateCostPanel();
  });
}

function initApp() {
  sessionHistory = loadHistory();
  renderHistory();

  $("difficultySlider").addEventListener("input", () => {
    $("difficultyValue").textContent = Number($("difficultySlider").value).toFixed(1);
  });

  $("homeBtn").addEventListener("click", () => showScreen("homeScreen"));
  $("startBtn").addEventListener("click", prepareGameInstructions);
  $("replayBtn").addEventListener("click", prepareGameInstructions);
  // 说明页以 Space 为主要开始方式；按钮仍保留为鼠标备用入口。
  $("confirmStartBtn").addEventListener("click", startGame);
  document.addEventListener("keydown", handleInstructionKeydown);

  // 正式实验中的 F/J 键盘反应，同时保留页面按钮作为备用操作。
  $("brakeBtn").addEventListener("click", () => recordResponse(true));
  $("goBtn").addEventListener("click", () => recordResponse(false));
  document.addEventListener("keydown", handleGameKeydown);
  $("clearHistoryBtn").addEventListener("click", clearHistory);

  $("labBtn").addEventListener("click", () => {
    syncLabD(Number($("difficultySlider").value));
    showScreen("labScreen");
    updateLabAll();
  });

  $("resultLabBtn").addEventListener("click", () => {
    syncLabD(gameState ? gameState.targetD : Number($("difficultySlider").value));
    showScreen("labScreen");
    updateLabAll();
  });

  $("labBackBtn").addEventListener("click", () => showScreen("homeScreen"));

  document.querySelectorAll(".lab-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".lab-tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".lab-panel").forEach((p) => p.classList.remove("active"));
      button.classList.add("active");
      $(`tab-${button.dataset.tab}`).classList.add("active");
      updateLabAll();
    });
  });

  $("labDSlider").addEventListener("input", () => {
    $("rocDSlider").value = $("labDSlider").value;
    updateLabAll();
  });
  $("labCSlider").addEventListener("input", () => {
    $("rocCSlider").value = $("labCSlider").value;
    updateLabAll();
  });
  $("rocDSlider").addEventListener("input", () => {
    $("labDSlider").value = $("rocDSlider").value;
    updateLabAll();
  });
  $("rocCSlider").addEventListener("input", () => {
    $("labCSlider").value = $("rocCSlider").value;
    updateLabAll();
  });

  ["priorSlider", "costDSlider"].forEach((id) => {
    $(id).addEventListener("input", updateCostPanel);
  });

  bindSyncedRangeNumber("hitRewardSlider", "hitRewardInput");
  bindSyncedRangeNumber("missCostSlider", "missCostInput");
  bindSyncedRangeNumber("faCostSlider", "faCostInput");
  bindSyncedRangeNumber("crRewardSlider", "crRewardInput");

  syncLabD(Number($("difficultySlider").value));
  updateLabAll();
}

initApp();
