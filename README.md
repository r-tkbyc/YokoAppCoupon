# YokoAppCoupon 流し込みツール 仕様書

高島屋アプリクーポンのCMS入稿を効率化するツール。  
GitHub Pages 上のフォームで入力・整形し、Chrome拡張経由でCMS（Mantine UI）へ自動入力する。

---

## バージョン

| コンポーネント | バージョン | 更新日 |
|---|---|---|
| index.html（ツール本体） | v1.4.0 | 2026-07-31 |
| Chrome拡張（YokoAppCoupon to CMS） | v1.2.2 | 2026-08-21 |

---

## ファイル構成

```
YokoAppCoupon/
├── index.html                     … ツール本体（GitHub Pages）
├── YokoAppCoupon to CMS/          … Chrome拡張機能（Manifest V3）
│   ├── manifest.json              … 拡張定義
│   ├── koma_inject.js             … GitHub Pages側 Content Script
│   ├── background.js              … Service Worker（メッセージ中継）
│   └── cms_inject.js              … CMS側 Content Script
├── tests/                         … 自動テストと診断スクリプト
│   ├── run.ps1                    … 日時パースの回帰テスト
│   ├── datetime-corpus.js         … 日時のテストケース
│   ├── cms-run.ps1                … cms_inject.js の反映テスト
│   ├── cms-harness.html           … 上記が使うMantineモックフォーム
│   ├── cms-probe.js               … CMS実画面用の診断（コンソール貼り付け）
│   └── cms-probe-numberinput.js   … 同上（NumberInput特化）
├── YokoAppCoupon流し込みツール.url  … GitHub Pagesショートカット
├── .gitattributes                 … 改行コード自動正規化
├── .gitignore                     … 「Ignored files」フォルダを除外
└── README.md                      … 本ファイル（仕様書）
```

---

## 動作フロー

```
GitHub Pages (index.html)          Chrome拡張                    CMS
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ 入力 → 変換ボタン     │     │                     │     │                     │
│ → 整形結果が出力欄に  │     │                     │     │                     │
│                     │     │                     │     │                     │
│ toCMSボタン押下 ─────┼──→  │ koma_inject.js      │     │                     │
│ （ペイロード構築）     │     │ → background.js ────┼──→  │ cms_inject.js       │
│                     │     │   （CMSタブ探索・中継）│     │ → Mantine UIに自動入力│
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

1. `index.html` でフォームに値を入力し「変換」ボタンで整形
2. Chrome拡張 `koma_inject.js` が追加した「toCMS」ボタンをクリック
3. `background.js` がCMSタブ（`/store-coupons*`）を探してメッセージを中継
4. `cms_inject.js` がCMS上のMantine UIフォームに自動入力

---

## ブロック構成と入出力

### 1. タイトル / 管理名称 （`data-set="title"`）

| 要素 | 種別 | 説明 |
|---|---|---|
| 入力 | textarea `.input` | 元テキストをペースト |
| 出力（タイトル） | textarea `.output-title` | `transform()` 適用結果。先着人数があれば `※先着N名様` を付加 |
| 出力（管理名称） | textarea `.output-admin` | 部門プレフィックス ＋ タイトル結果 |
| 変換ボタン | button `.btn-convert` | 全ブロックの変換を一括実行（Ctrl/Cmd+Enter でも発火） |
| toCMSボタン | button `#btn-toCMS` | 拡張（koma_inject.js）が動的に挿入 |

### 2. 部門 / 先着人数 / 表示グループ / カテゴリ （`data-set="meta"`）

4列グリッド（`quad-row`）。

| フィールド | ID | 種別 | 選択肢・備考 |
|---|---|---|---|
| 部門 | `division` | select | ①〜⑤, 呉服, 美術 |
| 先着人数 | `firstCome` | number | 変換時に全体利用回数制限へ自動反映 |
| 表示グループ | `displayGroup` | select | ビューティー, キャンペーン, 催・イベント, ファッション, グルメ, キッズ, ライフスタイル |
| カテゴリ | `category` | select | アプリクーポン（デフォルト）, アプリ会員様限定ポイントアップ |

### 3. フロア・売場 / ブランド名 （`data-set="floor-brand"`）

2段×2列（`row`）。

| 要素 | 種別 | 説明 |
|---|---|---|
| 入力（フロア・売場） | textarea `.input-floor` | 例: `1階 化粧品` |
| 出力（ブランド入居フロア） | textarea `.output-floor` | フロア部分のみ抽出（例: `1階`） |
| 入力（ブランド名） | textarea `.input-brand` | 例: `エスト` |
| 出力（ブランド名） | textarea `.output-brand` | `売場名［ブランド名］` 形式に整形 |

**フロアパース規則:**
- `N階`, `地下N階`, `屋上` をフロアとして抽出
- 残り部分を売場名（place）として扱う

**ブランド名整形規則:**
- 入力に既存の括弧（`［ ］` `[ ]`）がある場合は除去してから `［ ］` で囲む（二重括弧防止）
- 売場名がある場合: `売場名［ブランド名］`
- 売場名がない場合: `［ブランド名］`

### 4. ご利用条件 （`data-set="terms"`）

| 要素 | 種別 | 説明 |
|---|---|---|
| 入力 | textarea `.input-terms` | 元テキスト |
| 出力 | textarea `.output-terms` | `transform()` 適用結果 |

### 5. 注意事項 （`data-set="notes"`）

| 要素 | 種別 | 説明 |
|---|---|---|
| 入力 | textarea `.input-notes` | 元テキスト |
| 出力 | textarea `.output-notes` | `transform()` 適用結果 |

### 6. クーポン利用条件 （`data-set="usage"`）

5列グリッド（`quint-row`）。

| フィールド | ID | 種別 | デフォルト | 備考 |
|---|---|---|---|---|
| 会員ひとりが利用可能な回数 | `perMemberLimit` | number | 1 | — |
| 全体の利用回数制限 | `overallLimit` | select | なし | なし / あり |
| 全体で利用可能な回数 | `overallTotal` | number | （空） | 変換時に先着人数から自動反映 |
| 配布方法 | `distributionMethod` | select | 全員に配布 | 5択（下記参照） |
| 並び替え優先度 | `sortPriority` | number | （空） | 0〜99の整数 |

**配布方法の選択肢:**
1. 全員に配布
2. 会員ユーザーに条件を指定して配布
3. 仮会員ユーザーに条件を指定して配布
4. 会員ユーザーに会員統合 ID を指定して配布
5. 会員ユーザーに二次元コード・URLで配布

**先着人数からの自動反映:**
- 先着人数 ≥ 1 → 全体の利用回数制限 = あり、全体で利用可能な回数 = 先着人数
- 先着人数が空 or 0 → 全体の利用回数制限 = なし、全体で利用可能な回数 = 空

### 7. 日時設定 （`data-set="datetime"`）

3段×2列（`row`）。基準年セレクト付き。

| 入力 | ID | 出力 | ID | 説明 |
|---|---|---|---|---|
| 開始日時 | `dtStartIn` | 利用可能期間 / 開始日時 | `dtUsableStartOut` | 時刻なし → 10:00 |
| 終了日時 | `dtEndIn` | 公開期間・利用可能期間 / 終了日時 | `dtEndOutCombined` | 時刻なし → 20:00。公開・利用共通 |
| 配布希望日時 | `dtWishIn` | 公開期間 / 開始日時 | `dtPublishStartOut` | 未記入 → 開始の1日前 17:00 |

- 年省略時は基準年（デフォルト: 2026）を使用
- 終了が開始より月日が前の場合、翌年として扱う（年跨ぎ対応）
- 各入力欄に📅ピッカーあり（`datetime-local`）

**隠しフィールド:**
- `dtPublishEndOut`: 公開期間終了（`dtEndOutCombined` と同値）
- `dtUsableEndOut`: 利用可能期間終了（`dtEndOutCombined` と同値）

---

## 日時パース（v1.4.0〜）

100人以上の担当者がExcelへフリー入力するため、書き方のゆれを3段構えで吸収する。

```
① 正規化   全角/区切り/括弧注記/ダッシュを統一
② 日付抽出 見つけた日付を文字列から取り除く
③ 時刻抽出 日付を除いた「残り」だけを見る
```

②で日付を先に取り除くのが要。これにより `8-15`（月日）と `17-00`（時分）を同じ形のまま取り違えずに済む。

**`transform()` は通さない。** テキスト整形用の `widthNorm` が ` / ` を全角 `／` に変えてしまい `8 / 15` が読めなくなるなど、日時にとっては副作用しかないため。日時専用の `normalizeDateTimeText()` を使う。

### 対応する書き方

| 分類 | 例 |
|---|---|
| 日付・スラッシュ | `8/15` `08/15` `2026/8/15` `8 / 15` `8／15` |
| 日付・その他区切り | `8-15` `8.15` `2026-08-15` `2026.8.15` |
| 日付・和文 | `8月15日` `8月15` `2026年8月15日` |
| 日付・全角 | `８／１５` `８月１５日` `２０２６年８月１５日` |
| 元号 | `R8/8/15` `令和8年8月15日` `H31.2.18` |
| 曜日つき | `8/15(土)` `8/15（土）` `8/15土` `8/15[土]` |
| 時刻 | `17:00` `17：00` `17:0` `17.00` `17-00` `17:00:00` |
| 和文時刻 | `17時` `17時00分` `17時30分` `17時半` |
| 午前午後 | `午前10時` `午後5時` `午後5:00` `PM5:00` `5:00PM` |
| 付帯文字・範囲 | `17:00開始` `17:00より` `※8/15 17:00` `8/15～8/20`（先頭を採用） |

`午後12時` → 12:00（正午）、`午前12時` → 0:00。時刻を書かなければ既定値（開始10:00 / 終了20:00 / 配布希望17:00）。

### 読めなかったときの扱い

**黙って空にしない。** すり抜けを担当者が気づけないと、誤った日時のままCMSへ流れてしまうため。

| 状況 | 挙動 |
|---|---|
| 日付が読めない | その欄だけ空にし、**入力欄を赤枠**＋トーストで欄名を名指し（`日時が読み取れません：終了日時`） |
| 日付は読めるが時刻が不正（`26:00` など） | 日付は活かして時刻は既定値。**赤枠＋警告**（`時刻が読めず既定値を使用：終了日時`） |
| そもそも時刻の記述が無い（`8/15`） | 既定値。警告しない（誤警告するとオオカミ少年になるため） |
| 1つの欄が読めない | **他の欄の出力は消さない**（v1.3.0以前は全部クリアしていた） |

### 回帰テスト

新しい書き方を見つけたら `tests/datetime-corpus.js` の `CORPUS` に1行足して実行する。

```powershell
.\tests\run.ps1
```

ヘッドレスChrome（無ければEdge）で `index.html` を実際に開き、パース80件＋警告フラグ7件＋変換ボタンのend-to-end 7件を検証する。全通過で終了コード0。

---

## Excel複数セルの一括ペースト（v1.3.0〜）

Excelで複数セルを選択してコピーし、**任意の入力欄にペーストすると、その欄を起点に下の欄へ順に流し込む**。1セルずつコピペする手間をなくすための機能。

### 流し込み順

| # | 欄 | 種別 |
|---|---|---|
| 1 | タイトル / 管理名称（入力） | textarea |
| 2 | 先着人数 | number |
| 3 | フロア・売場（入力） | textarea |
| 4 | ブランド名（入力） | textarea |
| 5 | ご利用条件（入力） | textarea |
| 6 | 注意事項（入力） | textarea |
| 7 | 開始日時 | text |
| 8 | 終了日時 | text |
| 9 | 配布希望日時 | text |

### 対象外の欄と理由

| 欄 | 除外の仕組み | 理由 |
|---|---|---|
| 部門 / 表示グループ / カテゴリ / 全体の利用回数制限 / 配布方法 / 基準年 | select（型で自動除外） | プルダウン選択のため |
| 会員ひとりが利用可能な回数 / 並び替え優先度 | `data-nopaste="1"` | `data-persist="1"` で毎回保持する運用のため |
| 全体で利用可能な回数 | `data-nopaste="1"` | 先着人数から自動反映されるため |
| 出力欄 / 📅ピッカー / 互換用の隠しinput | readonly・datetime-local で自動除外 | — |

対象欄はDOM順に自動列挙され、ハードコードした一覧は持たない。個別に外したい欄は HTML に `data-nopaste="1"` を付ける。逆に **`index.html` に入力欄を追加すると、その位置に応じて流し込み順が自動的に変わる**点に注意。

### セル境界の判定

| 経路 | 条件 | 挙動 |
|---|---|---|
| `text/html` | クリップボードに `<table>` がある（Excel等） | テーブルのセル単位で分割。**主経路** |
| `text/plain` | **タブを含む**場合のみ | TSVとして分割（`"` 引用・`""` エスケープ対応） |
| 上記以外 | — | **分割しない**（従来どおり1欄にペースト） |

改行のみを含む通常テキスト（Excel以外からのコピー、セル内改行を含む単一セル）を複数欄にバラまいてしまう事故を防ぐため、**タブが無ければ分割しない**設計。セル内に改行やタブが含まれていても、html経路・引用符付きTSVのどちらでも1セルとして保たれる。

### 安全装置

- **number欄への非数値の流し込みを拒否する。** 対象欄のうち number は `先着人数` のみ。ここに `1階 化粧品` のようなセルが来たとき、数字だけ拾うと `1` になり「もっともらしい誤り」が静かに通ってしまう（さらに変換時、全体の利用回数制限＝あり／全体回数＝1 まで自動反映される）。数字・区切り・簡単な単位（`名` `様` `人` `回` `件` `個`）以外を含むセルは**入れずに空のまま**にし、トーストで欄名を警告する。Excelの列順とツールの欄順がずれているサインとして使える。
- セル数が残りの欄数を超えた場合、超過分は破棄してトーストで件数を通知する。
- 流し込み後に**自動変換はしない**。従来どおり「変換」ボタン（Ctrl/Cmd+Enter）で整形する。
- トーストは `3件を流し込みました（フロア・売場 → ご利用条件）` のように起点と終点の欄名を出す。意図した範囲に入ったかを毎回確認できる。

---

## テキスト変換ルール（`transform()` パイプライン）

`rulesGlobal` 配列に登録された関数が順に適用される。

| # | 関数名 | 処理内容 |
|---|---|---|
| 1 | `stripWrappingQuotes` | 前後のダブルクオーテーション・空行・スペースを除去（Excelセル内改行コピペ対策） |
| 2 | `urlProtect` | URLを退避（変換の影響を受けないようにプレースホルダに置換） |
| 3 | `siCompatUnits` | Unicode合字単位を分解（㎝→cm, ㎖→ml, ㎜→mm） |
| 4 | `fullwidthBracketsAndWave` | `[ ]` → `［ ］`、`~` `〜` → `～`、`→` → `～` |
| 5 | `lexicalReplacements` | 語彙統一（POPUP→POP UP, 是非→ぜひ, 髙島屋→高島屋 等） |
| 6 | `widthNorm` | 英数字→半角、記号→全角。括弧類の正規化。英数字間の記号は半角維持 |
| 7 | `fixTelColon` | `TEL:` / `TEL：` → `TEL：` |
| 8 | `spaceBreak` | 連続スペース→1つ、3行以上の連続空行→2行 |
| 9 | `ensureZenkakuSpaceBeforePrice` | 金額前の全角スペース挿入（現在無効: `PRICE_SPACE_RULE_ENABLED = false`） |
| 10 | `urlRestore` | 退避URLを復元 |

### 語彙置換一覧（`lexicalReplacements`）

| 変換前 | 変換後 |
|---|---|
| POPUPSTORE | POP UP STORE |
| POPUPSHOP | POP UP SHOP |
| POPUP | POP UP |
| 是非 | ぜひ |
| くださいませ | ください |
| お買い上げ / お買いあげ | お買上げ |
| 致します | いたします |
| ラインナップ | ラインアップ |
| 髙島屋 | 高島屋 |

### 全角⇔半角ルール（`widthNorm`）

- 英字（A-Z, a-z）: **半角**
- 数字（0-9）: **半角**
- 記号（ASCII記号）: **全角**（ただし英数字に挟まれた記号は半角維持）
- 括弧: `()` → `（）`, `[]` → `［］`, `{}` → `｛｝`, `<>` → `〈〉`, `≪≫` → `《》`, `【】` → `〔〕`
- `*` / `＊` → `※`
- ダッシュ類（英数字間）: `-` に統一

---

## CMS連携（Chrome拡張）

### ペイロード構造（`koma_inject.js` → `cms_inject.js`）

```javascript
{
  type: "YK_COUPON_TO_CMS",
  payload: {
    title,            // タイトル（出力値）
    adminName,        // 管理名称（出力値）
    division,         // 部門
    firstCome,        // 先着人数
    displayGroup,     // 表示グループ
    category,         // カテゴリ
    brandFloor,       // ブランド入居フロア（出力値）
    brandName,        // ブランド名（出力値）
    terms,            // ご利用条件（出力値）
    notes,            // 注意事項（出力値）
    publishStart,     // 公開期間 開始
    publishEnd,       // 公開期間 終了
    usableStart,      // 利用可能期間 開始
    usableEnd,        // 利用可能期間 終了
    distributionMethod, // 配布方法
    sortPriority,     // 並び替え優先度
    perUser,          // 会員ひとりが利用可能な回数
    totalLimitEnabled,// 全体の利用回数制限（boolean）
    totalCount        // 全体で利用可能な回数
  }
}
```

### CMS側フィールドマッピング（`cms_inject.js`）

| ペイロードキー | CMSラベル | 入力方式 | 上書き条件 |
|---|---|---|---|
| `title` | タイトル | TextInput `setNativeValue` | 空欄のみ |
| `adminName` | 管理名称 | TextInput `setNativeValue` | 空欄のみ |
| `displayGroup` | 表示グループ | Mantine Select | — |
| `category` | カテゴリ | Mantine Select | — |
| `distributionMethod` | 配布方法 | Mantine Select（Strict） | — |
| `publishStart` / `publishEnd` | 公開期間 | DateTimePicker（Popover操作） | プレースホルダのみ |
| `usableStart` / `usableEnd` | 利用可能期間 | DateTimePicker（Popover操作） | プレースホルダのみ |
| `brandFloor` | ブランド入居フロア | TextInput `setNativeValue` | 空欄のみ |
| `brandName` | ブランド名 | TextInput `setNativeValue` | 空欄のみ |
| `terms` | ご利用条件 | RichText（ProseMirror） | 空のみ |
| `notes` | 注意事項 | RichText（ProseMirror） | 空のみ |
| `sortPriority` | 並べ替え優先度 | NumberInput | `""` or `"0"` のみ |
| `perUser` | 会員ひとりが利用可能な回数 | NumberInput | `""` or `"1"` のみ |
| `totalLimitEnabled` | 全体の利用回数制限 | Switch | トグル |
| `totalCount` | 全体で利用可能な回数 | NumberInput | `""` or `"1"` のみ |

**注意:** ツール側の表記は「並び替え優先度」、CMS側のラベルは「並べ替え優先度」。

### 反映結果レポート（拡張 v1.2.0〜）

toCMS の結果を項目ごとに残す。以前は成否を真偽値ひとつに潰していたため、
入らなかったときに「欄が無い」のか「既存値があるので飛ばした」のか「入れたが消された」のかが
区別できなかった。

| 結果 | 意味 | 対処 |
|---|---|---|
| `入力` | 実際に書き込んだ | — |
| `skip:値なし` | ツール側が空だった | ツール側に値を入れて変換し直す |
| `skip:既存値あり` | CMS側に既に値があるので触っていない（**正常**） | 上書きしたいなら手でCMS側を空にする |
| `NG:欄が見つからない` | ラベルからCMSの入力欄を辿れなかった | CMSのUI変更を疑う。`tests/cms-probe.js` で調査 |
| `NG:選択肢「◯◯」が無い` | Selectに該当する選択肢が無い | ツール側の選択肢とCMS側の選択肢がズレている |
| `NG:入れたが戻された` | 書き込み後にCMS側が値を消した | 1回自動で入れ直した上でなお消えた場合に出る |
| `NG:カレンダーが開かなかった` 等 | 日時ピッカーの操作に失敗 | 日時のどの段階で落ちたかが文言に出る |

- **未反映が1件でもあれば、CMS画面右下のトーストに項目名と理由を9秒間表示する。**
  すべて成功した場合のみ従来どおり「入力しました」。
- 全項目の内訳は CMSタブのコンソール（F12）に `[toCMS] 反映結果` として `console.table` で出る。
- `NG:入れたが戻された` には**必ず期待値と実際値を添える**（`期待="…" 実際="…"`）。
  これが無いと「本当に消された」のか「検証側の誤判定」なのかが区別できない。
- 書き込み後は 0.7 秒待って値が残っているか確認し、消えていれば**1回だけ自動で入れ直す**。
  CMS側のフォーム初期化が後から走って値を消すケースの保険。

**検証時の注意（v1.2.1 で修正）:** `<input type="text">` は HTML の value sanitization で
CR/LF を落とす。タイトル・管理名称はツール側の `textarea`（`.output-title` 等）由来で
改行が混ざりうるため、期待値をそのまま比較すると必ず「戻された」と誤判定する。
`expectedIn()` で期待値側からも改行を落として比較している。

### CMSへ合成イベントを送るときの注意

1. `closeAllPopovers()` の keydown は **`document` から dispatch してはいけない**。
   `event.target` が `document` になり、CMSが `document` に直付けしているハンドラ内の
   `t?.hasAttribute(...)` が `hasAttribute is not a function` で落ちる
   （`?.` は null/undefined しか防げず、関数でない場合は素通りする）。
   Element から投げれば bubbles で `document` まで届くので効果は同じ。
2. そもそも**開いているポップオーバーが無いときは何も送らない**（`anyPopoverOpen()` でガード）。
   合成イベントを送ることは相手のハンドラを踏む行為なので、必要な時だけにする。

---

## クリア動作

右上のバージョンバッジ（`#ver`）クリックで部分リセット。完全リセットはブラウザ再読み込みで対応。

**保持する項目（`data-persist="1"`）:**
- 部門（`#division`）
- 表示グループ（`#displayGroup`）
- カテゴリ（`#category`）
- 会員ひとりが利用可能な回数（`#perMemberLimit`）
- 並び替え優先度（`#sortPriority`）

**クリア対象:** 上記以外の全 `input`, `textarea`, `select`

**クリア後のデフォルト復帰:**
- 配布方法 → 全員に配布
- 基準年 → 2026
- 全体の利用回数制限 → なし

---

## Chrome拡張 詳細

### manifest.json

- Manifest V3
- permissions: `tabs`, `scripting`, `activeTab`
- host_permissions: `https://r-tkbyc.github.io/*`, `https://front-admin.taspapp.takashimaya.co.jp/*`

### background.js（Service Worker）

- CMSタブ探索: `/store-coupons*` パターンでタブ検索
- タブ選択: アクティブタブ優先、なければ先頭タブ
- Content Script未ロード時: `cms_inject.js` を動的注入してリトライ
- この救済パスがあるため、`cms_inject.js` は**再注入されうる前提**で書く必要がある（下記）

### 二重注入の防止（v1.2.2〜）

`cms_inject.js` は読み込み時に `window.__YK_CMS_INJECT_DISPOSE__?.()` で
**前のインスタンスの listener を解除してから**自分を登録する。

これをやらないと、`background.js` の救済注入でリスナーが積み上がり、
**toCMS 1回で処理が2回走って日時ピッカーの同じポップオーバーを奪い合う**（実機で発生）。

単純な「読み込み済みフラグ」では不可。拡張だけ再読み込みするとフラグはページに残ったまま
古いインスタンスだけが無効化されるので、新しい方が登録をスキップして救済パスごと死ぬ。

### koma_inject.js（GitHub Pages側）

- 「toCMS」ボタンをタイトルブロックの actions 内に挿入
- クリック時に `buildPayload()` で全出力値を収集しメッセージ送信
- 値の取得: 出力欄（`.output-*`）から取る項目と、IDで直接取る項目がある

### cms_inject.js（CMS側）

- Mantine UI コンポーネント対応:
  - **TextInput**: `setNativeValue`（React controlled component のネイティブsetter経由）
  - **Select**: ラベルからinputを探索 → click → `[role="option"]` から選択
  - **DateTimePicker**: Popover展開 → 月ナビゲーション → 日付クリック → 時刻設定 → 確定ボタン
  - **RichText**: ProseMirror/tiptap の `innerHTML` 直接設定
  - **NumberInput**: `type="text"` + `inputmode="numeric"` のネイティブsetter
  - **Switch**: `input[type="checkbox"][role="switch"]` のclick
- 既存値がある場合は上書きしない（フィールドごとに条件が異なる）
- 反映結果を項目ごとに記録し、未反映があればトーストとコンソールに出す（上記「反映結果レポート」）

---

## テスト

```powershell
.\tests\run.ps1        # 日時パースの回帰テスト（80件＋e2e）
.\tests\cms-run.ps1    # cms_inject.js の反映テスト（要ネットワーク）
```

どちらも `index.html` / `cms_inject.js` を**そのまま**ヘッドレスChrome（無ければEdge）に読ませ、
`--dump-dom` で結果を回収する。全通過で終了コード0。

`cms-run.ps1` は esm.sh から本物の React + Mantine を取ってきてCMSのフォームを模したものを組み、
`chrome.runtime` をスタブして `YK_COUPON_TO_CMS` を1発流す。
日時ピッカーはモックに置いていないため、公開期間／利用可能期間が
`NG:欄が見つからない` になるのが正しい状態（エラー報告が機能していることの確認を兼ねる）。

CMSの実画面が怪しいときは、`tests/cms-probe.js` をCMSタブのコンソールに貼り付けると、
`cms_inject.js` と同じ探索ロジックでどのフィールドがどこで外れているかを一覧で出せる。
ページは読むだけで変更しない。
