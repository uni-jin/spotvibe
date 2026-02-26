/**
 * 장소 노출기간 일시 — 전부 한국 시간(KST) 기준, DB에도 한국 시간 그대로 저장
 * - 관리자: 등록/수정 시 입력하는 일시는 한국 시간 → DB에 한국 시간 그대로 저장
 * - 장소관리 목록: 저장된 일시(KST) 그대로 표시
 * - 노출 중/노출 예정/노출 종료: 한국 시간 기준으로 계산
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 관리자가 입력한 KST 일시를 DB 저장용 문자열로 (한국 시간 그대로, 변환 없음)
 * "YYYY-MM-DDTHH:mm" 또는 "YYYY-MM-DD HH:mm:00" → "YYYY-MM-DD HH:mm:00"
 */
export function kstDateTimeToDbString(kstDateTimeString) {
  if (!kstDateTimeString || typeof kstDateTimeString !== 'string') return null
  const trimmed = kstDateTimeString.trim()
  if (!trimmed) return null
  const pad = (n) => String(n).padStart(2, '0')
  // 이미 "YYYY-MM-DD HH:mm:00" 형식이면 그대로 반환 (중복 " 00:00:00" 방지)
  const alreadyDb = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (alreadyDb) {
    const [, date, h, min] = alreadyDb
    return `${date} ${pad(parseInt(h, 10))}:${pad(parseInt(min, 10))}:00`
  }
  const [datePart, timePart] = trimmed.split('T')
  if (!datePart) return null
  const [h = 0, min = 0] = (timePart || '00:00').split(':').map(Number)
  return `${datePart} ${pad(h)}:${pad(min)}:00`
}

/**
 * DB에 저장된 한국 시간 문자열을 폼용 "YYYY-MM-DDTHH:mm"으로
 * (저장값이 이미 KST이므로 그대로 포맷만 맞춤)
 */
export function dbKstToFormString(dbValue) {
  if (!dbValue) return ''
  const s = typeof dbValue === 'string' ? dbValue : (dbValue + '').replace('Z', '')
  const match = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/)
  if (!match) return s.slice(0, 16)
  const [, date, h, min] = match
  const pad = (n) => String(n).padStart(2, '0')
  return `${date}T${pad(parseInt(h, 10))}:${min}`
}

/**
 * DB에 저장된 한국 시간 문자열을 목록/상세 표시용 "YYYY. MM. DD. HH:mm"으로
 */
export function formatKstDisplay(dbValue) {
  if (!dbValue) return ''
  const form = dbKstToFormString(dbValue)
  if (!form) return ''
  const [datePart, timePart] = form.split('T')
  const [y, m, d] = datePart.split('-')
  const [h, min] = (timePart || '00:00').split(':')
  return `${y}. ${m}. ${d}. ${h}:${min}`
}

/**
 * DB 저장값을 날짜만 표시용 "YYYY. MM. DD"로 (시간 미입력 시 사용자 화면용)
 */
export function formatKstDisplayDateOnly(dbValue) {
  if (!dbValue) return ''
  const s = typeof dbValue === 'string' ? dbValue : String(dbValue)
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const [, y, m, d] = match
  return `${y}. ${m}. ${d}`
}

/**
 * 노출기간이 "날짜만" 지정된 구간인지 (시작 00:00, 종료 23:59:59 → 사용자 화면에서 날짜만 표시)
 */
export function isDateOnlyPeriod(startKst, endKst) {
  if (!startKst && !endKst) return false

  const getTime = (v) => {
    if (!v) return null
    const form = dbKstToFormString(v) // "YYYY-MM-DDTHH:mm"
    if (!form) return null
    const [, timePart] = form.split('T')
    return timePart || '00:00'
  }

  const startTime = getTime(startKst)
  const endTime = getTime(endKst)

  const startIsMidnight = !startTime || startTime.startsWith('00:00')
  const endIsEndOfDay = !endTime || endTime.startsWith('23:59')

  return startIsMidnight && endIsEndOfDay
}

/**
 * DB 저장값(한국 시간 문자열)을 Date(instant)로 해석 — 노출 상태 비교용
 * "2026-02-14 18:30:00" (KST) → 그 순간의 Date
 */
function kstStringToInstant(kstString) {
  if (!kstString) return null
  const s = typeof kstString === 'string' ? kstString : String(kstString)
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/)
  if (!match) return null
  const [, y, m, d, h, min] = match.map(Number)
  const utcMs = Date.UTC(y, m - 1, d, h, min, 0, 0) - KST_OFFSET_MS
  return new Date(utcMs)
}

/**
 * 노출 상태 판단: 저장된 시작/종료는 한국 시간 — 현재 시각과 비교
 */
export function getDisplayStatusKST(startKst, endKst) {
  const now = new Date()
  const start = startKst ? kstStringToInstant(startKst) : null
  const end = endKst ? kstStringToInstant(endKst) : null
  if (!start && !end) return 'unlimited'
  if (start && end) {
    if (start <= now && end >= now) return 'active'
    if (start > now) return 'scheduled'
    return 'expired'
  }
  if (start) return start <= now ? 'active' : 'scheduled'
  return end >= now ? 'active' : 'expired'
}

/**
 * Date를 KST 기준 연·월·일만 사용한 정수 키로 변환 (관리자 필터 등 비교용)
 */
export function getKSTDateKey(d) {
  if (!d || !(d instanceof Date)) return null
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth() + 1
  const day = kst.getUTCDate()
  return y * 10000 + m * 100 + day
}

/** 현재 시각의 KST 오늘 날짜 키 */
export function getTodayKSTDateKey() {
  return getKSTDateKey(new Date())
}

/**
 * DB에 저장된 한국 시간 문자열에서 날짜만 추출해 KST 날짜 키 반환
 * "2026-02-14T18:30:00" 또는 "2026-02-14 18:30:00" → 20260214
 */
export function getKstDateKeyFromString(storedValue) {
  if (!storedValue) return null
  const s = typeof storedValue === 'string' ? storedValue : String(storedValue)
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  return y * 10000 + m * 100 + d
}

/**
 * 두 KST 날짜 키 사이의 calendar day 차이 (key2 - key1, 날짜 기준)
 */
export function getCalendarDaysBetweenKeys(key1, key2) {
  if (key1 == null || key2 == null) return null
  const toDate = (key) => {
    const d = key % 100
    const m = Math.floor((key % 10000) / 100) - 1
    const y = Math.floor(key / 10000)
    return new Date(y, m, d)
  }
  return Math.round((toDate(key2) - toDate(key1)) / (24 * 60 * 60 * 1000))
}

/**
 * 복수 노출기간 중 "현재 진행 중" 또는 "다음 예정" 구간 하나 반환
 * @param {Array<{display_start_date?: string, display_end_date?: string, start?: string, end?: string}>} periods
 * @returns {{ start: string, end: string } | null}
 */
export function getCurrentOrNextPeriod(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return null
  const now = new Date()
  const normalized = periods
    .map((p) => {
      const start = p.display_start_date ?? p.start
      const end = p.display_end_date ?? p.end
      if (!start && !end) return null
      return {
        startKst: start,
        endKst: end,
        startInst: start ? kstStringToInstant(start) : null,
        endInst: end ? kstStringToInstant(end) : null,
      }
    })
    .filter(Boolean)
  if (normalized.length === 0) return null
  normalized.sort((a, b) => {
    const aStart = a.startInst ? a.startInst.getTime() : 0
    const bStart = b.startInst ? b.startInst.getTime() : 0
    return aStart - bStart
  })
  for (const p of normalized) {
    const inRange =
      (!p.startInst || p.startInst <= now) && (!p.endInst || p.endInst >= now)
    if (inRange) return { start: p.startKst, end: p.endKst }
  }
  for (const p of normalized) {
    if (p.startInst && p.startInst > now) return { start: p.startKst, end: p.endKst }
  }
  return null
}

/**
 * 복수 노출기간 중 이미 지난 구간 중 종료일이 가장 늦은 구간 하나 반환 (관리자 목록 표시용)
 * @param {Array<{display_start_date?: string, display_end_date?: string, start?: string, end?: string}>} periods
 * @returns {{ start: string, end: string } | null}
 */
export function getLastExpiredPeriod(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return null
  const now = new Date()
  const normalized = periods
    .map((p) => {
      const start = p.display_start_date ?? p.start
      const end = p.display_end_date ?? p.end
      if (!start && !end) return null
      return {
        startKst: start,
        endKst: end,
        endInst: end ? kstStringToInstant(end) : null,
      }
    })
    .filter(Boolean)
  const expired = normalized.filter((p) => p.endInst && p.endInst < now)
  if (expired.length === 0) return null
  expired.sort((a, b) => (b.endInst?.getTime() ?? 0) - (a.endInst?.getTime() ?? 0))
  const last = expired[0]
  return { start: last.startKst, end: last.endKst }
}

/**
 * 관리자 목록 노출기간 표시용: 현재/다음 구간 우선, 없으면 마지막 지난 구간, 없으면 단일 기간 폴백
 * @param {Array} periods - place_display_periods
 * @param {string|null} fallbackStart - places.display_start_date
 * @param {string|null} fallbackEnd - places.display_end_date
 * @returns {{ start: string, end: string } | null}
 */
export function getDisplayPeriodForAdminList(periods, fallbackStart, fallbackEnd) {
  const currentOrNext = getCurrentOrNextPeriod(periods || [])
  if (currentOrNext) return currentOrNext
  const lastExpired = getLastExpiredPeriod(periods || [])
  if (lastExpired) return lastExpired
  if (fallbackStart || fallbackEnd) return { start: fallbackStart || null, end: fallbackEnd || null }
  return null
}

/**
 * 복수 노출기간 또는 단일 기간으로 노출 상태 반환
 * @param {Array} periods - place_display_periods 스타일 배열 (또는 빈 배열)
 * @param {string|null} fallbackStart - periods 없을 때 사용
 * @param {string|null} fallbackEnd - periods 없을 때 사용
 */
export function getDisplayStatusFromPeriods(periods, fallbackStart, fallbackEnd) {
  if (Array.isArray(periods) && periods.length > 0) {
    const effective = getCurrentOrNextPeriod(periods)
    if (effective) return getDisplayStatusKST(effective.start, effective.end)
    return 'expired'
  }
  return getDisplayStatusKST(fallbackStart, fallbackEnd)
}

// 하위 호환용 별칭 (기존 코드에서 utcToKstDateTimeString, formatUtcAsKstDisplay 사용처)
export const utcToKstDateTimeString = dbKstToFormString
export const formatUtcAsKstDisplay = formatKstDisplay
