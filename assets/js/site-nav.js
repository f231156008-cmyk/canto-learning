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
