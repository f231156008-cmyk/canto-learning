import fs from "node:fs";

const source = fs.readFileSync("assets/js/cha-chaan-teng.js", "utf8");
const dataSource = source.slice(0, source.indexOf("let key="));
const themes = Function(`${dataSource}; return themes;`)();
const records = [];

for (const [themeKey, theme] of Object.entries(themes)) {
  theme.stages.forEach((stage, stageIndex) => {
    const prefix = themeKey === "tea" ? "cha" : themeKey;
    const number = String(stageIndex + 1).padStart(2, "0");
    records.push({
      kind: "challenge_question",
      theme: themeKey,
      file: `${prefix}-${number}-question.mp3`,
      text: stage.line,
      targetJyutping: stage.jp,
    });
    stage.answers.forEach((answer, optionIndex) => records.push({
      kind: "challenge_option",
      theme: themeKey,
      file: `${prefix}-${number}-option-${optionIndex + 1}.mp3`,
      text: answer.text,
      targetJyutping: answer.jp,
    }));
  });
}

process.stdout.write(JSON.stringify(records));
