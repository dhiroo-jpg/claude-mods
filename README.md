# claude-mods

Claude Code 用の mod 集です。

## 収録している mod

| mod | 内容 |
| --- | --- |
| `usage-band` | プロンプトの上に、コンテキスト使用率（CTX）・5時間枠（5H）・週間枠（7D）の使用量と、EFFORT（思考レベル）の切り替えを表示します |

## 導入方法

### 組織で一括導入（管理者向け）

claude.ai の **組織設定 › Claude Code › Managed settings** に次を設定します。各メンバーの次回のセッション開始時に自動で入ります。

```json
{
  "extraKnownMarketplaces": {
    "atawara-mods": {
      "source": { "source": "github", "repo": "dhiroo-jpg/claude-mods" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "usage-band@atawara-mods": true
  }
}
```

### 個人で導入

ターミナルで `claude` を開き、次を入力します（マーケットプレイスの追加は `y`、範囲は user を選択）。

```
/plugin install usage-band --marketplace dhiroo-jpg/claude-mods
```

## usage-band の見方

- **CTX**：今の会話のコンテキスト使用率
- **5H / 7D**：5時間枠・週間枠の使用率とリセットまでの残り時間（70%以上で黄、90%以上で赤）
- **EFFORT**：点を押すと思考レベルを切り替え。↺ で既定に戻す
- **◀ ▶**：カードが入りきらないときのページ切り替え
- **更新**：数値を今すぐ取り直す
- **アプリ設定**：claude.ai の使用量ページを開く
