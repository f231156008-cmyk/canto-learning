(async function () {
  const response = await fetch("sentence-patterns.json");
  const patterns = await response.json();
  const levelSelect = document.getElementById("patternLevel");
  const categorySelect = document.getElementById("patternCategory");
  const list = document.getElementById("patternList");
  const detail = document.getElementById("patternDetail");
  const count = document.getElementById("patternCount");
  let visible = patterns;
  let selectedId = patterns[0]?.id;

  function addOptions(select, values) {
    values.forEach(value => select.add(new Option(value, value)));
  }

  function renderDetail(pattern) {
    if (!pattern) {
      detail.innerHTML = '<p class="empty-state">没有符合条件的句式。</p>';
      return;
    }
    detail.innerHTML = `
      <p class="pattern-tags">${pattern.level} · ${pattern.category}</p>
      <h2>${pattern.pattern}</h2>
      <p class="jyutping pattern-reading">${pattern.jyutping}</p>
      <p class="pattern-meaning">${pattern.meaning}</p>
      <p class="pattern-usage">${pattern.usage}</p>
      <div class="pattern-examples">
        ${pattern.examples.map(example => `
          <div class="pattern-example">
            <strong>${example.cantonese}</strong>
            <span class="jyutping">${example.jyutping}</span>
            <span>${example.meaning}</span>
          </div>`).join("")}
      </div>`;
  }

  function render() {
    visible = patterns.filter(pattern =>
      (levelSelect.value === "全部" || pattern.level === levelSelect.value) &&
      (categorySelect.value === "全部" || pattern.category === categorySelect.value)
    );
    if (!visible.some(pattern => pattern.id === selectedId)) selectedId = visible[0]?.id;
    count.textContent = `${visible.length} 条语法`;
    list.innerHTML = visible.map(pattern => `
      <button type="button" data-id="${pattern.id}" class="${pattern.id === selectedId ? "active" : ""}">
        <strong>${pattern.pattern}</strong><span>${pattern.meaning}</span>
      </button>`).join("");
    renderDetail(visible.find(pattern => pattern.id === selectedId));
  }

  addOptions(levelSelect, [...new Set(patterns.map(item => item.level))]);
  addOptions(categorySelect, [...new Set(patterns.map(item => item.category))]);
  [levelSelect, categorySelect].forEach(select => select.addEventListener("change", render));
  list.addEventListener("click", event => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    selectedId = button.dataset.id;
    render();
    if (matchMedia("(max-width: 720px)").matches) detail.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  render();
})().catch(() => {
  document.getElementById("patternDetail").innerHTML = '<p class="empty-state">语法资料暂时无法载入。</p>';
});
