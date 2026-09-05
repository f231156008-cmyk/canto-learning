(function () {
  const preferenceKeys = ["cantoLearningCategory", "cantoLearningLevel", "cantoQuizCategory", "cantoQuizLevel", "cantoVoice"];
  let client;
  let session;
  let timer;
  let syncing = false;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_error) { return fallback; }
  }

  function uniqueAttempts(localItems, cloudItems) {
    const items = new Map();
    [...cloudItems, ...localItems].forEach(item => {
      if (item && item.id) items.set(item.id, item);
    });
    return [...items.values()].sort((a, b) => String(b.time || "").localeCompare(String(a.time || ""))).slice(0, 1000);
  }

  function mergeProgress(cloudValue, localValue) {
    const rank = { learning: 1, mastered: 2 };
    const merged = { ...(cloudValue || {}) };
    Object.entries(localValue || {}).forEach(([id, status]) => {
      if ((rank[status] || 0) >= (rank[merged[id]] || 0)) merged[id] = status;
    });
    return merged;
  }

  function mergeLatestMap(cloudValue, localValue) {
    const merged = { ...(cloudValue || {}) };
    Object.entries(localValue || {}).forEach(([key, value]) => {
      if (!merged[key] || Number(value?.updatedAt || 0) >= Number(merged[key]?.updatedAt || 0)) merged[key] = value;
    });
    return merged;
  }

  function mergePlacement(cloudValue, localValue) {
    const merged = { ...(cloudValue || {}) };
    Object.entries(localValue || {}).forEach(([level, value]) => {
      const old = merged[level];
      if (!old || Number(value?.score || 0) > Number(old?.score || 0) || Number(value?.passedAt || 0) > Number(old?.passedAt || 0)) merged[level] = value;
    });
    return merged;
  }

  function readChallengeBests() {
    const result = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("cantoLocalBest-")) result[key] = Number(localStorage.getItem(key) || 0);
    }
    return result;
  }

  function readAppState() {
    return {
      word_progress: readJson("cantoStandaloneProgress", {}),
      placement_passed: readJson("cantoPlacementPassed", {}),
      vocabulary_routes: readJson("cantoVocabularyRoutes", {}),
      tone_stats: readJson("toneStats", { right: 0, total: 0, bad: [] }),
      tone_mark_stats: readJson("markStats", { right: 0, total: 0, bad: [] }),
      challenge_bests: readChallengeBests()
    };
  }

  function mergeAppState(cloudValue, localValue) {
    const cloud = cloudValue || {}, local = localValue || {};
    const chooseStats = (a, b) => Number(b?.total || 0) >= Number(a?.total || 0) ? b : a;
    const bests = { ...(cloud.challenge_bests || {}) };
    Object.entries(local.challenge_bests || {}).forEach(([key, value]) => { bests[key] = Math.max(Number(bests[key] || 0), Number(value || 0)); });
    return {
      word_progress: mergeProgress(cloud.word_progress, local.word_progress),
      placement_passed: mergePlacement(cloud.placement_passed, local.placement_passed),
      vocabulary_routes: mergeLatestMap(cloud.vocabulary_routes, local.vocabulary_routes),
      tone_stats: chooseStats(cloud.tone_stats, local.tone_stats),
      tone_mark_stats: chooseStats(cloud.tone_mark_stats, local.tone_mark_stats),
      challenge_bests: bests
    };
  }

  function localState() {
    return {
      attempts: readJson("cantoAttempts", []),
      mastered_chars: readJson("cantoMasteredChars", []),
      preferences: Object.fromEntries(preferenceKeys.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null)),
      app_state: readAppState()
    };
  }

  function applyState(state) {
    if (Array.isArray(state.attempts)) localStorage.setItem("cantoAttempts", JSON.stringify(state.attempts));
    if (Array.isArray(state.mastered_chars)) localStorage.setItem("cantoMasteredChars", JSON.stringify(state.mastered_chars));
    if (state.app_state) {
      localStorage.setItem("cantoStandaloneProgress", JSON.stringify(state.app_state.word_progress || {}));
      localStorage.setItem("cantoPlacementPassed", JSON.stringify(state.app_state.placement_passed || {}));
      localStorage.setItem("cantoVocabularyRoutes", JSON.stringify(state.app_state.vocabulary_routes || {}));
      localStorage.setItem("toneStats", JSON.stringify(state.app_state.tone_stats || { right: 0, total: 0, bad: [] }));
      localStorage.setItem("markStats", JSON.stringify(state.app_state.tone_mark_stats || { right: 0, total: 0, bad: [] }));
      Object.entries(state.app_state.challenge_bests || {}).forEach(([key, value]) => localStorage.setItem(key, String(value)));
    }
    Object.entries(state.preferences || {}).forEach(([key, value]) => {
      if (preferenceKeys.includes(key) && value !== null) localStorage.setItem(key, String(value));
    });
  }

  function setIndicator(text, connected) {
    document.querySelectorAll(".sync-indicator").forEach(item => {
      item.textContent = text;
      item.classList.toggle("cloud-connected", Boolean(connected));
    });
    document.dispatchEvent(new CustomEvent("canto-cloud-status", { detail: { text, connected, session } }));
  }

  async function sync() {
    if (!session || syncing) return;
    syncing = true;
    setIndicator("同步中", true);
    try {
      const { data, error } = await client.from("learning_state").select("attempts, mastered_chars, preferences, app_state").eq("user_id", session.user.id).maybeSingle();
      if (error) throw error;
      const local = localState();
      const merged = {
        attempts: uniqueAttempts(local.attempts, data?.attempts || []),
        mastered_chars: [...new Set([...(data?.mastered_chars || []), ...local.mastered_chars])],
        preferences: { ...(data?.preferences || {}), ...local.preferences },
        app_state: mergeAppState(data?.app_state, local.app_state)
      };
      const { error: saveError } = await client.from("learning_state").upsert({ user_id: session.user.id, ...merged, updated_at: new Date().toISOString() });
      if (saveError) throw saveError;
      applyState(merged);
      setIndicator("已同步", true);
      document.dispatchEvent(new CustomEvent("canto-cloud-synced", { detail: merged }));
    } catch (error) {
      setIndicator("同步失败", false);
      document.dispatchEvent(new CustomEvent("canto-cloud-error", { detail: error }));
    } finally {
      syncing = false;
    }
  }

  function queueSync() {
    clearTimeout(timer);
    timer = setTimeout(sync, 500);
  }

  async function init() {
    if (client) return client;
    const config = window.CANTO_SUPABASE || {};
    if (!config.url || !config.publishableKey || !window.supabase) throw new Error("Supabase 尚未配置");
    client = window.supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await client.auth.getSession();
    session = data.session;
    setIndicator(session ? "账户已连接" : "本地保存", Boolean(session));
    if (session) await sync();
    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      setIndicator(session ? "账户已连接" : "本地保存", Boolean(session));
      if (session) queueSync();
    });
    document.dispatchEvent(new CustomEvent("canto-cloud-ready", { detail: { client, session } }));
    return client;
  }

  window.cantoCloud = {
    init,
    sync,
    queueSync,
    getClient: () => client,
    getSession: () => session
  };
})();
