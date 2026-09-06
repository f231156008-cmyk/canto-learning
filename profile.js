(function () {
  function renderStats() {
    const attempts = JSON.parse(localStorage.getItem("cantoAttempts") || "[]");
    const masteredChars = JSON.parse(localStorage.getItem("cantoMasteredChars") || "[]");
    const legacy = JSON.parse(localStorage.getItem("markStats") || '{"right":0,"total":0,"bad":[]}');
    const total = attempts.length || Number(legacy.total) || 0;
    const correct = attempts.length ? attempts.filter(item => item.isCorrect).length : Number(legacy.right) || 0;
    const wrong = attempts.length ? attempts.length - correct : (Array.isArray(legacy.bad) ? legacy.bad.length : 0);
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    setText("attemptCount", total);
    setText("accuracyRate", total ? `${Math.round(correct / total * 100)}%` : "—");
    setText("wrongCount", wrong);
    setText("masteredCharCount", masteredChars.length);
    const recentList = document.getElementById("recentLearningList");
    if (recentList) {
      const recent = attempts.slice(0, 5);
      recentList.replaceChildren();
      if (!recent.length) {
        const empty = document.createElement("li");
        empty.className = "is-empty";
        empty.textContent = "暂无记录";
        recentList.appendChild(empty);
      } else {
        recent.forEach(item => {
          const row = document.createElement("li");
          row.textContent = item.prompt || item.correctAnswer || "练习";
          recentList.appendChild(row);
        });
      }
    }
  }
  renderStats();

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
  document.addEventListener("canto-cloud-synced", renderStats);
  document.addEventListener("canto-cloud-error", event => {
    loginMessage.textContent = `连接失败：${event.detail.message || "请稍后重试"}`;
  });
})();
