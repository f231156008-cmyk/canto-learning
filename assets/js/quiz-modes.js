const modeWords = [];
let selectedMode = "tone";
let generatedQuestion = null;
let generatedAnswered = false;
let orderedTokens = [];

const modeInfo = {
    order: ["句子排序", "根据意思依次点击字词，组成自然的香港粤语例句。"]
};

function shuffled(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

function randomWord(pool = modeWords) {
    return pool[Math.floor(Math.random() * pool.length)];
}

function uniqueOptions(correct, getter, pool = modeWords) {
    const values = new Set([correct]);
    for (const item of shuffled(pool)) {
        values.add(getter(item));
        if (values.size === 4) break;
    }
    return shuffled([...values]);
}

function setGeneratedText(title, instruction, prompt) {
    document.getElementById("generatedTitle").textContent = title;
    document.getElementById("generatedInstruction").textContent = instruction;
    document.getElementById("generatedPrompt").textContent = prompt;
    document.getElementById("generatedResult").textContent = "";
    document.getElementById("generatedSaveStatus").textContent = "";
    document.getElementById("generatedAudio").hidden = true;
    document.getElementById("orderAnswer").hidden = true;
    document.getElementById("orderProgress").hidden = true;
    document.getElementById("orderControls").hidden = true;
    document.getElementById("generatedOptions").innerHTML = "";
}

function newGeneratedQuestion() {
    if (!modeWords.length || !modeInfo[selectedMode]) return;
    generatedAnswered = false;
    orderedTokens = [];
    const [title, instruction] = modeInfo[selectedMode];

    if (selectedMode === "order") {
        const pool = modeWords.filter(w => w.example && w.example.length >= 5 && w.example.length <= 14 && w.sentenceAudio && w.sentenceAudio.female);
        generatedQuestion = randomWord(pool);
        setGeneratedText(title, instruction, generatedQuestion.translation || generatedQuestion.sentenceEnglish);
        document.getElementById("orderAnswer").hidden = false;
        document.getElementById("orderProgress").hidden = false;
        document.getElementById("orderControls").hidden = false;
        const tokens = Array.from(generatedQuestion.example).map((text, id) => ({ text, id }));
        document.getElementById("generatedOptions").innerHTML = shuffled(tokens).map(t => `<button data-token-id="${t.id}" data-token="${t.text}">${t.text}</button>`).join("");
        updateOrderDisplay();
    }
}

function renderOptionButtons(options) {
    document.getElementById("generatedOptions").innerHTML = options.map(value => `<button data-generated-answer="${value}">${value}</button>`).join("");
}

function correctGeneratedAnswer() {
    return generatedQuestion.example;
}

function updateOrderDisplay() {
    const total = generatedQuestion ? Array.from(generatedQuestion.example).length : 0;
    document.getElementById("orderAnswer").textContent = orderedTokens.map(item => item.text).join("") || "点击下方字词开始排列";
    document.getElementById("orderProgress").textContent = `已排列 ${orderedTokens.length} / ${total}`;
    document.getElementById("orderUndo").disabled = !orderedTokens.length || generatedAnswered;
}

function playSentenceAudio() {
    const file = generatedQuestion && generatedQuestion.sentenceAudio && generatedQuestion.sentenceAudio.female;
    if (!file) {
        document.getElementById("generatedResult").textContent = "这条例句的音频稍后补充。";
        return;
    }
    new Audio(file.startsWith("audio/") ? file : `audio/${file}`).play();
}

async function recordGeneratedAnswer(answer, correct) {
    const wanted = correctGeneratedAnswer();
    const ok = answer === wanted;
    document.getElementById("generatedResult").innerHTML = ok
        ? `✓ 正确<br>${generatedQuestion.sentenceJyutping || ""}<br>${generatedQuestion.translation || generatedQuestion.sentenceEnglish || ""}`
        : `✗ 正确答案：${wanted}<br>${generatedQuestion.sentenceJyutping || ""}`;
    document.querySelectorAll("#generatedOptions button").forEach(button => button.disabled = true);
    const attempts = JSON.parse(localStorage.getItem("cantoStandaloneQuiz") || "[]");
    attempts.push({ quizType: selectedMode, wordId: generatedQuestion.id, prompt: generatedQuestion.word, answer, correctAnswer: wanted, isCorrect: ok, at: Date.now() });
    localStorage.setItem("cantoStandaloneQuiz", JSON.stringify(attempts.slice(-200)));
    document.getElementById("generatedSaveStatus").textContent = "本题记录已保存在此浏览器。";
    generatedAnswered = true;
}

document.getElementById("modeSelector").addEventListener("click", event => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    selectedMode = button.dataset.mode;
    document.querySelectorAll("#modeSelector button").forEach(b => b.classList.toggle("active", b === button));
    document.getElementById("fullMode").hidden = selectedMode !== "full";
    document.getElementById("toneMode").hidden = selectedMode !== "tone";
    document.getElementById("generatedMode").hidden = !modeInfo[selectedMode];
    if (selectedMode === "tone") showToneMarkQuestion();
    if (modeInfo[selectedMode]) newGeneratedQuestion();
});

document.getElementById("generatedOptions").addEventListener("click", event => {
    if (generatedAnswered) return;
    const answerButton = event.target.closest("[data-generated-answer]");
    if (answerButton) return recordGeneratedAnswer(answerButton.dataset.generatedAnswer);
    const tokenButton = event.target.closest("[data-token-id]");
    if (!tokenButton) return;
    orderedTokens.push({ id: tokenButton.dataset.tokenId, text: tokenButton.dataset.token });
    tokenButton.disabled = true;
    updateOrderDisplay();
    if (orderedTokens.length === Array.from(generatedQuestion.example).length) recordGeneratedAnswer(orderedTokens.map(item => item.text).join(""));
});

document.getElementById("orderUndo").addEventListener("click", () => {
    const last = orderedTokens.pop();
    if (last) document.querySelector(`[data-token-id="${last.id}"]`).disabled = false;
    updateOrderDisplay();
});
document.getElementById("orderReset").addEventListener("click", () => {
    if (generatedAnswered) return newGeneratedQuestion();
    orderedTokens = [];
    document.querySelectorAll("[data-token-id]").forEach(button => button.disabled = false);
    updateOrderDisplay();
});
document.getElementById("orderAudio").addEventListener("click", playSentenceAudio);

document.getElementById("generatedAudio").addEventListener("click", () => {
    const player = new Audio(`audio/${generatedQuestion.audio.female}`);
    player.play();
});
document.getElementById("generatedNext").addEventListener("click", newGeneratedQuestion);

fetch("data/words.json").then(response => response.json()).then(data => {
    modeWords.push(...data.filter(w => w.word && w.jyutping));
    showToneMarkQuestion();
}).catch(() => {
    document.getElementById("generatedResult").textContent = "词库暂时无法载入。";
});
