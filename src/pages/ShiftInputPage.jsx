import { useState, useMemo, useEffect } from 'react'
import {
  format,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, isSameMonth, getDay,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  useWorkers, useWorkerMonthData, useWorkerOncallData,
  addDocument, updateDocument,
} from '../hooks/useFirestore'
import Toast from '../components/common/Toast'
import { useToast } from '../hooks/useToast'
import MonthNav        from '../components/calendar/MonthNav'
import KibouMode       from '../components/calendar/KibouMode'
import OncallMode      from '../components/calendar/OncallMode'
import OutsideMode     from '../components/calendar/OutsideMode'
import AbsenceMode     from '../components/calendar/AbsenceMode'
import BrowsingCalendar from '../components/calendar/BrowsingCalendar'
import {
  isHolidayOrSunday, isHoliday, WORK_CODE_STYLES, getDefaultShiftCode, JP_HOLIDAYS,
} from '../utils/shiftCodes'

// ===== コード定義（KibouModeからimportされる） =====
export const CODE_DEFS = [
  { code: '',   label: '通常勤務',                     color: '#6b7280', bg: null       },
  { code: 'Y',  label: '有給',                         color: '#16a34a', bg: '#f0fdf4'  },
  { code: 'N',  label: '夏休み',                       color: '#0891b2', bg: '#ecfeff'  },
  { code: 'G',  label: '外勤',                         color: '#2563eb', bg: '#eff6ff'  },
  { code: 'X',  label: '当直・残り不可',                 color: '#4f46e5', bg: '#eef2ff'  },
  { code: 'A',  label: '学会・研究会等（発表者・座長）', color: '#ea580c', bg: '#fff7ed'  },
  { code: 'B',  label: '学会・研究会等（参加のみ）',    color: '#d97706', bg: '#fffbeb'  },
  { code: 'C',  label: '冠婚葬祭',                     color: '#db2777', bg: '#fdf2f8'  },
  { code: 'P',  label: '私用',                         color: '#7c3aed', bg: '#f5f3ff'  },
  { code: '出', label: '土曜出番可能',                  color: '#0f766e', bg: '#f0fdfa'  },
]

// ===== 勤務記号定義（色情報付き） =====
const WORK_CODES = [
  { code: '',      label: '（未選択）',      noTime: false, color: '#6b7280', bg: null,      getDefaultTimes: ()     => ({ startTime: '', endTime: '' }) },
  { code: '出',    label: '出勤(定時)',       noTime: false, ...WORK_CODE_STYLES['出'],      getDefaultTimes: ()     => ({ startTime: '08:00', endTime: '17:00' }) },
  { code: '○',    label: '休日',             noTime: true,  ...WORK_CODE_STYLES['○'],      getDefaultTimes: ()     => ({ startTime: '', endTime: '' }) },
  { code: '当',    label: '当直',             noTime: false, ...WORK_CODE_STYLES['当'],      getDefaultTimes: (date) => isHolidayOrSunday(date) ? { startTime: '17:00', endTime: '23:00' } : { startTime: '08:00', endTime: '23:00' } },
  { code: '当(日)', label: '当直(日祝)',      noTime: false, ...WORK_CODE_STYLES['当(日)'],  getDefaultTimes: ()     => ({ startTime: '17:00', endTime: '23:00' }) },
  { code: '張',    label: '出張',             noTime: false, ...WORK_CODE_STYLES['張'],      getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '17:00' }) },
  { code: '張(土)', label: '出張(土)',        noTime: false, ...WORK_CODE_STYLES['張(土)'],  getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '13:00' }) },
  { code: '外',    label: '外勤',             noTime: false, ...WORK_CODE_STYLES['外'],      getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '17:00' }) },
  { code: '外(半)', label: '外勤(半日)',      noTime: false, ...WORK_CODE_STYLES['外(半)'],  getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '13:00' }) },
  { code: '●',    label: '年次有給休暇',      noTime: false, ...WORK_CODE_STYLES['●'],      getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '17:00' }) },
  { code: '☆',    label: '特別休暇',         noTime: false, ...WORK_CODE_STYLES['☆'],      getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '17:00' }) },
  { code: '夏',    label: '夏季休暇',         noTime: false, ...WORK_CODE_STYLES['夏'],      getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '17:00' }) },
  { code: '看/介', label: '看護・介護休暇',   noTime: false, ...WORK_CODE_STYLES['看/介'],   getDefaultTimes: ()     => ({ startTime: '09:00', endTime: '17:00' }) },
]

// ===== モード定義 =====
const MODES = [
  { key: 'kibou',   label: '勤務・当直希望' },
  { key: 'shift',   label: 'シフト入力' },
  { key: 'absence', label: '離席' },
  { key: 'oncall',  label: '当直・残り番・土曜', admin: true },
  { key: 'outside', label: '外勤', admin: true },
]
const RESTRICTED_MODES = new Set(['kibou', 'absence'])

// ===== 時短区分ごとの1日あたり時間 =====
const SHORT_TIME_HOURS = {
  '':    8,
  '36h': 7.2,
  '32h': 6.4,
  '28h': 5.6,
  '24h': 4.8,
}

// ===== 祝日APIキャッシュ（セッション内1回のみフェッチ） =====
let _apiHolidaySet = null
async function fetchApiHolidays() {
  if (_apiHolidaySet) return _apiHolidaySet
  try {
    const res  = await fetch('https://holidays-jp.github.io/api/v1/date.json')
    const data = await res.json()
    _apiHolidaySet = new Set(Object.keys(data))
  } catch {
    _apiHolidaySet = JP_HOLIDAYS
  }
  return _apiHolidaySet
}

// ===== 5分単位の時刻スロット（06:00〜18:00）=====
const TIME_SLOTS = Array.from({ length: 145 }, (_, i) => {
  const total = 6 * 60 + i * 5
  const h = Math.floor(total / 60).toString().padStart(2, '0')
  const m = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}`
})

const toDateStr = (date) => format(date, 'yyyy-MM-dd')
const WEEKDAYS  = ['日', '月', '火', '水', '木', '金', '土']

// ===== 従来デフォルト時刻（コードなし時フォールバック） =====
function getDefaultTimes(worker, date, outsideMap) {
  const ds  = toDateStr(date)
  const dow = getDay(date)
  if (dow === 0 || dow === 6 || isHoliday(date)) return { startTime: '', endTime: '' }
  if (outsideMap?.[ds]) return { startTime: '09:00', endTime: '17:00' }
  if (worker?.employmentType === 'fulltime') return { startTime: '08:00', endTime: '17:00' }
  return { startTime: '', endTime: '' }
}

// ===== 勤務記号凡例 =====
function ShiftCodeLegend() {
  const items = [
    { code: '出',    desc: '出勤日(定時)' },
    { code: '当',    desc: '平日・土(8:00-23:00)  日・祝(17:00-23:00)' },
    { code: '張',    desc: '出張(9:00-17:00固定)' },
    { code: '外',    desc: '外勤日(9:00-17:00固定)' },
    { code: '○',    desc: '休日（日曜・祝祭日、年末年始等）、勤務しない日' },
    { code: '●',    desc: '年次有給休暇(9:00-17:00固定)' },
    { code: '☆',    desc: '特別休暇（夏季休暇を除く）(9:00-17:00固定)' },
    { code: '夏',    desc: '夏季休暇(9:00-17:00固定)' },
    { code: '看/介', desc: '看護・介護休暇(9:00-17:00固定)' },
  ]
  return (
    <div className="shift-code-legend">
      <div className="shift-code-legend__title">勤務記号凡例</div>
      <div className="shift-code-legend__grid">
        {items.map(({ code, desc }) => (
          <div key={code} className="shift-code-legend__item">
            <span className="shift-code-legend__code" style={{ color: WORK_CODE_STYLES[code]?.color }}>{code}</span>
            <span className="shift-code-legend__desc">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== シフトルール =====
function ShiftRules() {
  return (
    <div className="shift-rules">
      <div className="shift-rules__title">シフトルール</div>
      <div className="shift-rules__body">{`◆当直・明け◆
平日・土曜の当直→シフト時間「8:00-23:00」
日曜・祝日の当直→シフト時間「17:00-23:00」(勤務は8時から)
次の日＝「○」勤務しない日

◆外勤日(9:00-17:00)
→週１回の月４回です(月によっては最大5回)
※４回以上以降ある方は年休使用・休日としてご調整ください
→時短勤務者("24H/週" は除く)：9:00-13:00の４H

◆出勤(自分の定時となります)
→大学の規定の為、8:00以降で記入してください

◆年休(平日・土曜→9:00-17:00)
→入局3か月後から適用

◆出張(平日→9:00-17:00/土曜→9:00-13:00)

◆日曜日・祝日(創立記念日含む)・年末年始
→外勤・年休・休暇関連・出張等は使用できません

◆夏季休暇(9:00-17:00固定)
→後期臨床研修医：3日　→助教以上：5日`}</div>
    </div>
  )
}

// ===== シフト入力モード カレンダー（3分割セル・色表示付き） =====
function ShiftModeCalendar({ workerId, worker, currentMonth, shiftMap, outsideMap, codeMap, onRefetch }) {
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()

  const calDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const handleChange = async (date, field, value, displayShiftCode) => {
    if (!workerId || saving) return
    const ds       = toDateStr(date)
    const existing = shiftMap[ds] ?? null

    setSaving(true)
    try {
      let payload
      if (field === 'shiftCode') {
        const codeEntry = WORK_CODES.find(c => c.code === value)
        const times     = codeEntry ? codeEntry.getDefaultTimes(date) : { startTime: '', endTime: '' }
        payload = { workerId, date: ds, shiftCode: value, startTime: times.startTime, endTime: times.endTime }
      } else {
        const commitCode   = existing ? (existing.shiftCode ?? '') : (displayShiftCode ?? '')
        const codeEntry    = WORK_CODES.find(c => c.code === commitCode)
        const baseDefaults = (commitCode && codeEntry)
          ? codeEntry.getDefaultTimes(date)
          : getDefaultTimes(worker, date, outsideMap)
        payload = {
          workerId, date: ds,
          shiftCode:  commitCode,
          startTime:  existing?.startTime ?? baseDefaults.startTime,
          endTime:    existing?.endTime   ?? baseDefaults.endTime,
          [field]: value,
        }
      }

      if (existing) {
        await updateDocument('shifts', existing.id, payload)
      } else {
        await addDocument('shifts', payload)
      }
      showToast('保存しました', 'success')
      onRefetch()
    } catch {
      showToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="calendar">
        <div className="calendar-weekdays">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`calendar-wd ${i === 0 ? 'cal-sun' : i === 6 ? 'cal-sat' : ''}`}>{d}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {calDays.map(date => {
            const ds      = toDateStr(date)
            const inMonth = isSameMonth(date, currentMonth)
            const dow     = getDay(date)
            const isSat   = dow === 6
            const isSun   = dow === 0
            const today   = isToday(date)
            const shift   = shiftMap[ds]

            const displayShiftCode = shift != null
              ? (shift.shiftCode ?? '')
              : (inMonth ? getDefaultShiftCode(date, codeMap) : '')

            const codeEntry    = WORK_CODES.find(c => c.code === displayShiftCode)
            const noTime       = codeEntry?.noTime ?? false
            const codeDefTimes = (displayShiftCode && codeEntry)
              ? codeEntry.getDefaultTimes(date)
              : getDefaultTimes(worker, date, outsideMap)
            const startTime = noTime ? '' : (shift?.startTime ?? (inMonth ? codeDefTimes.startTime : ''))
            const endTime   = noTime ? '' : (shift?.endTime   ?? (inMonth ? codeDefTimes.endTime   : ''))

            // 勤務記号の色でセル背景を設定（【1】）
            const codeBg = displayShiftCode ? (codeEntry?.bg ?? null) : null
            const cellBg = codeBg ?? (isSat ? '#eff6ff' : isSun ? '#fff5f5' : 'var(--surface)')

            return (
              <div
                key={ds}
                className={[
                  'calendar-day', 'calendar-day--shift3',
                  !inMonth ? 'cal-other-month' : '',
                  today    ? 'cal-today-shift' : '',
                ].join(' ')}
                style={{ background: cellBg }}
              >
                {/* 左1/4: 日付 + 勤務記号バッジ + 勤務記号セレクト */}
                <div className="shift3-left">
                  <span className={`shift3-date ${isSat ? 'cal-sat-num' : isSun ? 'cal-sun-num' : ''}`}>
                    {format(date, 'd')}
                  </span>
                  <span
                    className="shift3-code-badge"
                    style={{ color: codeEntry?.color || '#9ca3af' }}
                  >
                    {displayShiftCode || '—'}
                  </span>
                  <select
                    className="shift3-code"
                    value={displayShiftCode}
                    style={{ color: codeEntry?.color || '#6b7280', fontWeight: displayShiftCode ? 700 : 400 }}
                    onChange={e => inMonth && handleChange(date, 'shiftCode', e.target.value, displayShiftCode)}
                    disabled={!inMonth || saving}
                  >
                    {WORK_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.code || '－'}</option>
                    ))}
                  </select>
                </div>
                {/* 右3/4: 開始/終了時刻 */}
                <div className="shift3-right">
                  <select
                    className="shift3-time shift3-time--start"
                    value={startTime}
                    onChange={e => inMonth && !noTime && handleChange(date, 'startTime', e.target.value, displayShiftCode)}
                    disabled={!inMonth || noTime || saving}
                  >
                    <option value="">—</option>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    className="shift3-time shift3-time--end"
                    value={endTime}
                    onChange={e => inMonth && !noTime && handleChange(date, 'endTime', e.target.value, displayShiftCode)}
                    disabled={!inMonth || noTime || saving}
                  >
                    <option value="">—</option>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Toast toast={toast} />
    </div>
  )
}

// ===== 勤務集計サマリー =====
function ShiftSummary({ currentMonth, shiftMap, codeMap, outsideMap, oncallMap, worker }) {
  const [apiHolidays, setApiHolidays] = useState(null)

  useEffect(() => {
    fetchApiHolidays().then(setApiHolidays)
  }, [])

  const monthDays = useMemo(() =>
    eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }),
    [currentMonth],
  )

  // 月の所定稼働日数（土日祝を除く平日）
  const scheduledDays = useMemo(() => {
    const holidays = apiHolidays ?? JP_HOLIDAYS
    return monthDays.filter(date => {
      const dow = getDay(date)
      if (dow === 0 || dow === 6) return false
      return !holidays.has(format(date, 'yyyy-MM-dd'))
    }).length
  }, [monthDays, apiHolidays])

  const dailyHours   = SHORT_TIME_HOURS[worker?.shortTimeType ?? ''] ?? 8
  const scheduledH   = scheduledDays * dailyHours
  const scheduledHLabel = Number.isInteger(scheduledH) ? `${scheduledH}h` : `${scheduledH.toFixed(1)}h`

  const stats = useMemo(() => {
    let workDays = 0, totalMinutes = 0
    let nikkin = 0, oncallCount = 0, nenkyu = 0, gakin = 0, kyujitsu = 0, shutcho = 0

    monthDays.forEach(date => {
      const ds         = toDateStr(date)
      const dow        = getDay(date)
      const isWeekend  = dow === 0 || dow === 6
      const shift      = shiftMap[ds]
      const code       = codeMap[ds]
      const hasOutside = !!outsideMap[ds]
      const oncallType = oncallMap[ds]?.type

      if (shift?.startTime) {
        workDays++
        if (shift.endTime) {
          const [sh, sm] = shift.startTime.split(':').map(Number)
          const [eh, em] = shift.endTime.split(':').map(Number)
          const mins = (eh * 60 + em) - (sh * 60 + sm)
          if (mins > 0) totalMinutes += mins
        }
      }

      if (code === 'Y') { nenkyu++ }
      else if (code === 'A' || code === 'B') { shutcho++ }
      else if (oncallType === '当直') { oncallCount++ }
      else if (hasOutside) { gakin++ }
      else if (isWeekend) { kyujitsu++ }
      else { nikkin++ }
    })

    const calDays = monthDays.length
    const total   = nikkin + oncallCount + nenkyu + gakin + kyujitsu + shutcho
    const totalH  = Math.floor(totalMinutes / 60)
    const totalM  = totalMinutes % 60
    return { workDays, totalH, totalM, nikkin, oncallCount, nenkyu, gakin, kyujitsu, shutcho, calDays, total }
  }, [monthDays, shiftMap, codeMap, outsideMap, oncallMap])

  const isMatch   = stats.total === stats.calDays
  const diff      = Math.abs(stats.calDays - stats.total)
  const timeLabel = stats.totalM > 0 ? `${stats.totalH}h${stats.totalM}m` : `${stats.totalH}h`

  return (
    <div className="shift-summary">
      <div className="shift-summary__section">
        <div className="shift-summary__title">勤務時間集計</div>
        <div className="shift-summary__time-row">
          {[
            { label: '稼働日数',    value: `${scheduledDays}日` },
            { label: '所定労働時間', value: scheduledHLabel },
            { label: '総労働時間',  value: timeLabel },
          ].map(({ label, value }) => (
            <div key={label} className="shift-summary__time-item">
              <span className="shift-summary__time-label">{label}</span>
              <span className="shift-summary__time-value">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="shift-summary__section">
        <div className="shift-summary__title">日数確認</div>
        <div className="shift-summary__days-grid">
          {[
            { label: '日勤', value: stats.nikkin },
            { label: '当直', value: stats.oncallCount },
            { label: '年休', value: stats.nenkyu },
            { label: '外勤', value: stats.gakin },
            { label: '休日', value: stats.kyujitsu },
            { label: '出張', value: stats.shutcho },
          ].map(({ label, value }) => (
            <div key={label} className="shift-summary__day-cell">
              <div className="shift-summary__day-label">{label}</div>
              <div className="shift-summary__day-value">{value}</div>
            </div>
          ))}
        </div>
        <div className="shift-summary__totals">
          <span>暦日：<strong>{stats.calDays}</strong>日</span>
          <span>合計：<strong>{stats.total}</strong>日</span>
        </div>
      </div>

      <div className={`shift-summary__validation ${isMatch ? 'is-match' : 'is-error'}`}>
        {isMatch
          ? '✓ 日数が一致しています'
          : `合計（${stats.total}日）と暦日（${stats.calDays}日）が一致しません。${diff}日分の入力が不足しています。`
        }
      </div>
    </div>
  )
}

// ===== メインページ =====
export default function ShiftInputPage() {
  const { workers, loading: workersLoading } = useWorkers()
  const [workerId, setWorkerId]         = useState('')
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [activeMode, setActiveMode]     = useState('kibou')

  const worker     = workers.find(w => w.id === workerId) ?? null
  const workerName = worker?.name ?? ''

  const isRestricted = !!(worker && (
    worker.position === '初期研修医' || worker.employmentType === 'parttime'
  ))
  const visibleModes  = isRestricted ? MODES.filter(m => RESTRICTED_MODES.has(m.key)) : MODES
  const effectiveMode = visibleModes.some(m => m.key === activeMode) ? activeMode : 'kibou'

  useEffect(() => {
    if (isRestricted && !RESTRICTED_MODES.has(activeMode)) setActiveMode('kibou')
  }, [workerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const yearMonth = format(currentMonth, 'yyyy-MM')
  const { data: monthData, loading: monthLoading, refetch } = useWorkerMonthData(
    (effectiveMode === 'shift') ? workerId : '',
    yearMonth,
  )

  const shiftMap = useMemo(() => {
    const m = {}; monthData.shifts.forEach(s => { m[s.date] = s }); return m
  }, [monthData.shifts])

  const outsideMap = useMemo(() => {
    const m = {}; monthData.outsideWork.forEach(o => { m[o.date] = o }); return m
  }, [monthData.outsideWork])

  const codeMap = useMemo(() => {
    const m = {}; (monthData.codes ?? []).forEach(c => { m[c.date] = c.code }); return m
  }, [monthData.codes])

  const oncallList = useWorkerOncallData(effectiveMode === 'shift' ? workerId : '', yearMonth)
  const oncallMap  = useMemo(() => {
    const m = {}; oncallList.forEach(a => { m[a.date] = a }); return m
  }, [oncallList])

  return (
    <>
      <MonthNav
        currentMonth={currentMonth}
        onChange={setCurrentMonth}
        workers={workers}
        workersLoading={workersLoading}
        workerId={workerId}
        onWorkerChange={setWorkerId}
        modes={visibleModes}
        activeMode={effectiveMode}
        onModeChange={setActiveMode}
      />

      <div className="shift-scroll-body">
        {effectiveMode === 'oncall' ? (
          /* 当直モード: 閲覧カレンダーなし・全勤務者ガントチャート */
          <OncallMode currentMonth={currentMonth} />
        ) : (
          <div className="cal-dual-layout">
            <div className="cal-dual-input">
              <div className="browse-separator"><span>入力用カレンダー</span></div>
              {effectiveMode === 'kibou' && (
                <KibouMode workerId={workerId} currentMonth={currentMonth} />
              )}
              {effectiveMode === 'outside' && (
                <OutsideMode workerId={workerId} workerName={workerName} currentMonth={currentMonth} />
              )}

              {effectiveMode === 'shift' && (
                <>
                  {!workerId ? (
                    <div className="empty-state">
                      <div className="empty-state__text">勤務者を選択してください</div>
                    </div>
                  ) : monthLoading ? (
                    <div className="loading"><div className="spinner" /></div>
                  ) : (
                    <>
                      <ShiftModeCalendar
                        workerId={workerId}
                        worker={worker}
                        currentMonth={currentMonth}
                        shiftMap={shiftMap}
                        outsideMap={outsideMap}
                        codeMap={codeMap}
                        onRefetch={refetch}
                      />
                      <div className="shift-bottom-panel">
                        <div className="shift-rules-panel">
                          <ShiftRules />
                        </div>
                        <div className="shift-summary-panel">
                          <ShiftSummary
                            currentMonth={currentMonth}
                            shiftMap={shiftMap}
                            codeMap={codeMap}
                            outsideMap={outsideMap}
                            oncallMap={oncallMap}
                            worker={worker}
                          />
                          <ShiftCodeLegend />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {effectiveMode === 'absence' && (
                <AbsenceMode workerId={workerId} currentMonth={currentMonth} />
              )}
            </div>

            <div className="cal-dual-browse">
              <div className="browse-separator"><span>閲覧用カレンダー</span></div>
              <BrowsingCalendar workerId={workerId} currentMonth={currentMonth} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
