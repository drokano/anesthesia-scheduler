import { useState, useRef } from 'react'
import { useWorkers, addWorker, updateWorker, deleteWorker } from '../hooks/useFirestore'
import Toast from '../components/common/Toast'
import { useToast } from '../hooks/useToast'

// ===== 定数 =====
const EMPLOYMENT_TYPES = [
  { value: 'fulltime', label: '常勤' },
  { value: 'parttime', label: '非常勤' },
]

const WORKER_TYPES = [
  { value: 'senior',   label: '専門医' },
  { value: 'resident', label: '専攻医' },
  { value: 'dental',   label: '歯科麻酔科医' },
  { value: 'intern',   label: '初期研修医' },
  { value: 'nurse',    label: '特定行為研修看護師' },
  { value: 'observer', label: '見学者' },
]

const WORKER_TYPE_BADGE = {
  senior:   'badge-blue',
  resident: 'badge-green',
  intern:   'badge-yellow',
  dental:   'badge-purple',
  nurse:    'badge-orange',
  observer: 'badge-gray',
}

const AFFILIATIONS = [
  { value: 'General', label: 'General' },
  { value: 'TCAT',    label: 'TCAT' },
]

const POSITIONS = [
  { value: '',        label: '（未選択）' },
  { value: '教授',    label: '教授' },
  { value: '准教授',  label: '准教授' },
  { value: '講師',    label: '講師' },
  { value: '准講師',  label: '准講師' },
  { value: '助教',    label: '助教' },
  { value: '後期研修医', label: '後期研修医' },
  { value: '初期研修医', label: '初期研修医' },
]

const SHORT_TIME_TYPES = [
  { value: '',    label: 'なし（週39H）' },
  { value: '36h', label: '週36H' },
  { value: '32h', label: '週32H' },
  { value: '28h', label: '週28H' },
  { value: '24h', label: '週24H' },
]

const SKILLS_OPTIONS = [
  '全身麻酔',
  '硬膜外麻酔',
  '脊髄くも膜下麻酔',
  '気管挿管',
  'Aライン留置',
  'CV留置',
  '小児麻酔',
  '心臓血管麻酔',
  '産科麻酔',
  '区域麻酔',
]

const EMPTY_FORM = {
  name: '',
  nameKana: '',
  employmentType: 'fulltime',
  type: 'senior',
  affiliation: 'General',
  position: '',
  shortTimeType: '',
  skills: [],
  comment: '',
  hideFromDutyCalendar: false,
}

// ===== スキルチェックボックス =====
function SkillsCheckboxes({ selected, onChange }) {
  const toggle = (skill) => {
    if (selected.includes(skill)) {
      onChange(selected.filter(s => s !== skill))
    } else {
      onChange([...selected, skill])
    }
  }

  return (
    <div className="skills-grid">
      {SKILLS_OPTIONS.map(skill => (
        <label key={skill} className="skill-checkbox">
          <input
            type="checkbox"
            checked={selected.includes(skill)}
            onChange={() => toggle(skill)}
          />
          <span>{skill}</span>
        </label>
      ))}
    </div>
  )
}

// ===== 追加・編集フォーム（ボトムシート） =====
function WorkerFormSheet({ worker, onClose, onSaved }) {
  // 既存データにないフィールドはEMPTY_FORMのデフォルト値で補完する
  const [form, setForm] = useState(worker ? { ...EMPTY_FORM, ...worker } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()

  // 新規登録時に作成したドキュメントIDをRefで管理（同期的に参照・更新できる）
  const docIdRef = useRef(worker?.id ?? null)
  const buildPayload = (f) => ({
    name: f.name.trim(),
    nameKana: f.nameKana.trim() || f.name.trim(),
    employmentType: f.employmentType ?? 'fulltime',
    type: f.type ?? 'senior',
    affiliation: f.affiliation ?? 'General',
    position: f.position ?? '',
    shortTimeType: f.shortTimeType ?? '',
    skills: f.skills ?? [],
    comment: (f.comment ?? '').trim(),
    hideFromDutyCalendar: f.hideFromDutyCalendar ?? false,
  })

  const autoSave = async (updatedForm) => {
    if (!updatedForm.name.trim()) return
    setSaving(true)
    try {
      const payload = buildPayload(updatedForm)
      if (docIdRef.current) {
        await updateWorker(docIdRef.current, payload)
      } else {
        const ref = await addWorker(payload)
        docIdRef.current = ref.id  // Refは同期的に更新される
      }
      showToast('保存しました', 'success')
      onSaved()
    } catch (err) {
      showToast('保存に失敗しました: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // テキスト入力: onChange で state 更新のみ、onBlur で保存
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const saveOnBlur = (key, val) => {
    const updated = { ...form, [key]: val }
    setForm(updated)
    autoSave(updated)
  }

  // セレクト・チェックボックス: onChange で state 更新 + 即時保存
  const setAndSave = (key, val) => {
    const updated = { ...form, [key]: val }
    setForm(updated)
    autoSave(updated)
  }

  return (
    <>
      {/* オーバーレイ */}
      <div className="sheet-overlay" onClick={onClose} />

      {/* ボトムシート */}
      <div className="sheet">
        <div className="sheet__handle" />
        <div className="sheet__header">
          <span className="sheet__title">
            {worker?.id ? '勤務者を編集' : '勤務者を新規登録'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saving && <span className="autosave-indicator">保存中...</span>}
            <button className="sheet__close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="sheet__body">
          <div className="form-row-pc" style={{ marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">氏名<span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 山田 太郎"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                onBlur={e => saveOnBlur('name', e.target.value)}
                autoFocus
              />
              <p className="form-hint">フォーカスを外すと自動保存されます</p>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">よみがな</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: やまだ たろう（並び順に使用）"
                value={form.nameKana}
                onChange={e => set('nameKana', e.target.value)}
                onBlur={e => saveOnBlur('nameKana', e.target.value)}
              />
              <p className="form-hint">空欄の場合は氏名順になります</p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">雇用区分<span className="required">*</span></label>
              <select
                className="form-select"
                value={form.employmentType}
                onChange={e => setAndSave('employmentType', e.target.value)}
              >
                {EMPLOYMENT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">職種<span className="required">*</span></label>
              <select
                className="form-select"
                value={form.type}
                onChange={e => setAndSave('type', e.target.value)}
              >
                {WORKER_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">所属<span className="required">*</span></label>
              <select
                className="form-select"
                value={form.affiliation}
                onChange={e => setAndSave('affiliation', e.target.value)}
              >
                {AFFILIATIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">職位</label>
              <select
                className="form-select"
                value={form.position ?? ''}
                onChange={e => setAndSave('position', e.target.value)}
              >
                {POSITIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">時短区分</label>
            <select
              className="form-select"
              value={form.shortTimeType ?? ''}
              onChange={e => setAndSave('shortTimeType', e.target.value)}
            >
              {SHORT_TIME_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">可能な麻酔手技</label>
            <SkillsCheckboxes
              selected={form.skills}
              onChange={val => setAndSave('skills', val)}
            />
          </div>

          <div className="form-group">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.hideFromDutyCalendar ?? false}
                onChange={e => setAndSave('hideFromDutyCalendar', e.target.checked)}
              />
              <span className="toggle-row__label">当直・残り番・土曜に表示しない</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">その他コメント</label>
            <textarea
              className="form-textarea"
              placeholder="資格・担当日・特記事項など"
              value={form.comment}
              onChange={e => set('comment', e.target.value)}
              onBlur={e => saveOnBlur('comment', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}

// ===== 削除確認ダイアログ =====
function DeleteConfirm({ worker, onCancel, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const { toast, showToast } = useToast()

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteWorker(worker.id)
      onDeleted()
    } catch (err) {
      showToast('削除に失敗しました: ' + err.message, 'error')
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onCancel} />
      <div className="sheet sheet--sm">
        <div className="sheet__handle" />
        <div className="sheet__body" style={{ textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
            {worker.name} を削除しますか？
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            この操作は元に戻せません。<br />
            過去のシフトデータは残ります。
          </div>
          <div className="flex gap-3" style={{ flexDirection: 'column' }}>
            <button
              className="btn btn-danger btn-block"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '削除中...' : '削除する'}
            </button>
            <button className="btn btn-secondary btn-block" onClick={onCancel}>
              キャンセル
            </button>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}

// ===== 勤務者カード =====
function WorkerCard({ worker, onEdit, onDelete }) {
  const typeInfo  = WORKER_TYPES.find(t => t.value === worker.type)
  const empInfo   = EMPLOYMENT_TYPES.find(e => e.value === worker.employmentType)

  return (
    <div className="worker-mgmt-card">
      <div className="worker-mgmt-card__main">
        <div className="worker-mgmt-card__name">{worker.name}</div>
        {worker.nameKana && worker.nameKana !== worker.name && (
          <div className="worker-mgmt-card__kana">{worker.nameKana}</div>
        )}

        {/* 所属・雇用区分・職種・職位バッジ */}
        <div className="worker-mgmt-card__badges">
          {worker.affiliation && (
            <span className={`badge ${worker.affiliation === 'TCAT' ? 'badge-red' : 'badge-green'}`}>
              {worker.affiliation}
            </span>
          )}
          <span className={`badge ${worker.employmentType === 'fulltime' ? 'badge-blue' : 'badge-gray'}`}>
            {empInfo?.label ?? '不明'}
          </span>
          <span className={`badge ${WORKER_TYPE_BADGE[worker.type] ?? 'badge-gray'}`}>
            {typeInfo?.label ?? worker.type ?? '不明'}
          </span>
          {worker.position && (
            <span className="badge badge-purple">
              {worker.position}
            </span>
          )}
          {worker.hideFromDutyCalendar && (
            <span className="badge badge-gray">当直カレンダー非表示</span>
          )}
        </div>

        {worker.skills?.length > 0 && (
          <div className="worker-mgmt-card__skills">
            {worker.skills.map(s => (
              <span key={s} className="skill-tag">{s}</span>
            ))}
          </div>
        )}
        {worker.comment && (
          <div className="worker-mgmt-card__comment">{worker.comment}</div>
        )}
      </div>
      <div className="worker-mgmt-card__actions">
        <button
          className="icon-btn icon-btn--edit"
          onClick={() => onEdit(worker)}
          title="編集"
        >
          ✏️
        </button>
        <button
          className="icon-btn icon-btn--delete"
          onClick={() => onDelete(worker)}
          title="削除"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

// ===== 一括インポートシート =====
function ImportSheet({ onClose, onImported }) {
  const [step, setStep] = useState(1)          // 1: 入力, 2: 確認
  const [text, setText] = useState('')
  const [names, setNames] = useState([])        // 確認ステップの名前リスト
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)        // 完了結果 { ok, ng }
  const { toast, showToast } = useToast()

  // テキストを解析して名前配列を返す
  const parseNames = (raw) =>
    raw.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

  const handleNext = () => {
    const parsed = parseNames(text)
    if (parsed.length === 0) { showToast('氏名を1行1名で入力してください', 'error'); return }
    setNames(parsed)
    setStep(2)
  }

  const removeName = (idx) => setNames(names.filter((_, i) => i !== idx))

  const handleImport = async () => {
    if (names.length === 0) return
    setSaving(true)
    let ok = 0, ng = 0
    for (const name of names) {
      try {
        await addWorker({
          name,
          nameKana: name,
          employmentType: 'fulltime',
          type: 'senior',
          affiliation: 'General',
          skills: [],
          comment: '',
        })
        ok++
      } catch {
        ng++
      }
    }
    setSaving(false)
    setDone({ ok, ng })
    onImported()
  }

  // ===== 完了画面 =====
  if (done) {
    return (
      <>
        <div className="sheet-overlay" onClick={onClose} />
        <div className="sheet sheet--sm">
          <div className="sheet__handle" />
          <div className="sheet__body" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
              インポート完了
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              {done.ok}名 登録しました
              {done.ng > 0 && `（失敗: ${done.ng}名）`}
            </div>
            <button className="btn btn-primary btn-block" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet__handle" />
        <div className="sheet__header">
          <span className="sheet__title">
            {step === 1 ? '一括インポート' : `確認（${names.length}名）`}
          </span>
          <button className="sheet__close" onClick={onClose}>✕</button>
        </div>

        <div className="sheet__body">

          {/* ===== ステップ1: 入力 ===== */}
          {step === 1 && (
            <>
              <div className="card" style={{ background: '#f0f4ff', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                  氏名を1行に1名ずつ貼り付けてください。<br />
                  種別・職種はデフォルト（常勤・専門医）で登録されます。あとから個別に編集できます。
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">氏名リスト<span className="required">*</span></label>
                <textarea
                  className="form-textarea"
                  rows={10}
                  placeholder={'山田 太郎\n鈴木 花子\n田中 一郎'}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  autoFocus
                  style={{ fontFamily: 'monospace', fontSize: 15 }}
                />
                <p className="form-hint">
                  {parseNames(text).length > 0 && `${parseNames(text).length}名 が認識されています`}
                </p>
              </div>
              <button className="btn btn-primary btn-block" onClick={handleNext}>
                確認画面へ →
              </button>
            </>
          )}

          {/* ===== ステップ2: 確認 ===== */}
          {step === 2 && (
            <>
              <div className="card" style={{ background: '#f0fdf4', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
                  以下の {names.length}名 を<strong>常勤・専門医</strong>として登録します。<br />
                  不要な方は × で除いてから登録してください。
                </p>
              </div>

              <div className="import-name-list">
                {names.map((name, idx) => (
                  <div key={idx} className="import-name-row">
                    <span className="import-name-row__num">{idx + 1}</span>
                    <span className="import-name-row__name">{name}</span>
                    <button
                      className="import-name-row__remove"
                      onClick={() => removeName(idx)}
                      title="除外"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {names.length === 0 && (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state__text">全員除外されました</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleImport}
                  disabled={saving || names.length === 0}
                >
                  {saving ? `登録中... (${names.length}名)` : `✅ ${names.length}名 を登録する`}
                </button>
                <button className="btn btn-secondary btn-block" onClick={() => setStep(1)}>
                  ← 入力に戻る
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}

// ===== メインページ =====
export default function WorkersPage() {
  const { workers, loading, refetch } = useWorkers()
  const [sheet, setSheet] = useState(null)  // null | 'add' | { edit: worker }
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const openAdd   = () => setSheet('add')
  const openEdit  = (worker) => setSheet({ edit: worker })
  const closeSheet = () => setSheet(null)

  const handleSaved = () => refetch()
  const handleDeleted = () => { setDeleteTarget(null); refetch() }

  // 職種ごとにグループ化
  const groups = WORKER_TYPES.map(({ value, label }) => ({
    key: value,
    label,
    members: workers.filter(w => w.type === value),
  })).filter(g => g.members.length > 0)

  const ungrouped = workers.filter(
    w => !WORKER_TYPES.find(t => t.value === w.type)
  )

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {/* サマリーバー */}
      <div className="workers-summary-bar">
        <span>登録済み <strong>{workers.length}</strong> 名</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          常勤 {workers.filter(w => w.employmentType === 'fulltime').length} /
          非常勤 {workers.filter(w => w.employmentType === 'parttime').length}
        </span>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="section workers-section">
          {workers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">👤</div>
              <div className="empty-state__text">
                勤務者がまだ登録されていません
              </div>
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={openAdd}
              >
                ＋ 最初の勤務者を登録
              </button>
            </div>
          ) : (
            <>
              {groups.map(group => (
                <div key={group.key}>
                  <div className="section-title">{group.label}（{group.members.length}名）</div>
                  <div className="workers-cards-grid">
                    {group.members.map(w => (
                      <WorkerCard
                        key={w.id}
                        worker={w}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <div className="section-title">その他（{ungrouped.length}名）</div>
                  <div className="workers-cards-grid">
                    {ungrouped.map(w => (
                      <WorkerCard
                        key={w.id}
                        worker={w}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* FABボタン群 */}
      <div className="fab-group">
        <button className="fab fab-secondary" onClick={() => setShowImport(true)}>
          📋 一括インポート
        </button>
        <button className="fab" onClick={openAdd}>
          ＋ 新規登録
        </button>
      </div>

      {/* 追加シート */}
      {sheet === 'add' && (
        <WorkerFormSheet
          worker={null}
          onClose={closeSheet}
          onSaved={handleSaved}
        />
      )}

      {/* 編集シート */}
      {sheet?.edit && (
        <WorkerFormSheet
          worker={sheet.edit}
          onClose={closeSheet}
          onSaved={handleSaved}
        />
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <DeleteConfirm
          worker={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}

      {/* 一括インポート */}
      {showImport && (
        <ImportSheet
          onClose={() => setShowImport(false)}
          onImported={refetch}
        />
      )}
    </div>
  )
}
