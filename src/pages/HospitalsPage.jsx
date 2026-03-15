import { useState } from 'react'
import {
  collection, addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useHospitals } from '../components/calendar/OutsideMode'
import { useToast } from '../hooks/useToast'
import Toast from '../components/common/Toast'

async function addHospital(name) {
  return addDoc(collection(db, 'hospitals'), {
    name: name.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

async function deleteHospital(id) {
  return deleteDoc(doc(db, 'hospitals', id))
}

function ImportSheet({ onClose, onDone }) {
  const [text, setText]     = useState('')
  const [names, setNames]   = useState(null)
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()

  const handleParse = () => {
    const parsed = text.split('\n').map(s => s.trim()).filter(Boolean)
    if (parsed.length === 0) { showToast('病院名を入力してください', 'error'); return }
    setNames(parsed)
  }

  const handleImport = async () => {
    setSaving(true)
    try {
      await Promise.all(names.map(n => addHospital(n)))
      showToast(`${names.length}件をインポートしました`, 'success')
      setTimeout(() => { onDone(); onClose() }, 800)
    } catch (err) {
      showToast('インポートに失敗しました', 'error')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet__handle" />
        <div className="sheet__header">
          <span className="sheet__title">🏥 病院一括インポート</span>
          <button className="sheet__close" onClick={onClose}>✕</button>
        </div>
        <div className="sheet__body">
          {!names ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                1行1病院名でテキストを貼り付けてください
              </p>
              <textarea
                className="form-textarea"
                rows={8}
                placeholder={'○○病院\n△△クリニック\n□□医療センター'}
                value={text}
                onChange={e => setText(e.target.value)}
              />
              <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={handleParse}>
                確認する
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, marginBottom: 8 }}>{names.length}件を追加します：</p>
              <div className="import-name-list" style={{ marginBottom: 16 }}>
                {names.map((n, i) => (
                  <div key={i} className="import-name-row">
                    <span className="import-name-row__num">{i + 1}</span>
                    <span className="import-name-row__name">🏥 {n}</span>
                    <button className="import-name-row__remove"
                      onClick={() => setNames(names.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary btn-block" onClick={handleImport} disabled={saving}>
                {saving ? 'インポート中...' : `✅ ${names.length}件を追加`}
              </button>
              <button className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => setNames(null)}>
                戻る
              </button>
            </>
          )}
        </div>
        <Toast toast={toast} />
      </div>
    </>
  )
}

export default function HospitalsPage() {
  const { hospitals, loading } = useHospitals()
  const [showImport, setShowImport] = useState(false)
  const [newName, setNewName]       = useState('')
  const [adding, setAdding]         = useState(false)
  const { toast, showToast }        = useToast()

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) { showToast('病院名を入力してください', 'error'); return }
    setAdding(true)
    try {
      await addHospital(name)
      setNewName('')
      showToast('追加しました', 'success')
    } catch (err) {
      showToast('追加に失敗しました', 'error')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    try {
      await deleteHospital(id)
      showToast('削除しました', 'success')
    } catch (err) {
      showToast('削除に失敗しました', 'error')
    }
  }

  return (
    <div>
      <div className="workers-summary-bar">
        <span>外勤先 ({hospitals.length}件)</span>
      </div>

      <div className="workers-section">
        {/* 新規追加 */}
        <div className="card">
          <div className="section-title">外勤先を追加</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder="外勤先名を入力"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{ flex: 1, height: 44 }}
            />
            <button className="btn btn-primary" style={{ height: 44, padding: '0 20px' }}
              onClick={handleAdd} disabled={adding}>
              追加
            </button>
          </div>
        </div>

        {/* 病院リスト */}
        <div className="card" style={{ marginTop: 8 }}>
          <div className="section-title">登録済み外勤先 ({hospitals.length}件)</div>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : hospitals.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-state__text">外勤先が登録されていません</div>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {hospitals.map(h => (
                <div key={h.id} className="import-name-row">
                  <span className="import-name-row__name">🏥 {h.name}</span>
                  <button className="import-name-row__remove" onClick={() => handleDelete(h.id, h.name)}>
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB: 一括インポート */}
      <div className="fab-group">
        <button className="fab fab-secondary" onClick={() => setShowImport(true)}>
          📋 一括インポート
        </button>
      </div>

      {showImport && (
        <ImportSheet onClose={() => setShowImport(false)} onDone={() => {}} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
