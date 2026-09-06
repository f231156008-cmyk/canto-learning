(function () {
  const SRS_KEY = "cantoSrsProgress";
  const LANGUAGE_KEY = "cantoUiLanguage";
  const OPENCC_SRC = "https://cdn.jsdelivr.net/npm/opencc-js@1.4.1/dist/umd/full.js";
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
    ["sentence-patterns.html", "句式"], ["quiz.html", "练习"], ["characters.html", "字形测试"],
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
    header.innerHTML = `<a class="site-name" href="Canto.html">粵語</a><nav class="site-nav" aria-label="主导航">${pages.map(([href, label]) => `<a href="${href}"${current === href ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav><div class="site-tools"><button class="language-toggle" type="button" aria-label="切换简体或繁体中文">简</button><span class="sync-indicator">本地保存</span></div>`;
    document.body.prepend(header);
  }

  async function setupLanguageToggle() {
    const button = document.querySelector(".language-toggle");
    if (!button) return;
    let language = localStorage.getItem(LANGUAGE_KEY) || "zh-Hant";
    let observer;
    try {
      if (!window.OpenCC) await loadScript(OPENCC_SRC);
    } catch (_error) {
      button.disabled = true;
      return;
    }
    const convertPage = () => {
      if (observer) observer.disconnect();
      const converter = window.OpenCC.Converter(language === "zh-Hans" ? { from: "hk", to: "cn" } : { from: "cn", to: "hk" });
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest("[data-no-convert]") || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => { node.nodeValue = converter(node.nodeValue); });
      document.querySelectorAll("[placeholder], [title], [aria-label]").forEach(element => {
        if (element.closest("[data-no-convert]")) return;
        ["placeholder", "title", "aria-label"].forEach(attribute => {
          if (element.hasAttribute(attribute)) element.setAttribute(attribute, converter(element.getAttribute(attribute)));
        });
      });
      document.documentElement.lang = language === "zh-Hans" ? "zh-CN" : "zh-HK";
      document.querySelectorAll("[data-no-convert]").forEach(element => element.setAttribute("lang", "zh-HK"));
      button.textContent = language === "zh-Hans" ? "繁" : "简";
      button.title = language === "zh-Hans" ? "切换至繁体中文" : "切换至简体中文";
      if (observer) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    observer = new MutationObserver(convertPage);
    convertPage();
    button.addEventListener("click", () => {
      language = language === "zh-Hans" ? "zh-Hant" : "zh-Hans";
      localStorage.setItem(LANGUAGE_KEY, language);
      convertPage();
    });
  }

  function setupHome() {
    if (!document.body.classList.contains("home-page")) return;
    const category = localStorage.getItem("cantoLearningCategory");
    const level = localStorage.getItem("cantoLearningLevel");
    if (category || level) {
      document.getElementById("continueTitle").textContent = [category, level].filter(Boolean).join(" · ");
    }
    const srsStats = window.cantoSrs.stats();
    const due = srsStats.due;
    const dueCount = document.getElementById("homeDueCount");
    if (dueCount) dueCount.textContent = String(due);
    const reviewLink = document.getElementById("homeReviewLink");
    if (reviewLink) reviewLink.textContent = due ? `开始练习 ${due} 词 →` : "暂无待练习 →";

    const attempts = (() => { try { return JSON.parse(localStorage.getItem("cantoAttempts") || "[]"); } catch (_error) { return []; } })();
    const correct = attempts.filter(item => item.isCorrect).length;
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = String(value); };
    setText("dashboardLearned", srsStats.total);
    setText("dashboardDue", due);
    setText("dashboardAttempts", attempts.length);
    setText("dashboardAccuracy", attempts.length ? `${Math.round(correct / attempts.length * 100)}%` : "—");
    const wordProgress = (() => { try { return JSON.parse(localStorage.getItem("cantoStandaloneProgress") || "{}"); } catch (_error) { return {}; } })();
    const completed = Object.values(wordProgress).filter(status => status === "mastered").length;
    setText("dashboardMemoryText", `${completed} / 0`);
    const memoryBar = document.getElementById("dashboardMemoryBar");
    if (memoryBar) memoryBar.style.width = "0%";
    fetch("words.json").then(response => response.ok ? response.json() : []).then(words => {
      const total = Array.isArray(words) ? words.length : 0;
      setText("dashboardMemoryText", `${completed} / ${total}`);
      if (memoryBar) memoryBar.style.width = `${total ? Math.round(completed / total * 100) : 0}%`;
    }).catch(() => {});

  }

  document.addEventListener("DOMContentLoaded", () => {
    seedKnownWords();
    addSiteHeader();
    setupLanguageToggle();
    setupHome();
    setupCloud();
  });
})();
