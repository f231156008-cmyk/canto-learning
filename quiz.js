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
let automaticAdvanceTimer = null;
let questionVersion = 0;

function cancelAutomaticAdvance() {
    if (automaticAdvanceTimer) window.clearTimeout(automaticAdvanceTimer);
    automaticAdvanceTimer = null;
}

function scheduleAutomaticAdvance(callback, delay) {
    cancelAutomaticAdvance();
    automaticAdvanceTimer = window.setTimeout(callback, delay);
}

function animateQuestion(id) {
    document.getElementById(id)?.animate?.([
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" }
    ], { duration: 180, easing: "ease-out" });
}


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
            await fetch("words.json");


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
    cancelAutomaticAdvance();
    questionVersion += 1;


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
    document.getElementById("nextButton").hidden = true;
    document.getElementById("submitButton").disabled = false;
    document.getElementById("answerInput").disabled = false;

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

    animateQuestion("fullMode");

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
    document.getElementById("submitButton").disabled = true;
    document.getElementById("answerInput").disabled = true;
    document.getElementById("nextButton").hidden = false;

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

    showAnalysis(userAnswer, isCorrect, questionVersion);
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
    window.cantoRecordAttempt?.({ type: "jyutping_typing_no_tone", wordId: currentQuestion.id, prompt: currentQuestion.word, answer: userAnswer, correctAnswer, isCorrect });
    try {
        const response = await fetch("/api/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "quiz_attempt", quizType: "jyutping_typing_no_tone", wordId: currentQuestion.id, prompt: currentQuestion.word, answer: userAnswer, correctAnswer, isCorrect })
        });
        if (response.status === 401) {
            status.innerHTML = '本次可继续练习；<a href="/signin-with-chatgpt?return_to=%2Fquiz.html">登录后保存进度</a>。';
            return;
        }
        if (!response.ok) throw new Error("save_failed");
        status.textContent = "本次答题已保存。";
    } catch (error) {
        status.textContent = "本次答题暂未同步。";
    }
}



// ========================================
// 4. 显示答案解析
// ========================================

function showAnalysis(userAnswer, isCorrect, answeredVersion) {


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

    audioButton.addEventListener("click", () => playAudio());
    playAudio(() => {
        if (questionVersion !== answeredVersion) return;
        scheduleAutomaticAdvance(() => {
            if (questionVersion === answeredVersion) showRandomQuestion();
        }, isCorrect ? 650 : 1800);
    });

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

function playAudio(afterPlayback) {


    const audio =
        document
            .getElementById("wordAudio");


    // 每次点击都从头播放
    audio.currentTime = 0;


    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        audio.onended = null;
        if (typeof afterPlayback === "function") afterPlayback();
    };
    audio.onended = finish;
    audio.play().catch(function(error) {

            console.error(
                "音频播放失败：",
                error
            );

            finish();
        });
    if (typeof afterPlayback === "function") window.setTimeout(finish, 3500);

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

function toneParts(jyutping) {
    return jyutping.split(/\s+/).map(syllable => ({ base: syllable.slice(0, -1), tone: Number(syllable.at(-1)) }));
}

function showToneMarkStats() {
    document.getElementById("toneMarkStats").textContent = `答对 ${toneMarkStats.right} / ${toneMarkStats.total} · 错题 ${toneMarkStats.bad.length}`;
}

function showToneMarkQuestion(retry = false) {
    cancelAutomaticAdvance();
    questionVersion += 1;
    if (!words.length) return;
    const retryPool = retry && toneMarkStats.bad.length ? words.filter(w => toneMarkStats.bad.includes(w.id)) : [];
    const pool = retryPool.length ? retryPool : words;
    toneMarkQuestion = pool[Math.floor(Math.random() * pool.length)];
    toneMarkAnswered = false;
    document.getElementById("toneMarkWord").textContent = toneMarkQuestion.word;
    document.getElementById("toneMarkClue").textContent = "";
    document.getElementById("toneMarkInputs").innerHTML = toneParts(toneMarkQuestion.jyutping).map((part, i) => `<label class="mark">${part.base}<select data-tone-mark="${i}"><option value="">声调</option>${[1,2,3,4,5,6].map(n => `<option>${n}</option>`).join("")}</select></label>`).join("");
    document.querySelectorAll("[data-tone-mark]").forEach(input => input.addEventListener("change", () => {
        const inputs = [...document.querySelectorAll("[data-tone-mark]")];
        if (inputs.length && inputs.every(item => item.value)) checkToneMarkAnswer();
    }));
    document.getElementById("toneMarkResult").textContent = "";
    document.getElementById("toneMarkSaveStatus").textContent = "";
    document.getElementById("toneMarkReplay").hidden = true;
    document.getElementById("checkToneMark").disabled = false;
    document.getElementById("newToneMark").hidden = true;
    toneMarkAudio.pause();
    showToneMarkStats();
    animateQuestion("toneMode");
}

async function checkToneMarkAnswer() {
    if (!toneMarkQuestion || toneMarkAnswered) return;
    const selected = [...document.querySelectorAll("[data-tone-mark]")].map(x => Number(x.value));
    const wanted = toneParts(toneMarkQuestion.jyutping).map(x => x.tone);
    if (selected.some(x => !x)) {
        document.getElementById("toneMarkResult").textContent = "请先选完所有声调。";
        return;
    }
    const correct = wanted.every((x, i) => x === selected[i]);
    toneMarkAnswered = true;
    const answeredVersion = questionVersion;
    document.getElementById("checkToneMark").disabled = true;
    document.getElementById("newToneMark").hidden = false;
    document.querySelectorAll("[data-tone-mark]").forEach(input => { input.disabled = true; });
    window.cantoRecordAttempt?.({ type: "tone_mark", wordId: toneMarkQuestion.id, prompt: toneMarkQuestion.word, answer: selected.join("-"), correctAnswer: wanted.join("-"), isCorrect: correct });
    toneMarkStats.total++;
    if (correct) {
        toneMarkStats.right++;
        toneMarkStats.bad = toneMarkStats.bad.filter(id => id !== toneMarkQuestion.id);
    } else if (!toneMarkStats.bad.includes(toneMarkQuestion.id)) {
        toneMarkStats.bad.push(toneMarkQuestion.id);
    }
    localStorage.setItem("markStats", JSON.stringify(toneMarkStats));
    document.getElementById("toneMarkResult").textContent = `${correct ? "✓ 正确" : "✗ 正确答案"}：${toneMarkQuestion.jyutping}`;
    playToneMarkAudio(() => {
        if (questionVersion !== answeredVersion) return;
        scheduleAutomaticAdvance(() => {
            if (questionVersion === answeredVersion) showToneMarkQuestion();
        }, correct ? 650 : 2200);
    });
    document.getElementById("toneMarkReplay").hidden = false;
    showToneMarkStats();
    try {
        const response = await fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "quiz_attempt", quizType: "tone_mark", wordId: toneMarkQuestion.id, prompt: toneMarkQuestion.word, answer: selected.join("-"), correctAnswer: wanted.join("-"), isCorrect: correct }) });
        document.getElementById("toneMarkSaveStatus").textContent = response.ok ? "本题记录已保存。" : "登录后可保存错题记录。";
    } catch (error) {
        document.getElementById("toneMarkSaveStatus").textContent = "本题暂未同步。";
    }
}

function playToneMarkAudio(afterPlayback) {
    if (!toneMarkQuestion || !toneMarkQuestion.audio) return;
    toneMarkAudio.src = `audio/${toneMarkQuestion.audio[voiceSelect.value]}`;
    toneMarkAudio.currentTime = 0;
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        toneMarkAudio.onended = null;
        if (typeof afterPlayback === "function") afterPlayback();
    };
    toneMarkAudio.onended = finish;
    toneMarkAudio.play().catch(() => {
        document.getElementById("toneMarkSaveStatus").textContent = "录音暂时无法播放。";
        finish();
    });
    if (typeof afterPlayback === "function") window.setTimeout(finish, 3500);
}

document.getElementById("checkToneMark").addEventListener("click", checkToneMarkAnswer);
document.getElementById("toneMarkReplay").addEventListener("click", playToneMarkAudio);
document.getElementById("newToneMark").addEventListener("click", () => showToneMarkQuestion());
document.getElementById("retryToneMark").addEventListener("click", () => showToneMarkQuestion(true));
