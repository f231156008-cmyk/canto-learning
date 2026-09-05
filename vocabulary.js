const GROUP_SIZE = 5;
let allWords = [], groups = [], words = [], studyIndex = 0, challengeIndex = 0, challengeWords = [];
let remoteProgress = readLocalProgress();

function readLocalProgress() {
    try {
        const saved = JSON.parse(localStorage.getItem("cantoStandaloneProgress") || "{}");
        return new Map(Object.entries(saved).map(([wordId, status]) => [Number(wordId), status]));
    } catch { return new Map(); }
}

function routeKey() {
    return `${elements.categoryFilter.value || "all"}||${elements.levelFilter.value || "all"}`;
}

function readRouteSessions() {
    try { return JSON.parse(localStorage.getItem("cantoVocabularyRoutes") || "{}"); }
    catch { return {}; }
}

function saveRoutePosition(groupIndex, wordIndex = 0) {
    const sessions = readRouteSessions();
    sessions[routeKey()] = { groupIndex, wordIndex, updatedAt: Date.now() };
    localStorage.setItem("cantoVocabularyRoutes", JSON.stringify(sessions));
}

const elements = {};
["progress", "word", "jyutping", "example", "voiceSelect", "audioButton", "wordAudio", "previousButton", "continueButton", "message", "categoryFilter", "levelFilter", "groupFilter", "syncStatus", "progressSummary", "studyPanel", "challengePanel", "completePanel", "challengeType", "challengeWord", "challengeOptions", "challengeFeedback", "completeSummary", "nextGroupButton", "repeatGroupButton"].forEach(id => { elements[id] = document.getElementById(id); });

const savedVoice = localStorage.getItem("cantoVoice");
if (savedVoice === "female" || savedVoice === "male") elements.voiceSelect.value = savedVoice;

async function loadWords() {
    try {
        const response = await fetch("words.json");
        if (!response.ok) throw new Error();
        allWords = await response.json();
        if (!Array.isArray(allWords) || !allWords.length) throw new Error();
        populateFilters();
        buildGroups();
    } catch {
        elements.progress.textContent = "词库加载失败";
        elements.message.textContent = "请通过本地服务器打开网页，并检查 words.json。";
    }
}

function populateFilters() {
    const categories = [...new Set(allWords.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-HK"));
    const levelOrder = ["入门", "初级", "中级", "高级"];
    const levels = [...new Set(allWords.map(item => item.level).filter(Boolean))].sort((a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b));
    elements.categoryFilter.innerHTML = '<option value="">全部主题</option>' + categories.map(value => `<option value="${value}">${value}</option>`).join("");
    elements.levelFilter.innerHTML = '<option value="">全部难度</option>' + levels.map(value => `<option value="${value}">${value}</option>`).join("");
    const savedCategory = localStorage.getItem("cantoLearningCategory") || "";
    const savedLevel = localStorage.getItem("cantoLearningLevel") || "";
    if (categories.includes(savedCategory)) elements.categoryFilter.value = savedCategory;
    if (levels.includes(savedLevel)) elements.levelFilter.value = savedLevel;
}

function buildGroups() {
    const category = elements.categoryFilter.value;
    const level = elements.levelFilter.value;
    const filtered = allWords.filter(item => (!category || item.category === category) && (!level || item.level === level));
    const buckets = new Map();
    filtered.forEach(item => {
        const key = `${item.category}||${item.level}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
    });
    groups = [];
    [...buckets.values()].forEach(bucket => {
        for (let start = 0; start < bucket.length; start += GROUP_SIZE) {
            const items = bucket.slice(start, start + GROUP_SIZE);
            groups.push({ label: `${items[0].category} · ${items[0].level} · 第 ${start / GROUP_SIZE + 1} 关`, items });
        }
    });
    elements.groupFilter.innerHTML = groups.map((group, index) => `<option value="${index}">${group.label}（${group.items.length}词）</option>`).join("");
    localStorage.setItem("cantoLearningCategory", category);
    localStorage.setItem("cantoLearningLevel", level);
    if (!groups.length) {
        words = [];
        elements.progress.textContent = "当前路线没有可用关卡";
        return;
    }
    const saved = readRouteSessions()[routeKey()];
    const firstIncomplete = groups.findIndex(group => group.items.some(item => remoteProgress.get(item.id) !== "mastered"));
    const savedIndex = Number(saved?.groupIndex);
    const canResumeSaved = Number.isInteger(savedIndex) && groups[savedIndex]
        && groups[savedIndex].items.some(item => remoteProgress.get(item.id) !== "mastered");
    const resumeIndex = canResumeSaved ? savedIndex : firstIncomplete >= 0 ? firstIncomplete : Math.max(0, groups.length - 1);
    startGroup(resumeIndex, true);
}

function startGroup(groupIndex, resume = false) {
    const group = groups[groupIndex];
    if (!group) return;
    elements.groupFilter.value = String(groupIndex);
    words = group.items;
    const saved = readRouteSessions()[routeKey()];
    studyIndex = resume && Number(saved?.groupIndex) === groupIndex
        ? Math.min(Math.max(Number(saved.wordIndex) || 0, 0), words.length - 1)
        : 0;
    challengeIndex = 0;
    saveRoutePosition(groupIndex, studyIndex);
    showPhase("study");
    showStudyWord();
    renderGroupProgress();
}

function showPhase(phase) {
    elements.studyPanel.hidden = phase !== "study";
    elements.challengePanel.hidden = phase !== "challenge";
    elements.completePanel.hidden = phase !== "complete";
    document.querySelectorAll(".stage-map li").forEach((item, index) => {
        const activeUntil = phase === "study" ? 1 : phase === "challenge" ? 2 : 3;
        item.classList.toggle("active", index <= activeUntil);
    });
}

async function showStudyWord() {
    const item = words[studyIndex];
    const group = groups[Number(elements.groupFilter.value)];
    saveRoutePosition(Number(elements.groupFilter.value), studyIndex);
    elements.progress.textContent = `${group.label}｜学习 ${studyIndex + 1}/${words.length}`;
    elements.word.textContent = item.word;
    elements.jyutping.textContent = item.jyutping;
    elements.example.textContent = item.example;
    elements.message.textContent = "";
    elements.previousButton.disabled = studyIndex === 0;
    elements.continueButton.textContent = studyIndex === words.length - 1 ? "开始考察 →" : "下一词 →";
    const audioPath = `audio/${item.audio[elements.voiceSelect.value]}`;
    elements.wordAudio.src = audioPath;
    elements.audioButton.disabled = true;
    elements.audioButton.textContent = "检查音频中……";
    try {
        const response = await fetch(audioPath, { method: "HEAD" });
        if (!response.ok) throw new Error();
        elements.audioButton.disabled = false;
        elements.audioButton.textContent = "🔊 播放发音";
    } catch { elements.audioButton.textContent = "音频待补充"; }
}

function beginChallenge() {
    challengeWords = shuffle([...words]);
    challengeIndex = 0;
    showPhase("challenge");
    showChallenge();
}

function showChallenge() {
    const item = challengeWords[challengeIndex];
    elements.progress.textContent = `系统考察｜第 ${challengeIndex + 1}/${challengeWords.length} 题`;
    elements.challengeType.textContent = "选出正确粤拼";
    elements.challengeWord.textContent = item.word;
    elements.challengeFeedback.textContent = "";
    const pool = shuffle(allWords.filter(word => word.id !== item.id && word.jyutping && word.jyutping !== item.jyutping));
    pool.sort((a, b) => Number(b.category === item.category) - Number(a.category === item.category));
    const choices = shuffle([item.jyutping, ...pool.slice(0, 3).map(word => word.jyutping)]);
    elements.challengeOptions.replaceChildren(...choices.map(choice => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = choice;
        button.addEventListener("click", () => checkAnswer(button, choice, item));
        return button;
    }));
}

function checkAnswer(button, choice, item) {
    if (choice !== item.jyutping) {
        button.classList.add("wrong-answer");
        button.disabled = true;
        elements.challengeFeedback.textContent = "未答对，听完再试。";
        playChallengeAudio(item);
        return;
    }
    button.classList.add("correct-answer");
    elements.challengeOptions.querySelectorAll("button").forEach(option => { option.disabled = true; });
    elements.challengeFeedback.textContent = "答对了。";
    playChallengeAudio(item, () => {
        challengeIndex += 1;
        if (challengeIndex < challengeWords.length) showChallenge();
        else finishGroup();
    });
}

function playChallengeAudio(item, afterPlayback) {
    const audioPath = `audio/${item.audio[elements.voiceSelect.value]}`;
    let finished = false;
    const finishOnce = () => {
        if (finished) return;
        finished = true;
        elements.wordAudio.onended = null;
        if (afterPlayback) afterPlayback();
    };
    elements.wordAudio.src = audioPath;
    elements.wordAudio.currentTime = 0;
    elements.wordAudio.onended = finishOnce;
    elements.wordAudio.play().catch(() => window.setTimeout(finishOnce, 500));
    if (afterPlayback) window.setTimeout(finishOnce, 3500);
}

async function finishGroup() {
    showPhase("complete");
    const group = groups[Number(elements.groupFilter.value)];
    elements.progress.textContent = `${group.label}｜闯关完成`;
    elements.completeSummary.textContent = `本组 ${words.length} 个词已全部通过系统考察。`;
    elements.nextGroupButton.hidden = Number(elements.groupFilter.value) >= groups.length - 1;
    words.forEach(item => remoteProgress.set(item.id, "mastered"));
    const savedProgress = JSON.parse(localStorage.getItem("cantoStandaloneProgress") || "{}");
    words.forEach(item => { savedProgress[item.id] = "mastered"; });
    localStorage.setItem("cantoStandaloneProgress", JSON.stringify(savedProgress));
    saveRoutePosition(Math.min(Number(elements.groupFilter.value) + 1, groups.length - 1), 0);
    window.cantoCloud?.queueSync?.();
    renderGroupProgress();
    try {
        const responses = await Promise.all(words.map(item => fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wordId: item.id, status: "mastered" }) })));
        elements.syncStatus.textContent = responses.every(response => response.ok) ? "本关成绩已保存" : "已完成本关；登录后可跨设备保存成绩。";
    } catch { elements.syncStatus.textContent = "已完成本关；云端成绩稍后再同步。"; }
}

function renderGroupProgress() {
    if (!words.length) return;
    const completed = words.filter(item => remoteProgress.get(item.id) === "mastered").length;
    elements.progressSummary.textContent = `本关记录：${completed}/${words.length} 个词已通过`;
}

async function loadProgress() {
    try {
        const response = await fetch("/api/progress");
        const data = await response.json();
        if (response.status === 401) {
            elements.syncStatus.innerHTML = `登录后可跨设备保存闯关记录：<a href="${data.signIn}">使用 ChatGPT 登录</a>`;
            return;
        }
        if (!response.ok) throw new Error();
        remoteProgress = new Map(data.progress.map(item => [item.wordId, item.status]));
        elements.syncStatus.textContent = "闯关记录已连接云端";
        renderGroupProgress();
    } catch { elements.syncStatus.textContent = "云端记录暂时无法连接，仍可继续闯关。"; }
}

function shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
}

elements.previousButton.addEventListener("click", () => { if (studyIndex > 0) { studyIndex -= 1; showStudyWord(); } });
elements.continueButton.addEventListener("click", () => { if (studyIndex < words.length - 1) { studyIndex += 1; showStudyWord(); } else beginChallenge(); });
elements.audioButton.addEventListener("click", () => { elements.wordAudio.currentTime = 0; elements.wordAudio.play().catch(() => { elements.message.textContent = "音频无法播放，请稍后重试。"; }); });
elements.voiceSelect.addEventListener("change", () => { localStorage.setItem("cantoVoice", elements.voiceSelect.value); showStudyWord(); });
elements.categoryFilter.addEventListener("change", buildGroups);
elements.levelFilter.addEventListener("change", buildGroups);
elements.groupFilter.addEventListener("change", () => startGroup(Number(elements.groupFilter.value), false));
elements.nextGroupButton.addEventListener("click", () => startGroup(Number(elements.groupFilter.value) + 1));
elements.repeatGroupButton.addEventListener("click", () => startGroup(Number(elements.groupFilter.value)));

loadWords();
loadProgress();
