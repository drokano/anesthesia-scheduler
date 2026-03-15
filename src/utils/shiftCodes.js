import { format, getDay } from 'date-fns'

// ===== 日本の祝日セット (2025–2027) =====
export const JP_HOLIDAYS = new Set([
  // 2025
  '2025-01-01','2025-01-13','2025-02-11','2025-02-23','2025-02-24',
  '2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05',
  '2025-05-06','2025-07-21','2025-08-11','2025-09-15','2025-09-23',
  '2025-10-13','2025-11-03','2025-11-23','2025-11-24',
  // 2026
  '2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20',
  '2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06',
  '2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23',
  '2026-10-12','2026-11-03','2026-11-23',
  // 2027
  '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21',
  '2027-04-29','2027-05-03','2027-05-04','2027-05-05',
  '2027-07-19','2027-08-11','2027-09-20','2027-09-23',
  '2027-10-11','2027-11-03','2027-11-23',
])

export const isHoliday = (date) => JP_HOLIDAYS.has(format(date, 'yyyy-MM-dd'))
export const isHolidayOrSunday = (date) => getDay(date) === 0 || isHoliday(date)

// ===== 勤務記号スタイル定義 =====
export const WORK_CODE_STYLES = {
  '':      { color: '#6b7280', bg: null        },
  '出':    { color: '#1d4ed8', bg: '#dbeafe'   },
  '○':    { color: '#6b7280', bg: '#f3f4f6'   },
  '当':    { color: '#dc2626', bg: '#fee2e2'   },
  '当(日)':{ color: '#ea580c', bg: '#fff7ed'   },
  '張':    { color: '#7c3aed', bg: '#ede9fe'   },
  '張(土)':{ color: '#7c3aed', bg: '#ede9fe'   },
  '外':    { color: '#2563eb', bg: '#eff6ff'   },
  '外(半)':{ color: '#2563eb', bg: '#eff6ff'   },
  '●':    { color: '#16a34a', bg: '#f0fdf4'   },
  '☆':    { color: '#db2777', bg: '#fdf2f8'   },
  '夏':    { color: '#0891b2', bg: '#ecfeff'   },
  '看/介': { color: '#d97706', bg: '#fffbeb'   },
}

// ===== 当直希望コード→デフォルトシフト記号マッピング =====
export function getDefaultShiftCode(date, codeMap) {
  const ds    = format(date, 'yyyy-MM-dd')
  const dow   = getDay(date)
  const kibou = codeMap?.[ds]

  if (kibou === 'G') return '外'
  if (kibou === 'Y') return '●'
  if (kibou === 'A' || kibou === 'B') return '張'
  if (kibou === 'C' || kibou === 'P') return '○'
  if (dow === 0 || dow === 6 || isHoliday(date)) return '○'
  return ''
}
