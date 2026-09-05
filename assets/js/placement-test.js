(function () {
    const TEST_SIZE = 15;
    const PASS_SCORE = 12;
    const LEVEL_ORDER = ["入门", "初级", "中级", "高级"];
    const byId = id => document.getElementById(id);
    let allWords = [], testWords = [], currentLevel = "", index = 0, score = 0, answered = false, advanceTimer = null;
    const audio = byId("placementAudio");

    function shuffle(items) {
        for (let i = items.length - 1; i > 0; i--) {
            const target = Math.floor(Math.random() * (i + 1));
            [items[i], items[target]] = [items[target], items[i]];
        }
        return items;
    }

    function passedLevels() {
        try { return JSON.parse(localStorage.getItem("cantoPlacementPassed") || "{}"); }
        catch { return {}; }
    }

    function renderPrevious() {
        const passed = passedLevels();
        const level = byId("placementLevel").value;
        byId("placementPrevious").textContent = passed[level] ? `已通过 · ${passed[level].score}/${passed[level].total}` : "";
    }

    function audioFile(item) {
        const voice = localStorage.getItem("cantoVoice") === "male" ? "male" : "female";
        return item.audio?.[voice] ? `audio/${item.audio[voice]}` : "";
    }

    function play(item, after) {
        const file = audioFile(item);
        if (!file) { if (after) after(); return; }
        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            audio.onended = null;
            if (after) after();
        };
        audio.src = file;
        audio.currentTime = 0;
        audio.onended = done;
        audio.play().catch(done);
        if (after) window.setTimeout(done, 3500);
    }

    function syllables(value) {
        return String(value || "").trim().split(/\s+/).filter(Boolean);
    }

    function phoneticBase(value) {
        return String(value || "").toLowerCase().replace(/[1-6]/g, "").replace(/[^a-z]/g, "");
    }

    function sharedPrefix(left, right) {
        const a = phoneticBase(left), b = phoneticBase(right);
        let count = 0;
        while (count < a.length && count < b.length && a[count] === b[count]) count += 1;
        return count;
    }

    function similarityScore(candidate, item) {
        const itemSyllables = syllables(item.jyutping);
        const candidateSyllables = syllables(candidate.jyutping);
        let score = 0;
        if (candidate.category === item.category) score += 12;
        if (candidate.level === item.level) score += 3;
        if (candidateSyllables.length === itemSyllables.length) score += 10;
        else score -= Math.abs(candidateSyllables.length - itemSyllables.length) * 5;
        if ([...candidate.word].length === [...item.word].length) score += 5;
        score += Math.min(5, sharedPrefix(candidate.jyutping, item.jyutping));
        candidateSyllables.forEach((part, index) => {
            const target = itemSyllables[index];
            if (!target) return;
            if (part.replace(/[1-6]$/, "") === target.replace(/[1-6]$/, "")) score += 4;
            if (part.at(-1) === target.at(-1)) score += 1;
        });
        return score;
    }

    function distractors(item, field, sameCategory = false) {
        const candidates = allWords.filter(word => word.id !== item.id && word[field] && word[field] !== item[field]);
        const categoryMatches = candidates.filter(word => word.category === item.category);
        const pool = sameCategory && categoryMatches.length >= 3 ? categoryMatches : candidates;
        return pool
            .map(word => ({ word, score: similarityScore(word, item), tie: Math.random() }))
            .sort((a, b) => b.score - a.score || a.tie - b.tie)
            .slice(0, 3)
            .map(entry => entry.word[field]);
    }

    function toneVariant(jyutping, offset) {
        return jyutping.split(/\s+/).map((part, i) => part.replace(/[1-6]$/, tone => String(((Number(tone) - 1 + offset + i) % 6) + 1))).join(" ");
    }

    function replaceInitial(base) {
        const pairs = [["gw", "g"], ["kw", "k"], ["ng", "n"], ["n", "l"], ["l", "n"], ["g", "k"], ["k", "g"], ["b", "p"], ["p", "b"], ["d", "t"], ["t", "d"], ["z", "c"], ["c", "z"], ["s", "z"], ["f", "h"], ["h", "f"]];
        const pair = pairs.find(([from]) => base.startsWith(from));
        return pair ? pair[1] + base.slice(pair[0].length) : `h${base}`;
    }

    function replaceFinal(base) {
        const pairs = [["eong", "eng"], ["ing", "eng"], ["eng", "ing"], ["ong", "on"], ["ang", "an"], ["ng", "n"], ["n", "ng"], ["k", "t"], ["t", "k"], ["oi", "ou"], ["ou", "oi"], ["ei", "ai"], ["aa", "a"]];
        const pair = pairs.find(([from]) => base.endsWith(from));
        return pair ? base.slice(0, -pair[0].length) + pair[1] : `${base}n`;
    }

    function soundVariant(jyutping, kind) {
        const parts = jyutping.split(/\s+/);
        const target = kind === "final" && parts.length > 1 ? parts.length - 1 : 0;
        const match = parts[target].match(/^(.+?)([1-6])$/);
        if (!match) return jyutping;
        const changed = kind === "initial" ? replaceInitial(match[1]) : replaceFinal(match[1]);
        parts[target] = `${changed}${match[2]}`;
        return parts.join(" ");
    }

    function closeJyutpingChoices(item) {
        const candidates = [
            item.jyutping,
            toneVariant(item.jyutping, 1),
            soundVariant(item.jyutping, "initial"),
            soundVariant(item.jyutping, "final"),
            toneVariant(item.jyutping, 2)
        ];
        return shuffle([...new Set(candidates)].slice(0, 4));
    }

    function questionFor(item) {
        const mode = index % 3;
        if (mode === 0) return { type: "看字选粤拼", prompt: item.word, context: item.meaning || "", answer: item.jyutping, choices: closeJyutpingChoices(item) };
        if (mode === 1) return { type: "听音选词", prompt: "", context: "", answer: item.word, choices: shuffle([item.word, ...distractors(item, "word", true)]), listen: true };
        const noTone = item.jyutping.replace(/[1-6]/g, "");
        return { type: `选择声调 · ${noTone}`, prompt: item.word, context: item.example ? `例句：${item.example}` : (item.meaning || ""), answer: item.jyutping, choices: shuffle([item.jyutping, toneVariant(item.jyutping, 1), toneVariant(item.jyutping, 2), toneVariant(item.jyutping, 4)]) };
    }

    function showQuestion() {
        window.clearTimeout(advanceTimer);
        answered = false;
        const item = testWords[index];
        const question = questionFor(item);
        byId("placementCount").textContent = `${index + 1}/${testWords.length}`;
        byId("placementScore").textContent = `${score} 分`;
        byId("placementFill").style.width = `${index / testWords.length * 100}%`;
        byId("placementType").textContent = question.type;
        byId("placementPrompt").textContent = question.prompt;
        byId("placementPrompt").hidden = !question.prompt;
        byId("placementContext").textContent = question.context || "";
        byId("placementContext").hidden = !question.context;
        byId("placementFeedback").textContent = "";
        byId("placementReplay").hidden = !question.listen;
        byId("placementReplay").onclick = () => play(item);
        byId("placementOptions").replaceChildren(...question.choices.map(choice => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = choice;
            button.addEventListener("click", () => answer(button, choice, question, item));
            return button;
        }));
        if (question.listen) play(item);
        byId("placementQuiz").animate?.([{ opacity: .25, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "ease-out" });
    }

    function answer(button, choice, question, item) {
        if (answered) return;
        answered = true;
        const correct = choice === question.answer;
        if (correct) score += 1;
        window.cantoRecordAttempt?.({
            type: "placement_test",
            wordId: item.id,
            prompt: item.word,
            answer: choice,
            correctAnswer: question.answer,
            isCorrect: correct
        });
        byId("placementOptions").querySelectorAll("button").forEach(option => {
            option.disabled = true;
            if (option.textContent === question.answer) option.classList.add("correct-answer");
        });
        if (!correct) button.classList.add("wrong-answer");
        byId("placementScore").textContent = `${score} 分`;
        byId("placementFeedback").textContent = correct ? "正确" : `答案：${question.answer}`;
        play(item, () => {
            advanceTimer = window.setTimeout(() => {
                index += 1;
                if (index < testWords.length) showQuestion();
                else finish();
            }, correct ? 450 : 1300);
        });
    }

    async function markLevelComplete() {
        const levelWords = allWords.filter(item => item.level === currentLevel);
        const progress = JSON.parse(localStorage.getItem("cantoStandaloneProgress") || "{}");
        levelWords.forEach(item => { progress[item.id] = "mastered"; });
        localStorage.setItem("cantoStandaloneProgress", JSON.stringify(progress));
        const passed = passedLevels();
        passed[currentLevel] = { score, total: testWords.length, passedAt: Date.now() };
        localStorage.setItem("cantoPlacementPassed", JSON.stringify(passed));
        if (!window.CantoCloud) return false;
        const results = await Promise.allSettled(levelWords.map(item => window.CantoCloud.saveProgress(item.id, "mastered", null)));
        return results.some(result => result.status === "fulfilled" && result.value);
    }

    async function finish() {
        byId("placementQuiz").hidden = true;
        byId("placementResult").hidden = false;
        const passed = score >= PASS_SCORE;
        byId("placementResultTitle").textContent = passed ? `通过 ${currentLevel}` : "未通过";
        byId("placementResultScore").textContent = `${score}/${testWords.length}`;
        byId("placementResultStatus").textContent = passed ? "正在保存……" : `需要答对 ${PASS_SCORE} 题`;
        if (passed) {
            const synced = await markLevelComplete();
            const count = allWords.filter(item => item.level === currentLevel).length;
            byId("placementResultStatus").textContent = `${count} 个词已记为学过${synced ? "，并已同步" : ""}`;
        }
    }

    function start() {
        currentLevel = byId("placementLevel").value;
        const pool = shuffle(allWords.filter(item => item.level === currentLevel));
        testWords = pool.slice(0, Math.min(TEST_SIZE, pool.length));
        index = 0;
        score = 0;
        byId("placementSetup").hidden = true;
        byId("placementResult").hidden = true;
        byId("placementQuiz").hidden = false;
        showQuestion();
    }

    async function load() {
        try {
            const response = await fetch("data/words.json");
            if (!response.ok) throw new Error();
            allWords = await response.json();
            const levels = [...new Set(allWords.map(item => item.level).filter(Boolean))].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
            byId("placementLevel").innerHTML = levels.map(level => `<option value="${level}">${level}</option>`).join("");
            const saved = localStorage.getItem("cantoLearningLevel");
            if (levels.includes(saved)) byId("placementLevel").value = saved;
            renderPrevious();
        } catch {
            byId("placementStart").disabled = true;
            byId("placementPrevious").textContent = "词库加载失败";
        }
    }

    byId("placementLevel").addEventListener("change", renderPrevious);
    byId("placementStart").addEventListener("click", start);
    byId("placementRetry").addEventListener("click", () => {
        byId("placementResult").hidden = true;
        byId("placementSetup").hidden = false;
        renderPrevious();
    });
    load();
})();
