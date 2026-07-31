# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

高島屋アプリクーポンのCMS入稿を効率化するツール。GitHub Pages 上の単一HTMLフォームでテキストを整形し、Chrome拡張（Manifest V3）経由で別タブのCMS（Mantine UI）へ自動入力する。

**`README.md` が正式な仕様書**（変換ルール表・ブロック別の入出力・CMSフィールドマッピングを網羅）。仕様の詳細はそちらを参照し、このファイルには重複させない。仕様に影響する変更を入れたら README も同時に更新すること。

## ビルド・テスト

ビルドシステム・パッケージマネージャ・npm は**存在しない**。`package.json` も CI もない。ソースはそのまま実行される。

- `index.html` … 単一ファイル（インラインCSS + インラインJS）。ローカルでブラウザに直接開けば変換ロジックの確認は可能
- デプロイ … `main` へ push すると GitHub Pages（https://r-tkbyc.github.io/YokoAppCoupon/）へ自動反映
- 拡張 … `chrome://extensions` で `YokoAppCoupon to CMS/` を「パッケージ化されていない拡張機能を読み込む」

**日時パースだけ自動テストがある。** 日時に触ったら必ず流すこと。

```powershell
.\tests\run.ps1     # 全通過で終了コード0
```

`index.html` にテストスクリプトを差し込んだ一時HTMLを作り、ヘッドレスChrome（無ければEdge）の `--dump-dom` で結果を回収する仕組み。新しい日時の書き方を見つけたら `tests/datetime-corpus.js` の `CORPUS` に1行足す。

それ以外（CMS連携・一括ペーストなど）は**実機での手動テスト**が前提。同じヘッドレスChrome方式で使い捨ての検証ハーネスを組むと確認が早い（`_harness.html` を作って `--dump-dom` → 結果を `<pre>` から取り出す）。

⚠️ **`.ps1` は UTF-8 BOM付きで保存すること。** Windows PowerShell 5.1 は BOM が無いと ANSI として読むため、日本語コメントが文字化けしてパースエラーになる。Write ツールは BOM 無しで書くので、書いた後に付け直しが必要。

### 拡張ファイルを変更したときの反映手順

`background.js` / `koma_inject.js` / `cms_inject.js` / `manifest.json` を編集したら、以下を**必ずユーザーに案内する**（1つでも欠けると古いコードが動き続ける）：

1. `chrome://extensions` で拡張を再読み込み
2. CMSタブを再読み込み（content script の再注入）
3. GitHub Pagesタブを再読み込み（`koma_inject.js` の再注入）

## アーキテクチャ

### 3ホップのメッセージフロー

```
index.html            koma_inject.js          background.js           cms_inject.js
(GitHub Pages)   →    buildPayload()     →    CMSタブ探索・中継   →    Mantine UIへ入力
                      #btn-toCMS を注入       /store-coupons*
```

全ホップが `MSG_TYPE = "YK_COUPON_TO_CMS"` という同一定数を**各ファイルで独立に再定義**している。変更する場合は3ファイル同時に。

`background.js` はサービスワーカーなので、送信先タブに content script が載っていない場合（`"Receiving end does not exist"`）は `chrome.scripting.executeScript` で `cms_inject.js` を動的注入してリトライする。この救済パスがあるため、CMSタブの再読み込みを忘れても動くことがある——が、確実ではない。

### 「出力欄が契約」パターン

`koma_inject.js` は入力欄ではなく**変換後の出力欄（`.output-*`）から値を読む**。つまり「変換」ボタンを押していない状態で toCMS を押すと空の値が飛ぶ。この設計のため、出力欄の DOM クラス名・ID は koma_inject 側との暗黙のインターフェースになっている。

例外的に ID から直接読む項目：`#division` `#firstCome` `#displayGroup` `#category` `#distributionMethod` `#sortPriority` `#perMemberLimit` `#overallTotal` `#overallLimit`。

## 変更時に壊れやすい結合

以下はいずれも複数ファイルを読まないと気づけない箇所。

### 1. 日時の受け渡しは隠しinput `#dtUsableEndOut` が担っている

`koma_inject.js` の `pickValueByIds()` は環境差に備えて ID 候補リストを総当たりする。終了日時（`publishEnd` / `usableEnd` 両方）の候補リストは：

```js
["dtEndOut","dtEndOutBoth","dtBothEndOut","dtPubEndOut","dtUsableEndOut","dtAvailEndOut","dtEndOutAll"]
```

`index.html` に実在するのはこのうち **`dtUsableEndOut` だけ**。画面に見えている `#dtEndOutCombined` も `#dtPublishEndOut` も候補に入っていない（`dtPubEndOut` ≠ `dtPublishEndOut`）。

つまり `index.html:463-464` の「互換用」とコメントされた display:none の隠しinput 2つは飾りではなく、**`#dtUsableEndOut` が終了日時の唯一の伝達経路**。削除するとCMSへの終了日時流し込みがサイレントに失敗する。ID をリネームする場合は候補リストも合わせて直すこと。

### 2. 日時パースは `transform()` から切り離してある（戻さないこと）

v1.4.0 以前は `parseDateTimeLoose()` が内部で `transform()` を呼んでいたが、**意図的に外した**。`widthNorm` が ` / ` を全角 `／` に変えるため `8 / 15` が読めない、といった副作用しか無かったため。日時専用の `normalizeDateTimeText()` を使う。

「共通化できそう」と見えるが**戻さないこと**。テキスト整形と日時正規化は要件が逆方向（前者は記号を全角に寄せ、後者は半角に寄せる）。

日時パースの構造は 正規化 → **日付抽出して文字列から除去** → 残りから時刻抽出、の3段。この順序が要で、`8-15`（月日）と `17-00`（時分）を取り違えないための仕掛け。順序を変えないこと。

もう1つの落とし穴：括弧の注記（曜日）を除去するとき **空文字ではなくスペースに置換**している。空文字だと `9/6(日)10:00` が `9/610:00` になり「9月61日」と誤読される（実際に報告された不具合）。

### 3. CMS側はラベル文字列とMantineクラス名に依存

`cms_inject.js` は CMS の DOM を日本語ラベルテキスト（`findInputByLabelText` 等）と `.mantine-*` クラス名で探索する。CMS の UI 更新や文言変更で壊れる。セレクタに何段もフォールバックが積んであるのはそのため——安易に「重複してるから」と整理しないこと。

ラベルの表記ゆれに注意：ツール側は**並び替え**優先度、CMS側は**並べ替え**優先度。

`findLabelElementIncludes` は部分一致で**最初にヒットしたラベル**を返すため、CMS に似た名前のフィールドが増えると誤爆する。誤爆しやすいものには `...Strict`（`startsWith` / 完全一致）版を使っている。

### 4. バージョン番号は5箇所

同期が必要：

| 箇所 | 内容 |
|---|---|
| `index.html:7` | HTMLコメント |
| `index.html:8` | `<meta name="app-version">` |
| `index.html:492-493` | `APP_VERSION` / `APP_BUILD` ← 画面右上のバッジはここを表示 |
| `manifest.json:4` | 拡張のバージョン（index.html とは独立に採番） |
| `README.md` バージョン表 | 両方 |

### 5. 入力欄を追加すると一括ペーストの順序が変わる

Excel複数セルの一括ペースト（index.html 末尾のIIFE）は、対象欄を**ハードコードせずDOM順に自動列挙**する。除外は `readonly`／`disabled`／select／`datetime-local`／非表示／`data-nopaste="1"`。挙動としては正しいが、**`index.html` に新しい入力欄を足すと、その位置に応じて流し込み順が黙って変わる**。欄を追加・並べ替えたら README の流し込み順テーブルも更新すること。

`data-nopaste="1"`（`data-persist="1"` と同じくHTML側に宣言）が付いているのは `#perMemberLimit` `#sortPriority` `#overallTotal` の3つ。前2つは毎回保持する運用、`#overallTotal` は先着人数から自動反映されるため。**業務上の意図なので、DOM上「自由入力欄だから」という理由で対象に戻さないこと。**

number欄には安全装置がある（`NUM_CELL_OK`）。数字・区切り・簡単な単位以外を含むセルは**入れずに空のまま警告**する。`1階 化粧品` から数字だけ拾って `先着人数=1` になる「もっともらしい誤り」を防ぐためのもので、緩めないこと。

### 6. `host_permissions` / `matches` が本番URL固定

`manifest.json` は `https://r-tkbyc.github.io/YokoAppCoupon/*` と `https://front-admin.taspapp.takashimaya.co.jp/store-coupons*` のみを対象にしている。`index.html` をローカル（`file://` や localhost）で開いても **toCMSボタンは出ない**。拡張の挙動を試すにはデプロイするか、manifest の `matches` を一時的に書き換える必要がある。

## 実装上の規約

- **CMS側は既存値を上書きしない。** フィールドごとに条件が異なる（空欄のみ／`""` or `"0"` のみ／プレースホルダのみ）。詳細は README のマッピング表。この不変条件のおかげで toCMS は冪等に再実行でき、部分的に埋まったフォームの穴埋めに使える。壊さないこと。
- **React controlled component への入力は `setNativeValue()` 経由。** プロトタイプの value setter を取り出して呼び、`input` / `change` を bubbles で発火する。`el.value = x` の直代入では React の state が更新されない。
- UI文言・コメント・変数名の日本語混在は既存スタイル。踏襲する。
- `Ignored files/` は `.gitignore` 済みの日付付きバックアップ置き場（`bk-YYYYMMDD/`）。過去バージョンの実装を参照したいときに使える。
- コミットメッセージは `update` / `Update <filename>` 程度の運用。
