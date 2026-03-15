# サンプルデータ（Firebase Consoleから手動で追加）

## `workers` コレクション

以下のドキュメントを Firebase Console > Firestore > `workers` コレクションに追加してください。

### ドキュメント例1
```json
{
  "name": "山田 太郎",
  "nameKana": "やまだ たろう",
  "type": "senior",
  "employmentType": "fulltime",
  "qualifications": "麻酔科専門医",
  "skills": ["全身麻酔", "硬膜外麻酔", "脊髄くも膜下麻酔"],
  "comment": "医局長"
}
```

### ドキュメント例2
```json
{
  "name": "佐藤 花子",
  "nameKana": "さとう はなこ",
  "type": "resident",
  "employmentType": "fulltime",
  "qualifications": "",
  "skills": ["全身麻酔"],
  "comment": "専攻医3年目"
}
```

### ドキュメント例3
```json
{
  "name": "鈴木 次郎",
  "nameKana": "すずき じろう",
  "type": "intern",
  "employmentType": "fulltime",
  "qualifications": "",
  "skills": [],
  "comment": "初期研修医ローテーション"
}
```

### ドキュメント例4
```json
{
  "name": "田中 美子",
  "nameKana": "たなか よしこ",
  "type": "parttime",
  "employmentType": "parttime",
  "qualifications": "麻酔科専門医",
  "skills": ["全身麻酔", "硬膜外麻酔"],
  "comment": "毎週火曜・木曜"
}
```

## フィールド説明

### `workers` コレクション
| フィールド | 型 | 値の例 |
|---|---|---|
| name | string | "山田 太郎" |
| nameKana | string | "やまだ たろう"（ソート用） |
| type | string | senior / resident / intern / dental / parttime / nurse / observer |
| employmentType | string | fulltime / parttime |
| qualifications | string | "麻酔科専門医" |
| skills | array | ["全身麻酔", "硬膜外麻酔"] |
| comment | string | 自由記述 |

### `shifts` コレクション（自動生成）
| フィールド | 型 | 値の例 |
|---|---|---|
| workerId | string | workerドキュメントのID |
| date | string | "2026-03-14" |
| startTime | string | "08:30" |
| endTime | string | "17:15" |
| location | string | or / preop / pain / student / lecture |

### `leaves` コレクション（自動生成）
| フィールド | 型 | 値の例 |
|---|---|---|
| workerId | string | workerドキュメントのID |
| date | string | "2026-03-14" |
| leaveType | string | paid / compensatory / conference / sick / other |
| note | string | "日本麻酔科学会" |

### `outsideWork` コレクション（自動生成）
| フィールド | 型 | 値の例 |
|---|---|---|
| workerId | string | workerドキュメントのID |
| date | string | "2026-03-14" |
| destination | string | "○○クリニック" |
| note | string | 備考 |

### `absences` コレクション（自動生成）
| フィールド | 型 | 値の例 |
|---|---|---|
| workerId | string | workerドキュメントのID |
| date | string | "2026-03-14" |
| startTime | string | "13:00" |
| endTime | string | "14:00" |
| reason | string | "会議" |
