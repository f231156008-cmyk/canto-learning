let words = [];

const categorySelect = document.getElementById("categorySelect");
const difficultySelect = document.getElementById("difficultySelect");
const voiceSelect = document.getElementById("voiceSelect");
const count = document.getElementById("count");
const message = document.getElementById("message");
const wordList = document.getElementById("wordList");
const wordAudio = document.getElementById("wordAudio");

const savedVoice = localStorage.getItem("cantoVoice");
if (savedVoice === "female" || savedVoice === "male") {
    voiceSelect.value = savedVoice;
}

function difficultyName(value) {
    return { 1: "入门", 2: "初级", 3: "中级" }[value] || `等级 ${value}`;
}

function createLine(label, value) {
    if (value === undefined || value === null || value === "") return null;
    const paragraph = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}：`;
    paragraph.append(strong, document.createTextNode(value));
    return paragraph;
}

function createAudioButton(label, file, kind) {
    if (!file) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `🔊 ${label}`;
    button.dataset.audioFile = file;
    button.dataset.audioKind = kind;
    return button;
}

function renderWords() {
    const category = categorySelect.value;
    const difficulty = difficultySelect.value;
    const filtered = words.filter(function(word) {
        const categoryMatches = category === "all" || word.category === category;
        const difficultyMatches = difficulty === "all" || String(word.difficulty) === difficulty;
        return categoryMatches && difficultyMatches;
    });

    count.textContent = `显示 ${filtered.length} 个词，共 ${words.length} 个词`;
    wordList.replaceChildren();

    filtered.forEach(function(word) {
        const article = document.createElement("article");
        const title = document.createElement("h2");
        title.textContent = word.word;
        const lines = [
            title,
            createLine("粤拼", word.jyutping),
            createLine("普通话含义", word.meaning),
            createLine("主题", word.category),
            createLine("难度", word.level || difficultyName(word.difficulty)),
            createLine("例句", word.example),
            createLine("例句粤拼", word.sentenceJyutping),
            createLine("例句普通话", word.translation),
            createLine("读音说明", word.pronunciationNote)
        ].filter(Boolean);
        article.append(...lines);

        const actions = document.createElement("div");
        actions.className = "wordlist-audio-actions";
        const voice = voiceSelect.value;
        const audioButtons = [
            createAudioButton("播放单词", word.audio?.[voice], "单词"),
            createAudioButton("播放例句", word.sentenceAudio?.[voice], "例句")
        ].filter(Boolean);
        actions.append(...audioButtons);
        article.append(actions);

        if (Array.isArray(word.exampleChoices) && word.exampleChoices.length) {
            const details = document.createElement("details");
            const summary = document.createElement("summary");
            summary.textContent = `更多例句（${word.exampleChoices.length}）`;
            details.append(summary);
            word.exampleChoices.forEach(choice => {
                const example = document.createElement("div");
                example.className = "wordlist-example-choice";
                [
                    createLine(choice.type || "例句", choice.example),
                    createLine("粤拼", choice.sentenceJyutping),
                    createLine("普通话", choice.translation),
                ].filter(Boolean).forEach(line => example.append(line));
                details.append(example);
            });
            article.append(details);
        }
        wordList.append(article);
    });
}

async function loadWords() {
    try {
        const response = await fetch("data/words.json");
        if (!response.ok) throw new Error("词库读取失败");
        words = await response.json();

        const categories = [...new Set(words.map(word => word.category))].sort();
        categories.forEach(function(category) {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            categorySelect.append(option);
        });
        renderWords();
    } catch (error) {
        count.textContent = "词库加载失败";
        message.textContent = "请刷新页面后重试。";
    }
}

categorySelect.addEventListener("change", renderWords);
difficultySelect.addEventListener("change", renderWords);
voiceSelect.addEventListener("change", function() {
    localStorage.setItem("cantoVoice", voiceSelect.value);
    renderWords();
});

wordList.addEventListener("click", function(event) {
    const button = event.target.closest("button[data-audio-file]");
    if (!button) return;
    message.textContent = `正在播放${button.dataset.audioKind}。`;
    wordAudio.src = `audio/${button.dataset.audioFile}`;
    wordAudio.currentTime = 0;
    wordAudio.play().catch(function() {
        message.textContent = "音频暂时无法播放，请稍后重试。";
    });
});

loadWords();
