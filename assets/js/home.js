(function () {
    const byId = id => document.getElementById(id);
    const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
    const quizAttempts = read("cantoStandaloneQuiz", []), localProgress = read("cantoStandaloneProgress", {}), localRuns = read("cantoStandaloneRuns", []), charAttempts = read("cantoStandaloneCharacters", []);
    const toneStats = read("toneStats", { right: 0, total: 0 }), markStats = read("markStats", { right: 0, total: 0 });
    const allAttempts = [...quizAttempts, ...charAttempts];
    const correct = allAttempts.filter(item => item.isCorrect === true || item.ok === true).length + Number(toneStats.right || 0) + Number(markStats.right || 0);
    const total = allAttempts.length + Number(toneStats.total || 0) + Number(markStats.total || 0);
    const dates = new Set([...allAttempts, ...localRuns].map(item => item.at).filter(Boolean).map(value => new Date(value).toDateString()));
    const localLearned = Object.keys(localProgress).length;
    byId("homeDate").textContent = new Intl.DateTimeFormat("zh-HK", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
    byId("masteredCount").textContent = localLearned; byId("accuracyRate").textContent = total ? `${Math.round(correct / total * 100)}%` : "—"; byId("studyDays").textContent = dates.size;
    byId("homeProgressFill").style.width = `${Math.min(100, localLearned)}%`;
    byId("progressNote").textContent = localLearned ? `你已经留下 ${localLearned} 个词的学习记录。` : "选一组相关词汇，开始今天的第一关。";
    const recent = [...allAttempts, ...localRuns].filter(item => item.at).sort((a, b) => b.at - a.at).slice(0, 3);
    if (recent.length) byId("recentActivity").innerHTML = recent.map(item => { const passed = item.isCorrect === true || item.ok === true || Number(item.score || 0) > 0; const label = item.questionType || item.theme || item.question || "学习练习"; const time = new Intl.DateTimeFormat("zh-HK", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.at)); return `<div class="home-activity-row"><span class="${passed ? "good" : "retry"}">${passed ? "完成" : "复习"}</span><strong>${String(label).replace(/[<>]/g, "")}</strong><time>${time}</time></div>`; }).join("");
    async function refreshCloudProgress() {
        if (!window.CantoCloud) return;
        try { const active = await window.CantoCloud.session(); if (!active) return; const rows = await window.CantoCloud.loadProgress(); const learned = rows.length; byId("masteredCount").textContent = learned; byId("homeProgressFill").style.width = `${Math.min(100, learned)}%`; byId("progressSource").textContent = "云端记录"; byId("homeGreeting").textContent = `欢迎回来，${active.user.email.split("@")[0]}。`; byId("progressNote").textContent = learned ? `云端已经保存 ${learned} 个词的学习进度。` : "账号已连接，接下来的学习会自动保存。"; } catch (error) { console.warn("云端进度暂时不可用", error); }
    }
    async function refreshDailyLine() {
        if (!window.CantoCloud?.loadDailyLibraryEntry) return;
        try {
            const entry = await window.CantoCloud.loadDailyLibraryEntry();
            if (!entry) return;
            byId("dailyLibraryLine").textContent = entry.excerpt;
            byId("dailyLibrarySource").textContent = [entry.creator, entry.title, entry.entry_type].filter(Boolean).join(" · ");
        } catch (error) { console.warn("首页句库暂时不可用", error); }
    }
    document.addEventListener("canto-auth-change", refreshCloudProgress); document.addEventListener("canto-cloud-ready", refreshCloudProgress); refreshCloudProgress();
    document.addEventListener("canto-cloud-ready", refreshDailyLine); refreshDailyLine();
})();
