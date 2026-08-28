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
    const paragraph = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}：`;
    paragraph.append(strong, document.createTextNode(value));
    return paragraph;
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
        article.append(
            title,
            createLine("粤拼", word.jyutping),
            createLine("主题", word.category),
            createLine("难度", word.level || difficultyName(word.difficulty)),
            createLine("例句", word.example)
        );

        const playButton = document.createElement("button");
        playButton.type = "button";
        playButton.textContent = "🔊 播放发音";
        playButton.dataset.wordId = String(word.id);
        article.append(playButton, document.createElement("hr"));
        wordList.append(article);
    });
}

async function loadWords() {
    try {
        const response = await fetch("words.json");
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
});

wordList.addEventListener("click", function(event) {
    const button = event.target.closest("button[data-word-id]");
    if (!button) return;
    const word = words.find(item => String(item.id) === button.dataset.wordId);
    if (!word) return;
    wordAudio.src = `audio/${word.audio[voiceSelect.value]}`;
    wordAudio.currentTime = 0;
    wordAudio.play().catch(function() {
        message.textContent = "音频暂时无法播放，请稍后重试。";
    });
});

loadWords();
