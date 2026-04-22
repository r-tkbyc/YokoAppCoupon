# YokoAppCoupon 流し込みツール 仕様書

高島屋アプリクーポンのCMS入稿を効率化するツール。  
GitHub Pages 上のフォームで入力・整形し、Chrome拡張経由でCMS（Mantine UI）へ自動入力する。

---

## バージョン

| コンポーネント | バージョン | 更新日 |
|---|---|---|
| index.html（ツール本体） | v1.2.0 | 2026-04-22 |
| Chrome拡張（YokoAppCoupon to CMS） | v1.1.6 | — |

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

**日時パース規則:**
- 対応形式: `YYYY/MM/DD HH:mm`, `M/D`, `M月D日`, `YYYY-MM-DD` など柔軟にパース
- 曜日（括弧内）は自動除去
- 年省略時は基準年（デフォルト: 2026）を使用
- 終了が開始より月日が前の場合、翌年として扱う（年跨ぎ対応）
- 各入力欄に📅ピッカーあり（`datetime-local`）

**隠しフィールド:**
- `dtPublishEndOut`: 公開期間終了（`dtEndOutCombined` と同値）
- `dtUsableEndOut`: 利用可能期間終了（`dtEndOutCombined` と同値）

---

## テキスト変換ルール（`transform()` パイプライン）

`rulesGlobal` 配列に登録された関数が順に適用される。

| # | 関数名 | 処理内容 |
|---|---|---|
| 1 | `urlProtect` | URLを退避（変換の影響を受けないようにプレースホルダに置換） |
| 2 | `siCompatUnits` | Unicode合字単位を分解（㎝→cm, ㎖→ml, ㎜→mm） |
| 3 | `fullwidthBracketsAndWave` | `[ ]` → `［ ］`、`~` `〜` → `～`、`→` → `～` |
| 4 | `lexicalReplacements` | 語彙統一（POPUP→POP UP, 是非→ぜひ, 髙島屋→高島屋 等） |
| 5 | `widthNorm` | 英数字→半角、記号→全角。括弧類の正規化。英数字間の記号は半角維持 |
| 6 | `fixTelColon` | `TEL:` / `TEL：` → `TEL：` |
| 7 | `spaceBreak` | 連続スペース→1つ、3行以上の連続空行→2行 |
| 8 | `ensureZenkakuSpaceBeforePrice` | 金額前の全角スペース挿入（現在無効: `PRICE_SPACE_RULE_ENABLED = false`） |
| 9 | `urlRestore` | 退避URLを復元 |

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

---

## クリア動作

右上のバージョンバッジ（`#ver`）クリックで全フィールドをリセット。

- 全 `input`, `textarea`, `select` を初期化（`data-persist="1"` を除く）
- デフォルト復帰:
  - カテゴリ → アプリクーポン
  - 配布方法 → 全員に配布
  - 基準年 → 2026
  - 会員ひとりが利用可能な回数 → 1

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
