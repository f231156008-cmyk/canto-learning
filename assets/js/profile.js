(function () {
    const byId = id => document.getElementById(id);
    const read = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
        catch { return fallback; }
    };

    const progress = read("cantoStandaloneProgress", {});
    const quizAttempts = read("cantoStandaloneQuiz", []);
    const characterAttempts = read("cantoStandaloneCharacters", []);
    const tone = read("toneStats", { right: 0, total: 0, bad: [] });
    const mark = read("markStats", { right: 0, total: 0, bad: [] });
    const attempts = [...quizAttempts, ...characterAttempts];
    const total = attempts.length + Number(tone.total || 0) + Number(mark.total || 0);
    const correct = attempts.filter(item => item.isCorrect === true || item.ok === true).length
        + Number(tone.right || 0) + Number(mark.right || 0);
    const wrong = Math.max(0, total - correct);

    byId("profileLearned").textContent = Object.keys(progress).length;
    byId("profileAttempts").textContent = total;
    byId("profileAccuracy").textContent = total ? `${Math.round(correct / total * 100)}%` : "—";
    byId("profileWrong").textContent = wrong;
    byId("profileCategory").textContent = localStorage.getItem("cantoLearningCategory") || "未选择";
    byId("profileLevel").textContent = localStorage.getItem("cantoLearningLevel") || "未选择";

    fetch("data/words.json")
        .then(response => response.ok ? response.json() : [])
        .then(words => { if (Array.isArray(words)) byId("profileWordCount").textContent = `${words.length} 词 →`; })
        .catch(() => {});

    async function renderAccount() {
        if (!window.CantoCloud) return;
        const session = await window.CantoCloud.session();
        const email = session?.user?.email || "";
        byId("profileAccountState").textContent = email ? "已登录" : "未登录";
        byId("profileAccountEmail").textContent = email;
        byId("profileAccountAction").textContent = email ? "退出" : "登录";
    }

    byId("profileAccountAction").addEventListener("click", () => {
        document.getElementById("cloudAuthButton")?.click();
    });
    document.addEventListener("canto-cloud-ready", renderAccount);
    document.addEventListener("canto-auth-change", renderAccount);
    renderAccount().catch(() => {});
})();
