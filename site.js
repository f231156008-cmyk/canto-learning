(function () {
  const pages = [
    ["Canto.html", "首页"], ["pronunciation.html", "发音"], ["vocabulary.html", "词汇"],
    ["quiz.html", "练习"], ["characters.html", "字形测试"],
    ["cha-chaan-teng.html", "闯关测试"], ["wordlist.html", "词库"], ["profile.html", "我的"]
  ];

  window.cantoRecordAttempt = function (attempt) {
    const key = "cantoAttempts";
    const records = JSON.parse(localStorage.getItem(key) || "[]");
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toISOString(),
      type: attempt.type || "quiz",
      wordId: attempt.wordId ?? null,
      prompt: String(attempt.prompt || ""),
      answer: String(attempt.answer || ""),
      correctAnswer: String(attempt.correctAnswer || ""),
      isCorrect: Boolean(attempt.isCorrect)
    };
    const latest = records[0];
    if (latest && latest.type === entry.type && latest.prompt === entry.prompt && latest.answer === entry.answer && Date.now() - new Date(latest.time).getTime() < 3000) return latest;
    records.unshift(entry);
    localStorage.setItem(key, JSON.stringify(records.slice(0, 1000)));
    if (window.cantoCloud) window.cantoCloud.queueSync();
    return entry;
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function setupCloud() {
    try {
      await loadScript("supabase-config.js");
      if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      await loadScript("cloud-sync.js");
      await window.cantoCloud.init();
    } catch (error) {
      document.dispatchEvent(new CustomEvent("canto-cloud-error", { detail: error }));
    }
  }

  function addSiteHeader() {
    if (document.querySelector(".site-header")) return;
    const current = location.pathname.split("/").pop() || "Canto.html";
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `<a class="site-name" href="Canto.html">粵語學習</a><nav class="site-nav" aria-label="主导航">${pages.map(([href, label]) => `<a href="${href}"${current === href ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav><span class="sync-indicator">本地保存</span>`;
    document.body.prepend(header);
  }

  function setupHome() {
    if (!document.body.classList.contains("home-page")) return;
    const category = localStorage.getItem("cantoLearningCategory");
    const level = localStorage.getItem("cantoLearningLevel");
    if (category || level) {
      document.getElementById("continueTitle").textContent = [category, level].filter(Boolean).join(" · ");
    }

  }

  document.addEventListener("DOMContentLoaded", () => {
    addSiteHeader();
    setupHome();
    setupCloud();
  });
})();
