# Cantonese Learning

独立运行的粤语学习网站。无需 ChatGPT 或 OpenAI 运行环境，入口是 `index.html`。

## 目录

```text
├─ *.html            页面；保留在根目录，网址简单稳定
├─ assets/
│  ├─ css/           全站样式
│  ├─ js/            学习、测试与互动逻辑
│  └─ icons/         图标
├─ data/
│  ├─ words.json     主词库
│  ├─ words.csv      便于表格编辑的词库副本
│  ├─ hanzi/         繁体字笔画数据
│  └─ review/        词条例句审核数据
├─ supabase/          SQL 数据库结构与可重复导入的词库
├─ tools/             词库转换等开发工具
├─ docs/              开发者学习笔记（不在公开网站导航显示）
└─ audio/            单词、例句和闯关音频
```

## GitHub 在这里做什么

GitHub 仓库是项目的云端档案库。每次 `commit` 都像一个带说明的存档点，记录哪些文件发生了变化；`push` 把这些存档上传到 GitHub。需要时可以比较版本、找回旧文件或建立独立实验分支。

正式网站由 `full-site` 分支通过 GitHub Pages 发布。日常流程是：修改本地文件 → 测试 → commit → push → GitHub Pages 自动更新。

## 学习进度

当前版本把学习记录保存在浏览器的 localStorage 中；同一设备可保留，换设备不会自动同步。后续接入 Supabase 后，可加入邮箱或 Google 登录及跨设备同步。

数据库设计和导入方法见 `docs/database.md`。网站会保留 `data/words.json` 作为离线备份和 Git 版本记录。
