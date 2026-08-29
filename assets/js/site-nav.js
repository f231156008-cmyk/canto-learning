const siteNavigationItems = [
    ["Canto.html", "首页"],
    ["vocabulary.html", "学词"],
    ["wordlist.html", "词库"],
    ["quiz.html", "练习"],
    ["pronunciation.html", "发音"],
    ["characters.html", "字形"],
    ["cha-chaan-teng.html", "在地"]
];

const currentPage = location.pathname.split("/").pop() || "index.html";
const navigation = document.createElement("nav");
navigation.className = "floating-site-nav";
navigation.setAttribute("aria-label", "全站导航");

siteNavigationItems.forEach(([href, label]) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    const isHome = href === "Canto.html" && (currentPage === "Canto.html" || currentPage === "index.html");
    if (currentPage === href || isHome) {
        link.className = "active";
        link.setAttribute("aria-current", "page");
    }
    navigation.append(link);
});

document.body.append(navigation);

if (!window.CantoCloud && !document.querySelector('script[data-canto-cloud="loading"]')) {
    const loadScript = (src, marker) => new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (marker()) resolve();
            else existing.addEventListener("load", resolve, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.dataset.cantoCloud = "loading";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
    });
    loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", () => Boolean(window.supabase))
        .then(() => loadScript("assets/js/supabase-config.js", () => Boolean(window.CANTO_SUPABASE)))
        .then(() => loadScript("assets/js/cloud-auth.js", () => Boolean(window.CantoCloud)))
        .catch(() => console.warn("云端登录暂时无法载入，本地学习功能不受影响。"));
}
