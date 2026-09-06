(async function () {
  const byId = id => document.getElementById(id);
  const shuffle = items => { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };
  const response = await fetch("words.json");
  const words = await response.json();
  const byWordId = new Map(words.map(item => [Number(item.id), item]));
  const previewMode = new URLSearchParams(location.search).has("preview");
  let queue = previewMode ? words.slice(0, 3) : window.cantoSrs.due().map(item => byWordId.get(Number(item.wordId))).filter(Boolean).slice(0, 20);
  let index = 0, correctCount = 0, answered = false;
  const initialTotal = queue.length;
  const player = byId("reviewPlayer");

  function audio(item) {
    const voice = localStorage.getItem("cantoVoice") === "male" ? "male" : "female";
    const file = typeof item.audio === "string" ? item.audio : item.audio?.[voice] || item.audio?.female;
    if (!file) return;
    player.src = file.startsWith("audio/") ? file : `audio/${file}`;
    player.currentTime = 0;
    player.play().catch(() => {});
  }

  function related(item, field) {
    const same = words.filter(word => word.id !== item.id && word[field] && word.category === item.category && word.word.length === item.word.length);
    const fallback = words.filter(word => word.id !== item.id && word[field]);
    return shuffle((same.length >= 3 ? same : fallback).slice()).slice(0, 3).map(word => word[field]);
  }

  function plainJyutping(value) { return value.toLowerCase().replace(/[1-6]/g, "").replace(/\s+/g, " ").trim(); }
  function toneVariant(value, offset) { return value.split(/\s+/).map((part, i) => part.replace(/[1-6]$/, tone => String(((Number(tone) - 1 + offset + i) % 6) + 1))).join(" "); }
  function finish() { byId("reviewSession").hidden = true; byId("reviewEmpty").hidden = false; }

  function render() {
    if (index >= queue.length) return finish();
    answered = false;
    const item = queue[index], mode = index % 4;
    byId("reviewCount").textContent = `${Math.min(index + 1, initialTotal)} / ${initialTotal}`;
    byId("reviewScore").textContent = `${correctCount} 答对`;
    byId("reviewFeedback").innerHTML = "";
    byId("reviewWord").textContent = mode === 1 ? "" : item.word;
    byId("reviewJyutping").textContent = "";
    byId("reviewAudio").hidden = mode !== 1;
    byId("reviewAudio").onclick = () => audio(item);
    byId("reviewOptions").innerHTML = "";
    byId("reviewForm").hidden = mode !== 2;
    if (mode === 0) { byId("reviewType").textContent = "选择粤拼"; choices(item, item.jyutping, shuffle([item.jyutping, ...related(item, "jyutping")])); }
    else if (mode === 1) { byId("reviewType").textContent = "听音选词"; choices(item, item.word, shuffle([item.word, ...related(item, "word")])); audio(item); }
    else if (mode === 2) { byId("reviewType").textContent = "输入粤拼（不用声调）"; byId("reviewInput").value = ""; byId("reviewInput").focus(); }
    else { byId("reviewType").textContent = `选择声调 · ${plainJyutping(item.jyutping)}`; choices(item, item.jyutping, shuffle([item.jyutping, toneVariant(item.jyutping, 1), toneVariant(item.jyutping, 2), toneVariant(item.jyutping, 4)])); }
  }

  function choices(item, wanted, options) {
    options.forEach(value => { const button = document.createElement("button"); button.type = "button"; button.textContent = value; button.onclick = () => answer(item, value, wanted, value === wanted); byId("reviewOptions").appendChild(button); });
  }

  function answer(item, value, wanted, correct) {
    if (answered) return;
    answered = true;
    if (correct) correctCount += 1; else if (!item._retried) { item._retried = true; queue.push(item); }
    if (!previewMode) window.cantoRecordAttempt({ type: "srs_review", wordId: item.id, prompt: item.word, answer: value, correctAnswer: wanted, isCorrect: correct });
    audio(item);
    byId("reviewOptions").querySelectorAll("button").forEach(button => { button.disabled = true; if (button.textContent === wanted) button.classList.add("correct-answer"); });
    byId("reviewFeedback").innerHTML = `<strong>${correct ? "正确" : `答案：${wanted}`}</strong><span>${item.meaning || ""}</span><p>${item.example || ""}</p><button type="button" id="reviewReplay">重新播放</button>`;
    byId("reviewReplay").onclick = () => audio(item);
    window.setTimeout(() => { index += 1; render(); }, correct ? 950 : 1800);
  }

  byId("reviewForm").onsubmit = event => { event.preventDefault(); if (answered) return; const item = queue[index], value = byId("reviewInput").value.trim(); answer(item, value, item.jyutping, plainJyutping(value) === plainJyutping(item.jyutping)); };
  render();
})();
