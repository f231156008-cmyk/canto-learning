(function () {
  const typeNames = {
    tone_mark: "粤拼补声调",
    jyutping_typing_no_tone: "粤拼打字",
    traditional_character: "繁体字形",
    quiz: "练习",
    placement_test: "跳级测试",
    local_challenge: "闯关"
  };
  let records = JSON.parse(localStorage.getItem("cantoAttempts") || "[]");
  const list = document.getElementById("recordList");
  const empty = document.getElementById("recordEmpty");
  const summary = document.getElementById("recordSummary");

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-Hant-HK", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function render(filter) {
    const visible = records.filter(item => filter === "all" || (filter === "wrong" ? !item.isCorrect : item.isCorrect));
    const correct = records.filter(item => item.isCorrect).length;
    summary.textContent = records.length ? `共 ${records.length} 次 · 答对 ${correct} 次 · 错题 ${records.length - correct} 次` : "";
    list.replaceChildren(...visible.map(item => {
      const article = document.createElement("article");
      article.className = `record-item ${item.isCorrect ? "record-correct" : "record-wrong"}`;
      article.innerHTML = `<div class="record-main"><span class="record-result">${item.isCorrect ? "正确" : "错误"}</span><strong>${item.prompt || "未命名题目"}</strong><span class="record-type">${typeNames[item.type] || item.type}</span></div><div class="record-answer"><span>你的答案　${item.answer || "—"}</span>${item.isCorrect ? "" : `<span>正确答案　${item.correctAnswer || "—"}</span>`}</div><time>${formatTime(item.time)}</time>`;
      return article;
    }));
    empty.hidden = visible.length > 0;
  }

  document.querySelector(".record-tabs").addEventListener("click", event => {
    const button = event.target.closest("[data-record-filter]");
    if (!button) return;
    document.querySelectorAll("[data-record-filter]").forEach(item => item.classList.toggle("active", item === button));
    render(button.dataset.recordFilter);
  });
  async function load() {
    const legacy = JSON.parse(localStorage.getItem("markStats") || '{"bad":[]}');
    const missingIds = (Array.isArray(legacy.bad) ? legacy.bad : []).filter(id => !records.some(item => item.wordId === id && !item.isCorrect));
    if (missingIds.length) {
      try {
        const response = await fetch("words.json");
        const words = await response.json();
        missingIds.forEach(id => {
          const word = words.find(item => item.id === id);
          records.push({ id: `legacy-${id}`, time: "", type: "tone_mark", wordId: id, prompt: word?.word || `词条 ${id}`, answer: "历史错题", correctAnswer: word?.jyutping || "", isCorrect: false });
        });
      } catch (error) {}
    }
    render("all");
  }
  load();
})();
