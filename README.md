# game-starter

我的遊戲專案範本。在 GitHub 上按 **Use this template** 建立新的遊戲 repo，新的 repo 會自帶下面這些遊戲開發 skill。在雲端 session 或桌機版 Claude Code 中打開專案，Claude 就會自動讀到。

## 裡面有什麼

`.claude/skills/` 裡放了 **77 個遊戲開發 skill + 1 個 router**：

| 類別 | 數量 | 內容 |
|---|---|---|
| 遊戲引擎 | 49 | Godot 16、Unity 8、Unreal 6、網頁（Phaser / PixiJS / three.js）6、Roblox 8、Bevy / Defold / LÖVE / pygame 4、Ebitengine 1 |
| 系統與手感 | 15 | 打擊感、存檔、對話、鏡頭、隨機生成、敵人 AI、關卡設計、效能… |
| 遊戲類型 | 9 | 平台跳躍、Roguelike、RPG、FPS、塔防、卡牌、視覺小說、生存製作、解謎 |
| 上架流程 | 4 | Game Jam、快速做原型、Steam、itch.io |
| router | 1 | 依照你用的引擎和需求，自動挑出要讀哪幾份 skill |

不用指定 skill，直接用中文說需求就好，例如「幫我的角色加二段跳」。

## 新遊戲怎麼開

1. 在這個 repo 的頁面按 **Use this template → Create a new repository**
2. 幫新遊戲取名字，例如 `my-first-game`，按建立
3. 用新的 repo 開一個 Claude 雲端 session，或 clone 到桌機，然後開始做遊戲

## 來源與更新

- 來源：[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
  （commit `dcf3bbb`，2026-11-10），授權 Apache-2.0，授權條款和 NOTICE 放在 `.claude/skills-license/`。
- 原作者更新時，這裡**不會**自動同步。想更新的話，跟 Claude 說「幫我把 game-starter 的 skill 更新到最新版」就可以。
- 從範本建立出來的遊戲 repo 是獨立的副本，範本更新後不會影響它們。
