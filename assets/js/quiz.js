// ========================================
// 粤语发音 Quiz
// ========================================


// 保存整个词库
let allQuizWords = [];
let words = [];


// 保存当前题目
let currentQuestion = null;
let currentAnswered = false;


// 记录上一题
let previousIndex = -1;
let typingBlank = null;


// 保存发音声音偏好
const voiceSelect =
    document.getElementById("voiceSelect");

const savedVoice =
    localStorage.getItem("cantoVoice");

if (
    savedVoice === "female"
    || savedVoice === "male"
) {
    voiceSelect.value = savedVoice;
}

voiceSelect.addEventListener(
    "change",
    function() {
        localStorage.setItem(
            "cantoVoice",
            voiceSelect.value
        );

        if (
            currentQuestion
            && document
                .getElementById("analysis")
                .innerHTML
                .trim() !== ""
        ) {
            showAnalysis(
                document
                    .getElementById("answerInput")
                    .value
                    .trim()
            );
        }
    }
);


// ========================================
// 1. 读取 words.json
// ========================================

async function loadWords() {

    try {

        const response =
            await fetch("data/words.json");


        // 检查 JSON 是否成功读取
        if (!response.ok) {

            throw new Error(
                "无法读取 words.json"
            );

        }


        // JSON → JavaScript Array
        allQuizWords =
            await response.json();

        populateQuizFilters();
        applyQuizFilters(false);


        console.log(
            "词库读取成功：",
            words
        );


        // 检查词库
        if (words.length === 0) {

            document
                .getElementById("word")
                .textContent =
                "词库为空";

            return;

        }


        // 开始第一题
        showRandomQuestion();
        showToneMarkQuestion();


    } catch (error) {

        console.error(
            "读取词库失败：",
            error
        );


        document
            .getElementById("word")
            .textContent =
            "词库读取失败";


        document
            .getElementById("result")
            .textContent =
            "请检查 words.json 和 Live Server。";

    }

}



// ========================================
// 2. 随机抽取一道题
// ========================================

function showRandomQuestion() {


    if (words.length === 0) {

        return;

    }


    let randomIndex;


    // 如果词库只有一个词
    if (words.length === 1) {

        randomIndex = 0;

    } else {

        // 避免连续两题完全一样
        do {

            randomIndex =
                Math.floor(
                    Math.random()
                    * words.length
                );

        } while (
            randomIndex === previousIndex
        );

    }


    previousIndex =
        randomIndex;


    // 保存当前题目
    currentQuestion =
        words[randomIndex];
    currentAnswered = false;

    const typingSyllables = currentQuestion.jyutping.trim().split(/\s+/);
    const blankIndex = Math.floor(Math.random() * typingSyllables.length);
    const blankMatch = typingSyllables[blankIndex].match(/^(.+?)([1-6])$/);
    typingBlank = {
        base: blankMatch ? blankMatch[1] : typingSyllables[blankIndex].replace(/[1-6]/g, ""),
        tone: blankMatch ? blankMatch[2] : ""
    };
    document.getElementById("typingClue").textContent = typingSyllables
        .map((syllable, index) => index === blankIndex ? `＿＿${typingBlank.tone}` : syllable)
        .join(" ");


    console.log(
        "当前题目：",
        currentQuestion
    );


    // 显示粤语词
    document
        .getElementById("word")
        .textContent =
        currentQuestion.word;


    // 清空输入框
    document
        .getElementById("answerInput")
        .value =
        "";


    // 清空结果
    document
        .getElementById("result")
        .textContent =
        "";


    // 清空上一题解析
    document
        .getElementById("analysis")
        .innerHTML =
        "";


    // 自动把光标放进输入框
    document
        .getElementById("answerInput")
        .focus();

}



// ========================================
// 3. 检查用户答案
// ========================================

function checkAnswer() {


    // 如果还没有题目
    if (!currentQuestion) {

        return;

    }

    if (currentAnswered) {
        return;
    }


    // 获取用户输入
    const userAnswer =
        document
            .getElementById("answerInput")
            .value
            .trim()
            .toLowerCase();


    // 获取标准答案
    const correctAnswer =
        currentQuestion
            .jyutping
            .trim()
            .toLowerCase();

    // 本题只考察粤拼字母和音节顺序，不计算声调数字。
    const normalizeWithoutTone = value => value
        .replace(/[1-6]/g, "")
        .replace(/[^a-z]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");


    // 用户没有输入
    if (userAnswer === "") {

        document
            .getElementById("result")
            .textContent =
            "请先输入答案。";

        return;

    }


    // 判断正确与否
    const isCorrect = normalizeWithoutTone(userAnswer) === normalizeWithoutTone(typingBlank.base);
    currentAnswered = true;

    if (isCorrect) {

        document
            .getElementById("result")
            .textContent =
            "✓ 正确";

    } else {

        document
            .getElementById("result")
            .textContent =
            "✗ 不正确";

    }


    // 无论正确还是错误
    // 都显示完整解析

    showAnalysis(userAnswer);
    saveQuizAttempt(userAnswer, `${typingBlank.base}${typingBlank.tone}`, isCorrect);

}

function populateQuizFilters() {
    const categorySelect = document.getElementById("quizCategoryFilter");
    const levelSelect = document.getElementById("quizLevelFilter");
    const categories = [...new Set(allQuizWords.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-HK"));
    const order = ["入门", "初级", "中级", "高级"];
    const levels = [...new Set(allQuizWords.map(item => item.level).filter(Boolean))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    categorySelect.innerHTML = '<option value="">全部主题</option>' + categories.map(value => `<option value="${value}">${value}</option>`).join("");
    levelSelect.innerHTML = '<option value="">全部难度</option>' + levels.map(value => `<option value="${value}">${value}</option>`).join("");
    const savedCategory = localStorage.getItem("cantoQuizCategory") || "";
    const savedLevel = localStorage.getItem("cantoQuizLevel") || "";
    if (categories.includes(savedCategory)) categorySelect.value = savedCategory;
    if (levels.includes(savedLevel)) levelSelect.value = savedLevel;
    categorySelect.addEventListener("change", () => applyQuizFilters(true));
    levelSelect.addEventListener("change", () => applyQuizFilters(true));
}

function applyQuizFilters(refresh = true) {
    const category = document.getElementById("quizCategoryFilter").value;
    const level = document.getElementById("quizLevelFilter").value;
    words = allQuizWords.filter(item => (!category || item.category === category) && (!level || item.level === level));
    localStorage.setItem("cantoQuizCategory", category);
    localStorage.setItem("cantoQuizLevel", level);
    document.getElementById("quizRouteStatus").textContent = `${category || "全部主题"} · ${level || "全部难度"}｜${words.length} 个词`;
    previousIndex = -1;
    if (!words.length) {
        document.getElementById("word").textContent = "这条路线暂时没有题目";
        document.getElementById("toneMarkWord").textContent = "这条路线暂时没有题目";
        return;
    }
    if (!refresh) return;
    const activeMode = document.querySelector("#modeSelector button.active")?.dataset.mode;
    if (activeMode === "tone") showToneMarkQuestion();
    else showRandomQuestion();
}

async function saveQuizAttempt(userAnswer, correctAnswer, isCorrect) {
    const status = document.getElementById("saveStatus");
    saveStandaloneAttempt({ quizType: "jyutping_typing_no_tone", wordId: currentQuestion.id, prompt: currentQuestion.word, answer: userAnswer, correctAnswer, isCorrect });
    status.textContent = "本次答题已保存在此浏览器。";
}

function saveStandaloneAttempt(attempt) {
    const attempts = JSON.parse(localStorage.getItem("cantoStandaloneQuiz") || "[]");
    attempts.push({ ...attempt, at: Date.now() });
    localStorage.setItem("cantoStandaloneQuiz", JSON.stringify(attempts.slice(-200)));
}



// ========================================
// 4. 显示答案解析
// ========================================

function showAnalysis(
    userAnswer
) {


    const analysis =
        document
            .getElementById("analysis");


    analysis.innerHTML = `

        <hr>


        <h2>
            ${currentQuestion.word}
        </h2>


        <p>

            <strong>
                你的答案：
            </strong>

            ${userAnswer}

        </p>


        <p>

            <strong>
                正确粤拼：
            </strong>

            ${currentQuestion.jyutping}

        </p>


        <p>

            <strong>
                粤语例句：
            </strong>

            ${currentQuestion.example}

        </p>


        <button id="audioButton" type="button">

            🔊 重新播放

        </button>


        <audio id="wordAudio">

            <source
                src="audio/${currentQuestion.audio[voiceSelect.value]}"
                type="audio/mpeg"
            >

        </audio>

    `;


    // 给刚刚生成的播放按钮添加功能

    const audioButton =
        document.getElementById("audioButton");

    const audioSource =
        `audio/${currentQuestion.audio[voiceSelect.value]}`;

    audioButton.addEventListener("click", playAudio);
    playAudio();

    fetch(audioSource, { method: "HEAD" })
        .then(function(response) {
            if (!response.ok) {
                throw new Error("音频不存在");
            }
        })
        .catch(function() {
            audioButton.disabled = true;
            audioButton.textContent = "音频待补充";
        });

}



// ========================================
// 5. 播放 MP3
// ========================================

function playAudio() {


    const audio =
        document
            .getElementById("wordAudio");


    // 每次点击都从头播放
    audio.currentTime = 0;


    audio
        .play()
        .catch(function(error) {

            console.error(
                "音频播放失败：",
                error
            );

            alert(
                "音频无法播放，请检查 MP3 文件名和 audio 文件夹。"
            );

        });

}



// ========================================
// 6. 提交按钮
// ========================================

document
    .getElementById("submitButton")
    .addEventListener(
        "click",
        checkAnswer
    );



// ========================================
// 7. 下一题按钮
// ========================================

document
    .getElementById("nextButton")
    .addEventListener(
        "click",
        showRandomQuestion
    );



// ========================================
// 8. 按 Enter 提交
// ========================================

document
    .getElementById("answerInput")
    .addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter"
            ) {

                checkAnswer();

            }

        }
    );



// ========================================
// 9. 页面打开时加载词库
// ========================================

loadWords();

let toneMarkQuestion = null;
let toneMarkAnswered = false;
let toneMarkStats = JSON.parse(localStorage.getItem("markStats") || '{"right":0,"total":0,"bad":[]}');
const toneMarkAudio = new Audio();

const toneNames = {
    1: "高平",
    2: "高升",
    3: "中平",
    4: "低降",
    5: "低升",
    6: "低平"
};

function toneParts(jyutping) {
    return jyutping.split(/\s+/).map(syllable => ({ base: syllable.slice(0, -1), tone: Number(syllable.at(-1)) }));
}

function showToneMarkStats() {
    document.getElementById("toneMarkStats").textContent = `答对 ${toneMarkStats.right} / ${toneMarkStats.total} · 错题 ${toneMarkStats.bad.length}`;
}

function showToneMarkQuestion(retry = false) {
    if (!words.length) return;
    const retryPool = retry && toneMarkStats.bad.length ? words.filter(w => toneMarkStats.bad.includes(w.id)) : [];
    const pool = retryPool.length ? retryPool : words;
    toneMarkQuestion = pool[Math.floor(Math.random() * pool.length)];
    toneMarkAnswered = false;
    document.getElementById("toneMarkWord").textContent = toneMarkQuestion.word;
    document.getElementById("toneMarkClue").textContent = [
        toneMarkQuestion.meaning ? `本题词义：${toneMarkQuestion.meaning}` : "",
        toneMarkQuestion.example ? `例句：${toneMarkQuestion.example}` : "",
        toneMarkQuestion.pronunciationNote || ""
    ].filter(Boolean).join("\n");
    document.getElementById("toneMarkInputs").innerHTML = toneParts(toneMarkQuestion.jyutping).map((part, i) => `<label class="mark">${part.base}<select data-tone-mark="${i}"><option value="">声调</option>${[1,2,3,4,5,6].map(n => `<option>${n}</option>`).join("")}</select></label>`).join("");
    document.getElementById("toneMarkResult").textContent = "";
    document.getElementById("toneMarkSaveStatus").textContent = "";
    document.getElementById("toneMarkReplay").hidden = true;
    document.getElementById("checkToneMark").disabled = false;
    toneMarkAudio.pause();
    showToneMarkStats();
}

async function checkToneMarkAnswer() {
    if (!toneMarkQuestion || toneMarkAnswered) return;
    const selected = [...document.querySelectorAll("[data-tone-mark]")].map(x => Number(x.value));
    const parts = toneParts(toneMarkQuestion.jyutping);
    const wanted = parts.map(x => x.tone);
    if (selected.some(x => !x)) {
        document.getElementById("toneMarkResult").textContent = "请先选完所有声调。";
        return;
    }
    toneMarkAnswered = true;
    document.getElementById("checkToneMark").disabled = true;
    document.querySelectorAll("[data-tone-mark]").forEach(input => { input.disabled = true; });
    const correct = wanted.every((x, i) => x === selected[i]);
    toneMarkStats.total++;
    if (correct) {
        toneMarkStats.right++;
        toneMarkStats.bad = toneMarkStats.bad.filter(id => id !== toneMarkQuestion.id);
    } else if (!toneMarkStats.bad.includes(toneMarkQuestion.id)) {
        toneMarkStats.bad.push(toneMarkQuestion.id);
    }
    localStorage.setItem("markStats", JSON.stringify(toneMarkStats));
    const explanation = parts.map((part, index) => {
        if (selected[index] === part.tone) {
            return `${part.base}${part.tone}：答对，${part.tone} 声（${toneNames[part.tone]}）`;
        }
        return `${part.base}：你选 ${selected[index]} 声（${toneNames[selected[index]]}），正确是 ${part.tone} 声（${toneNames[part.tone]}）`;
    }).join("\n");
    const meaning = toneMarkQuestion.meaning ? `词义：${toneMarkQuestion.meaning}` : "";
    const example = toneMarkQuestion.example ? `例句：${toneMarkQuestion.example}` : "";
    const pronunciationNote = toneMarkQuestion.pronunciationNote || "";
    document.getElementById("toneMarkResult").textContent = [
        correct ? "✓ 正确" : `✗ 正确答案：${toneMarkQuestion.jyutping}`,
        explanation,
        meaning,
        example,
        pronunciationNote
    ].filter(Boolean).join("\n");
    playToneMarkAudio();
    document.getElementById("toneMarkReplay").hidden = false;
    showToneMarkStats();
    saveStandaloneAttempt({ quizType: "tone_mark", wordId: toneMarkQuestion.id, prompt: toneMarkQuestion.word, answer: selected.join("-"), correctAnswer: wanted.join("-"), isCorrect: correct });
    document.getElementById("toneMarkSaveStatus").textContent = "本题记录已保存在此浏览器。";
}

function playToneMarkAudio() {
    if (!toneMarkQuestion || !toneMarkQuestion.audio) return;
    toneMarkAudio.src = `audio/${toneMarkQuestion.audio[voiceSelect.value]}`;
    toneMarkAudio.currentTime = 0;
    toneMarkAudio.play().catch(() => {
        document.getElementById("toneMarkSaveStatus").textContent = "录音暂时无法播放。";
    });
}

document.getElementById("checkToneMark").addEventListener("click", checkToneMarkAnswer);
document.getElementById("toneMarkReplay").addEventListener("click", playToneMarkAudio);
document.getElementById("newToneMark").addEventListener("click", () => showToneMarkQuestion());
document.getElementById("retryToneMark").addEventListener("click", () => showToneMarkQuestion(true));
