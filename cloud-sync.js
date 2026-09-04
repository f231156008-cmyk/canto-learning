(function () {
  const preferenceKeys = ["cantoLearningCategory", "cantoLearningLevel", "cantoQuizCategory", "cantoVoice"];
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

  function localState() {
    return {
      attempts: readJson("cantoAttempts", []),
      mastered_chars: readJson("cantoMasteredChars", []),
      preferences: Object.fromEntries(preferenceKeys.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null))
    };
  }

  function applyState(state) {
    if (Array.isArray(state.attempts)) localStorage.setItem("cantoAttempts", JSON.stringify(state.attempts));
    if (Array.isArray(state.mastered_chars)) localStorage.setItem("cantoMasteredChars", JSON.stringify(state.mastered_chars));
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
      const { data, error } = await client.from("learning_state").select("attempts, mastered_chars, preferences").eq("user_id", session.user.id).maybeSingle();
      if (error) throw error;
      const local = localState();
      const merged = {
        attempts: uniqueAttempts(local.attempts, data?.attempts || []),
        mastered_chars: [...new Set([...(data?.mastered_chars || []), ...local.mastered_chars])],
        preferences: { ...(data?.preferences || {}), ...local.preferences }
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
