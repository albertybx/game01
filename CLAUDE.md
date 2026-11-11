# 專案說明（給 Claude）

## 這個 repo 是什麼

這是一個遊戲專案，從使用者的範本 repo `game-starter` 建立。`.claude/skills/` 裡有來自
[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
的 77 個遊戲開發 skill，加上一個 `router`。做遊戲相關的工作時，先用 `router` skill 挑出要讀的 skill，讀完再動手。

## 使用者

- 第一次用 AI 做遊戲，是程式新手。請用**繁體中文**、白話回覆，少用術語；非用不可時順便解釋一句。
- 常用手機在雲端 session 上操作，不一定有電腦在手邊。
- 如果還沒決定引擎，用下面的方式建議：
  - 想快點看到成果、用手機或瀏覽器就能玩 → **Phaser**（網頁遊戲）。雲端可以直接測試，也能分享網址給別人玩。
  - 想認真做、以後上 Steam → **Godot**。要在電腦上裝 Godot 編輯器才能打開來玩、調整。
- 一開始先做很小、能玩的版本（例如 1 到 2 關），再慢慢加功能。

## Git 與分支

- 雲端 session 會把改動推到 `claude/` 開頭的工作分支。新的 session 讀的是 `main`，所以每次 push 後，
  都要提醒使用者這件事，並詢問要不要開 PR，讓使用者在 GitHub 上按 **Merge** 合併到 `main`。
- 跟使用者解釋分支時，可以用「影印一份設計圖來改，改好再謄回正式圖」的比喻，使用者之前聽得懂。

## 更新 skill

`.claude/skills/` 是建立 repo 當下從範本複製過來的，不會自動更新。使用者想更新時，從上面的上游 repo
取最新版，覆蓋 `.claude/skills/`，並保留 `.claude/skills-license/` 裡的授權檔。
