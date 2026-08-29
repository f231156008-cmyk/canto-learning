(function () {
    if (window.CantoCloud || !window.supabase || !window.CANTO_SUPABASE) return;

    const client = window.supabase.createClient(
        window.CANTO_SUPABASE.url,
        window.CANTO_SUPABASE.publishableKey,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );

    async function session() {
        const { data } = await client.auth.getSession();
        return data.session;
    }

    async function wordDatabaseId(legacyId) {
        const { data, error } = await client.from("words").select("id").eq("legacy_id", legacyId).maybeSingle();
        if (error) throw error;
        return data?.id || null;
    }

    window.CantoCloud = {
        client,
        session,
        async loadWords() {
            const { data, error } = await client.from("words").select("legacy_id,word,jyutping,difficulty,level,meaning_zh,pronunciation_note,audio_status,audio_review_note,audio_female,audio_male,themes(name),examples(sentence,jyutping,translation_zh,audio_female,audio_male,sort_order)").eq("is_published", true).order("legacy_id");
            if (error) throw error;
            return data.map(row => {
                const example = [...(row.examples || [])].sort((a, b) => a.sort_order - b.sort_order)[0] || {};
                return {
                    id: row.legacy_id,
                    word: row.word,
                    jyutping: row.jyutping,
                    category: row.themes?.name || "其他",
                    difficulty: row.difficulty,
                    level: row.level,
                    meaning: row.meaning_zh,
                    pronunciationNote: row.pronunciation_note,
                    audioStatus: row.audio_status,
                    audioReviewNote: row.audio_review_note,
                    audio: { female: row.audio_female, male: row.audio_male },
                    example: example.sentence || "",
                    exampleJyutping: example.jyutping || "",
                    exampleTranslation: example.translation_zh || "",
                    sentenceAudio: { female: example.audio_female, male: example.audio_male }
                };
            });
        },
        async loadProgress() {
            const active = await session();
            if (!active) return [];
            const { data, error } = await client.from("user_progress").select("status,correct_count,wrong_count,words(legacy_id)");
            if (error) throw error;
            return data;
        },
        async saveProgress(legacyId, status, correct) {
            const active = await session();
            if (!active) return false;
            const id = await wordDatabaseId(legacyId);
            if (!id) return false;
            const { data: old } = await client.from("user_progress").select("correct_count,wrong_count").eq("user_id", active.user.id).eq("word_id", id).maybeSingle();
            const row = {
                user_id: active.user.id,
                word_id: id,
                status,
                correct_count: (old?.correct_count || 0) + (correct === true ? 1 : 0),
                wrong_count: (old?.wrong_count || 0) + (correct === false ? 1 : 0),
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { error } = await client.from("user_progress").upsert(row);
            if (error) throw error;
            return true;
        },
        async saveAttempt({ legacyId, questionType, answer, isCorrect, responseMs = null }) {
            const active = await session();
            if (!active) return false;
            const id = await wordDatabaseId(legacyId);
            const { error } = await client.from("quiz_attempts").insert({ user_id: active.user.id, word_id: id, question_type: questionType, submitted_answer: answer, is_correct: isCorrect, response_ms: responseMs });
            if (error) throw error;
            return true;
        }
    };

    function createAuthUi() {
        if (document.getElementById("cloudAuthDock")) return;
        const dock = document.createElement("aside");
        dock.id = "cloudAuthDock";
        dock.className = "cloud-auth-dock";
        dock.innerHTML = '<button id="cloudAuthButton" type="button">登录</button><span id="cloudAuthUser"></span>';
        const dialog = document.createElement("dialog");
        dialog.id = "cloudAuthDialog";
        dialog.className = "cloud-auth-dialog";
        dialog.innerHTML = '<form method="dialog"><button class="cloud-auth-close" value="cancel" aria-label="关闭">×</button></form><h2>同步学习进度</h2><p>输入邮箱，我们会发送登录链接。</p><label for="cloudAuthEmail">邮箱</label><input id="cloudAuthEmail" type="email" autocomplete="email"><button id="cloudAuthSend" type="button">发送登录链接</button><p id="cloudAuthMessage" aria-live="polite"></p>';
        document.body.append(dock, dialog);

        const button = document.getElementById("cloudAuthButton");
        button.addEventListener("click", async () => {
            const active = await session();
            if (active) {
                await client.auth.signOut();
            } else {
                dialog.showModal();
            }
        });
        document.getElementById("cloudAuthSend").addEventListener("click", async () => {
            const email = document.getElementById("cloudAuthEmail").value.trim();
            const message = document.getElementById("cloudAuthMessage");
            if (!email) { message.textContent = "请填写邮箱。"; return; }
            message.textContent = "正在发送……";
            const redirectTo = new URL("Canto.html", location.href).href;
            const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
            message.textContent = error ? `发送失败：${error.message}` : "登录链接已发送，请检查邮箱。";
        });

        const render = active => {
            button.textContent = active ? "退出" : "登录";
            document.getElementById("cloudAuthUser").textContent = active?.user?.email || "";
            document.dispatchEvent(new CustomEvent("canto-auth-change", { detail: { session: active } }));
        };
        session().then(render);
        client.auth.onAuthStateChange((_event, active) => render(active));
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createAuthUi);
    else createAuthUi();
    document.dispatchEvent(new Event("canto-cloud-ready"));
})();
