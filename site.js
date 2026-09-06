(function () {
  const SRS_KEY = "cantoSrsProgress";
  const SRS_INTERVALS = [10 * 60e3, 864e5, 3 * 864e5, 7 * 864e5, 14 * 864e5, 30 * 864e5, 60 * 864e5, 120 * 864e5];

  function readSrs() {
    try { return JSON.parse(localStorage.getItem(SRS_KEY) || "{}"); }
    catch (_error) { return {}; }
  }

  function reviewWord(wordId, isCorrect) {
    if (wordId === null || wordId === undefined) return;
    const state = readSrs();
    const key = String(wordId);
    const previous = state[key] || { stage: -1, correctStreak: 0, lapses: 0 };
    const stage = isCorrect ? Math.min(previous.stage + 1, SRS_INTERVALS.length - 1) : 0;
    const now = Date.now();
    state[key] = { wordId: Number(wordId), stage, dueAt: now + SRS_INTERVALS[stage], correctStreak: isCorrect ? previous.correctStreak + 1 : 0, lapses: previous.lapses + (isCorrect ? 0 : 1), lastReviewedAt: now };
    localStorage.setItem(SRS_KEY, JSON.stringify(state));
  }

  window.cantoSrs = {
    read: readSrs,
    review: reviewWord,
    due: () => Object.values(readSrs()).filter(item => Number(item.dueAt || 0) <= Date.now()).sort((a, b) => a.dueAt - b.dueAt),
    stats: () => { const items = Object.values(readSrs()); return { total: items.length, due: items.filter(item => Number(item.dueAt || 0) <= Date.now()).length, mature: items.filter(item => item.stage >= 4).length }; }
  };

  function seedKnownWords() {
    const state = readSrs();
    const attempts = (() => { try { return JSON.parse(localStorage.getItem("cantoAttempts") || "[]"); } catch (_error) { return []; } })();
    const progress = (() => { try { return JSON.parse(localStorage.getItem("cantoStandaloneProgress") || "{}"); } catch (_error) { return {}; } })();
    const ids = new Set(attempts.map(item => item.wordId).filter(id => id !== null && id !== undefined));
    Object.entries(progress).forEach(([id, status]) => { if (status === "mastered") ids.add(Number(id)); });
    let changed = false;
    ids.forEach(id => {
      if (state[id]) return;
      state[id] = { wordId: Number(id), stage: 0, dueAt: Date.now(), correctStreak: 0, lapses: 0, lastReviewedAt: 0 };
      changed = true;
    });
    if (changed) localStorage.setItem(SRS_KEY, JSON.stringify(state));
  }

  const pages = [
    ["Canto.html", "首页"], ["pronunciation.html", "发音"], ["vocabulary.html", "词汇"],
    ["sentence-patterns.html", "句式"], ["review.html", "练习"], ["characters.html", "字形测试"],
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
    reviewWord(entry.wordId, entry.isCorrect);
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
    const due = window.cantoSrs.stats().due;
    const dueCount = document.getElementById("homeDueCount");
    if (dueCount) dueCount.textContent = String(due);
    const reviewLink = document.getElementById("homeReviewLink");
    if (reviewLink) reviewLink.textContent = due ? `开始练习 ${due} 词 →` : "暂无待练习 →";

  }

  document.addEventListener("DOMContentLoaded", () => {
    seedKnownWords();
    addSiteHeader();
    setupHome();
    setupCloud();
  });
})();
