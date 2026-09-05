(function () {
  const attempts = JSON.parse(localStorage.getItem("cantoAttempts") || "[]");
  const masteredChars = JSON.parse(localStorage.getItem("cantoMasteredChars") || "[]");
  const legacy = JSON.parse(localStorage.getItem("markStats") || '{"right":0,"total":0,"bad":[]}');
  const total = attempts.length || Number(legacy.total) || 0;
  const correct = attempts.length ? attempts.filter(item => item.isCorrect).length : Number(legacy.right) || 0;
  const wrong = attempts.length ? attempts.length - correct : (Array.isArray(legacy.bad) ? legacy.bad.length : 0);
  document.getElementById("attemptCount").textContent = total;
  document.getElementById("accuracyRate").textContent = total ? `${Math.round(correct / total * 100)}%` : "—";
  document.getElementById("wrongCount").textContent = wrong;
  document.getElementById("masteredCharCount").textContent = masteredChars.length;
  document.getElementById("lastCategory").textContent = localStorage.getItem("cantoLearningCategory") || "未选择";
  document.getElementById("lastLevel").textContent = localStorage.getItem("cantoLearningLevel") || "未选择";
  document.getElementById("quizCategory").textContent = localStorage.getItem("cantoQuizCategory") || "全部主题";
  const voice = localStorage.getItem("cantoVoice");
  document.getElementById("voiceChoice").textContent = voice === "female" ? "女声" : voice === "male" ? "男声" : "未选择";

  const loginForm = document.getElementById("loginForm");
  const loginButton = document.getElementById("loginButton");
  const loginMessage = document.getElementById("loginMessage");
  const signedInPanel = document.getElementById("signedInPanel");
  const accountState = document.getElementById("accountState");
  const accountEmail = document.getElementById("accountEmail");
  const logoutButton = document.getElementById("logoutButton");

  function showSession(session) {
    const email = session && session.user ? session.user.email : "";
    loginForm.hidden = Boolean(email);
    signedInPanel.hidden = !email;
    accountEmail.textContent = email;
    accountState.textContent = email ? "已登录" : "未登录";
    const indicator = document.querySelector(".sync-indicator");
    if (indicator) indicator.textContent = email ? "账户已连接" : "本地保存";
  }

  function bindAccount(client, session) {
    showSession(session);
    client.auth.onAuthStateChange((_event, nextSession) => showSession(nextSession));
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      loginButton.disabled = true;
      loginMessage.textContent = "正在发送……";
      const email = document.getElementById("loginEmail").value.trim();
      const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      loginMessage.textContent = error ? `发送失败：${error.message}` : "登录链接已发送，请检查邮箱。";
      loginButton.disabled = false;
    });
    logoutButton.addEventListener("click", async function () {
      logoutButton.disabled = true;
      await client.auth.signOut();
      logoutButton.disabled = false;
    });
  }

  document.addEventListener("canto-cloud-ready", event => bindAccount(event.detail.client, event.detail.session), { once: true });
  document.addEventListener("canto-cloud-synced", () => location.reload(), { once: true });
  document.addEventListener("canto-cloud-error", event => {
    loginMessage.textContent = `连接失败：${event.detail.message || "请稍后重试"}`;
  });
})();
