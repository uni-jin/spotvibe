import { useState, useEffect, useRef } from 'react'
import { getAdminPlaces, getCommonCodes, savePlace, deletePlace } from '../../lib/admin'
import { db } from '../../lib/supabase'
import { getDisplayStatusFromPeriods, getDisplayPeriodForAdminList, getKSTDateKey, kstDateTimeToDbString, utcToKstDateTimeString, formatUtcAsKstDisplay } from '../../lib/kstDateUtils.js'
import imageCompression from 'browser-image-compression'
import { useNaverMapSdk } from '../../lib/useNaverMapSdk'

function AdminNaverMap({ lat, lng, onChangeLatLng }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const sdkReady = useNaverMapSdk()

  useEffect(() => {
    if (!sdkReady || !window.naver?.maps || !mapRef.current || mapInstanceRef.current) return

    const center = (lat && lng)
      ? new naver.maps.LatLng(parseFloat(lat), parseFloat(lng))
      : new naver.maps.LatLng(37.5446, 127.0559)

    const map = new naver.maps.Map(mapRef.current, {
      center,
      zoom: (lat && lng) ? 16 : 13,
      minZoom: 6,
    })
    mapInstanceRef.current = map

    const marker = new naver.maps.Marker({ position: center, map })
    markerRef.current = marker

    naver.maps.Event.addListener(map, 'click', (e) => {
      const pos = e.coord
      marker.setPosition(pos)
      onChangeLatLng(pos.y.toString(), pos.x.toString())
    })
  }, [sdkReady])

  useEffect(() => {
    const map = mapInstanceRef.current
    const marker = markerRef.current
    if (!map || !marker || !lat || !lng) return
    const pos = new naver.maps.LatLng(parseFloat(lat), parseFloat(lng))
    marker.setPosition(pos)
  }, [lat, lng])

  return (
    <div className="mb-4 rounded-lg overflow-hidden border border-gray-700" style={{ height: '600px' }}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  )
}

function formatCommonCodeLabel(code) {
  if (!code) return ''
  const ko = (code.code_label_ko ?? code.code_label ?? '').trim()
  const en = (code.code_label_en ?? '').trim()
  if (ko && en && ko !== en) return `${ko} (${en})`
  return ko || en || ''
}

const PlacesManagement = ({ resetTrigger = 0 }) => {
  const [places, setPlaces] = useState([])
  const [filteredPlaces, setFilteredPlaces] = useState([])
  const [categories, setCategories] = useState([])
  const [tagGroups, setTagGroups] = useState({ admission: [], benefit: [], amenity: [], content: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlace, setEditingPlace] = useState(null)
  
  // Search filters
  const [searchName, setSearchName] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchActive, setSearchActive] = useState('')
  const [searchDisplayStatus, setSearchDisplayStatus] = useState('')
  const [searchDisplayStartDate, setSearchDisplayStartDate] = useState('')
  const [searchDisplayEndDate, setSearchDisplayEndDate] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (resetTrigger > 0) {
      setShowForm(false)
      setEditingPlace(null)
    }
  }, [resetTrigger])

  useEffect(() => {
    filterPlaces()
  }, [places, searchName, searchCategory, searchActive, searchDisplayStatus, searchDisplayStartDate, searchDisplayEndDate])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [placesData, categoriesData, admissionTags, benefitTags, amenityTags, contentTags] = await Promise.all([
        getAdminPlaces(),
        getCommonCodes('place_category'),
        getCommonCodes('place_tag_admission', true),
        getCommonCodes('place_tag_benefit', true),
        getCommonCodes('place_tag_amenity', true),
        getCommonCodes('place_tag_content', true),
      ])
      setPlaces(placesData)
      setCategories(categoriesData)
      setTagGroups({
        admission: admissionTags,
        benefit: benefitTags,
        amenity: amenityTags,
        content: contentTags,
      })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterPlaces = () => {
    let filtered = [...places]

    // Filter by name
    if (searchName) {
      filtered = filtered.filter(place =>
        place.name?.toLowerCase().includes(searchName.toLowerCase())
      )
    }

    // Filter by category
    if (searchCategory) {
      filtered = filtered.filter(place => place.type === searchCategory)
    }

    // Filter by active status
    if (searchActive !== '') {
      const isActive = searchActive === 'true'
      filtered = filtered.filter(place => place.is_active === isActive)
    }

    // Filter by display status (한국 시간 기준)
    if (searchDisplayStatus) {
      filtered = filtered.filter(place => {
        const status = getDisplayStatusFromPeriods(place.display_periods, place.display_start_date, place.display_end_date)
        switch (searchDisplayStatus) {
          case 'active':
            return status === 'active'
          case 'scheduled':
            return status === 'scheduled'
          case 'expired':
            return status === 'expired'
          case 'unlimited':
            return status === 'unlimited'
          default:
            return true
        }
      })
    }

    // Filter by display period date range (KST 날짜 키로 기간 겹침 비교)
    if (searchDisplayStartDate || searchDisplayEndDate) {
      const searchStartK = searchDisplayStartDate ? getKSTDateKey(new Date(searchDisplayStartDate)) : null
      const searchEndK = searchDisplayEndDate ? getKSTDateKey(new Date(searchDisplayEndDate)) : null
      filtered = filtered.filter(place => {
        const placeStart = place.display_start_date ? new Date(place.display_start_date) : null
        const placeEnd = place.display_end_date ? new Date(place.display_end_date) : null
        const placeStartK = getKSTDateKey(placeStart)
        const placeEndK = getKSTDateKey(placeEnd)
        if (searchStartK != null && searchEndK != null) {
          const placeStartsBeforeSearchEnd = placeStartK == null || placeStartK <= searchEndK
          const placeEndsAfterSearchStart = placeEndK == null || placeEndK >= searchStartK
          return placeStartsBeforeSearchEnd && placeEndsAfterSearchStart
        }
        if (searchStartK != null) return placeStartK == null || placeStartK <= searchStartK
        if (searchEndK != null) return placeEndK == null || placeEndK >= searchEndK
        return true
      })
    }

    setFilteredPlaces(filtered)
  }

  const getVibeLabel = (vibe) => {
    const vibeMap = {
      'verybusy': '🔥 Very Busy',
      'busy': '⏱️ Busy',
      'nowait': '✅ No Wait',
      'quiet': '🟢 Quiet',
      'soldout': '❌ Sold Out'
    }
    return vibeMap[vibe] || vibe
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    // Supabase stores timestamps in UTC (TIMESTAMP WITH TIME ZONE)
    // Use toLocaleString with timeZone option for accurate KST conversion
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateParts = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    const datePart = date.toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const timePart = date.toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
    })
    return { date: datePart, time: timePart }
  }

  const formatDisplayPeriod = (place) => {
    const effectivePeriod = getDisplayPeriodForAdminList(
      place.display_periods,
      place.display_start_date,
      place.display_end_date
    )
    if (!effectivePeriod || (!effectivePeriod.start && !effectivePeriod.end)) {
      return <span className="text-xs text-gray-500">무제한</span>
    }
    const status = getDisplayStatusFromPeriods(place.display_periods, place.display_start_date, place.display_end_date)
    const statusColor = status === 'active' ? 'text-green-400' : status === 'scheduled' ? 'text-yellow-400' : status === 'expired' ? 'text-red-400' : 'text-gray-500'
    const startStr = effectivePeriod.start ? formatUtcAsKstDisplay(effectivePeriod.start) : '시작일 없음'
    const endStr = effectivePeriod.end ? formatUtcAsKstDisplay(effectivePeriod.end) : '종료일 없음'

    return (
      <div className="space-y-1">
        <div className={`text-xs ${statusColor} font-semibold`}>
          {status === 'active' && '노출 중'}
          {status === 'scheduled' && '노출 예정'}
          {status === 'expired' && '노출 종료'}
          {status === 'unlimited' && '무제한'}
        </div>
        <div className="text-xs text-gray-400 space-y-0.5">
          <div>{startStr}</div>
          <div>{endStr}</div>
        </div>
      </div>
    )
  }

  const handleAddNew = () => {
    setEditingPlace(null)
    setShowForm(true)
  }

  const handleEdit = (place) => {
    setEditingPlace(place)
    setShowForm(true)
  }

  const handleResetFilters = () => {
    setSearchName('')
    setSearchCategory('')
    setSearchActive('')
    setSearchDisplayStatus('')
    setSearchDisplayStartDate('')
    setSearchDisplayEndDate('')
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ADFF2F] mx-auto mb-4"></div>
        <p className="text-gray-400">로딩 중...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">장소관리</h2>
        {!showForm && (
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-[#ADFF2F] text-black rounded-lg hover:bg-[#ADFF2F]/90 transition-colors font-semibold"
          >
            + 장소 등록
          </button>
        )}
      </div>

      {showForm ? (
        <PlaceForm
          place={editingPlace}
          categories={categories}
          tagGroups={tagGroups}
          onClose={() => {
            setShowForm(false)
            setEditingPlace(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingPlace(null)
            loadData()
          }}
          onDeletePlace={deletePlace}
        />
      ) : (
        <>
          {/* Search Filters */}
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">장소명</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="장소명 검색..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">카테고리</label>
                <select
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                >
                  <option value="">전체</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.code_value}>
                      {formatCommonCodeLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">활성화 여부</label>
                <select
                  value={searchActive}
                  onChange={(e) => setSearchActive(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                >
                  <option value="">전체</option>
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">노출 상태</label>
                <select
                  value={searchDisplayStatus}
                  onChange={(e) => setSearchDisplayStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                >
                  <option value="">전체</option>
                  <option value="active">노출 중</option>
                  <option value="scheduled">노출 예정</option>
                  <option value="expired">노출 종료</option>
                  <option value="unlimited">무제한</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">노출 시작일 (이후)</label>
                <input
                  type="date"
                  value={searchDisplayStartDate}
                  onChange={(e) => setSearchDisplayStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">노출 종료일 (이전)</label>
                <input
                  type="date"
                  value={searchDisplayEndDate}
                  onChange={(e) => setSearchDisplayEndDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleResetFilters}
                  className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          </div>

          {/* Places Table */}
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap">장소명</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap">카테고리</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap w-40">최근 상태</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap w-24">포스팅 수</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap w-28">활성화</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap w-48">노출기간</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap w-40">등록일</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold whitespace-nowrap w-24">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => {
                      const category = categories.find(c => c.code_value === place.type)
                      const recentParts = formatDateParts(place.recentPostTime)
                      const createdParts = formatDateParts(place.created_at)
                      return (
                        <tr key={place.id} className="hover:bg-gray-800/50">
                          <td className="px-6 py-4">
                            <p className="font-medium">{place.name}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">
                            {formatCommonCodeLabel(category) || place.type || '-'}
                          </td>
                          <td className="px-6 py-4 align-top">
                            {place.recentVibe ? (
                              <span className="text-sm text-[#ADFF2F]">
                                {getVibeLabel(place.recentVibe)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">-</span>
                            )}
                            {recentParts && (
                              <div className="text-xs text-gray-500 mt-1 leading-tight">
                                <div>{recentParts.date}</div>
                                <div>{recentParts.time}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                            {place.postCount || 0}개
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                                place.is_active
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {place.is_active ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {formatDisplayPeriod(place)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300 align-top">
                            {createdParts && (
                              <div className="text-xs text-gray-300 leading-tight">
                                <div>{createdParts.date}</div>
                                <div>{createdParts.time}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(place)}
                              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm whitespace-nowrap"
                            >
                              수정
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                        {places.length === 0 ? '등록된 장소가 없습니다.' : '검색 결과가 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// DB 일시 문자열 → { date: 'YYYY-MM-DD', time: 'HH:mm' | '' } (00:00:00 / 23:59:59는 시간 미입력으로 간주)
function parseDbToDateAndTime(dbStr) {
  if (!dbStr) return { date: '', time: '' }
  const s = typeof dbStr === 'string' ? dbStr : String(dbStr)
  const match = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return { date: s.slice(0, 10) || '', time: '' }
  const [, date, h, min] = match
  const pad = (n) => String(n).padStart(2, '0')
  const hi = parseInt(h, 10)
  const mini = parseInt(min, 10)
  if (hi === 0 && mini === 0) return { date, time: '' }
  if (hi === 23 && mini === 59) return { date, time: '' }
  return { date, time: `${pad(hi)}:${pad(mini)}` }
}

// 노출기간 초기값: display_periods 또는 단일 display_start_date/display_end_date → [{ startDate, startTime, endDate, endTime }, ...]
function initialDisplayPeriods(place) {
  const toRow = (startDb, endDb) => {
    const s = parseDbToDateAndTime(startDb)
    const e = parseDbToDateAndTime(endDb)
    return { startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time }
  }
  if (Array.isArray(place?.display_periods) && place.display_periods.length > 0) {
    return place.display_periods.map((p) => toRow(p.display_start_date, p.display_end_date))
  }
  if (place?.display_start_date || place?.display_end_date) {
    return [toRow(place.display_start_date, place.display_end_date)]
  }
  return []
}

// 오늘 날짜(브라우저 기준)를 "YYYY-MM-DD" 문자열로 반환
function getTodayDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PlaceForm = ({ place, categories, tagGroups, onClose, onSuccess, onDeletePlace }) => {
  const initialPeriods = initialDisplayPeriods(place)
  const [formData, setFormData] = useState({
    // 다국어 장소명/설명: name(ko), name_en(en), description(ko), description_en(en)
    name_ko: place?.name || '',
    name_en: place?.name_en || '',
    type: place?.type || '',
    description_ko: place?.description || '',
    description_en: place?.description_en || '',
    lat: place?.lat || '',
    lng: place?.lng || '',
    is_active: place?.is_active !== undefined ? place.is_active : true,
    display_periods: initialPeriods.length > 0 ? initialPeriods : [],
    unlimited_display: initialPeriods.length === 0,
    info_url: place?.info_url || '',
    phone: place?.phone || '',
  })
  const [selectedTags, setSelectedTags] = useState(Array.isArray(place?.hashtags) ? place.hashtags : [])
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(place?.thumbnail_url || null)
  const [shouldRemoveThumbnail, setShouldRemoveThumbnail] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [addressQuery, setAddressQuery] = useState('')
  const [geoMessage, setGeoMessage] = useState('')
  
  // Map state
  const [markerPosition, setMarkerPosition] = useState(
    place?.lat && place?.lng ? [parseFloat(place.lat), parseFloat(place.lng)] : null
  )
  const [mapCenter, setMapCenter] = useState(
    place?.lat && place?.lng 
      ? [parseFloat(place.lat), parseFloat(place.lng)]
      : [37.5446, 127.0559] // 기본값: 성수동
  )
  const [mapZoom, setMapZoom] = useState(place?.lat && place?.lng ? 16 : 13)

  const handleAddressSearch = async () => {
    const q = addressQuery.trim()
    if (!q) {
      setGeoMessage('검색할 주소를 입력하세요.')
      return
    }
    try {
      setGeoMessage('주소를 찾는 중입니다...')
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`
      )
      if (!res.ok) {
        throw new Error('주소 검색에 실패했습니다.')
      }
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) {
        setGeoMessage('검색 결과가 없습니다. 주소를 다시 확인해주세요.')
        return
      }
      const first = data[0]
      const lat = parseFloat(first.lat)
      const lng = parseFloat(first.lon)
      if (isNaN(lat) || isNaN(lng)) {
        setGeoMessage('검색 결과에서 좌표를 해석할 수 없습니다.')
        return
      }
      setMarkerPosition([lat, lng])
      setMapCenter([lat, lng])
      setMapZoom(17)
      setFormData((prev) => ({
        ...prev,
        lat: lat.toString(),
        lng: lng.toString(),
      }))
      setGeoMessage('주소를 기준으로 위치를 설정했습니다.')
    } catch (err) {
      console.error('주소 검색 오류:', err)
      setGeoMessage('주소 검색 중 오류가 발생했습니다.')
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 위도/경도가 직접 입력되면 마커 위치와 지도 중심 업데이트
    // (직접 입력 시에만 mapCenter 업데이트하여 지도 재생성 방지)
    if (field === 'lat' || field === 'lng') {
      const lat = field === 'lat' ? parseFloat(value) : parseFloat(formData.lat)
      const lng = field === 'lng' ? parseFloat(value) : parseFloat(formData.lng)
      
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        setMarkerPosition([lat, lng])
        // 직접 입력 시에만 mapCenter 업데이트 (지도 클릭/드래그 시에는 업데이트하지 않음)
        setMapCenter([lat, lng])
        setMapZoom(16) // 직접 입력 시에는 확대
      }
    }
  }

  const setDisplayPeriod = (index, key, value) => {
    setFormData((prev) => {
      const next = [...(prev.display_periods || [])]
      const base = next[index] || { startDate: '', startTime: '', endDate: '', endTime: '' }
      let updated = { ...base, [key]: value }

      // 시작일이 선택되면, 종료일이 비어 있거나 더 이전이면 시작일로 맞춰줌
      if (key === 'startDate' && value) {
        if (!updated.endDate || updated.endDate < value) {
          updated = { ...updated, endDate: value }
        }
      }

      next[index] = updated
      return { ...prev, display_periods: next }
    })
  }

  const addDisplayPeriod = () => {
    const today = getTodayDateString()
    setFormData((prev) => ({
      ...prev,
      display_periods: [
        ...(prev.display_periods || []),
        { startDate: today, startTime: '', endDate: today, endTime: '' },
      ],
      unlimited_display: false,
    }))
  }

  const removeDisplayPeriod = (index) => {
    setFormData((prev) => {
      const next = (prev.display_periods || []).filter((_, i) => i !== index)
      return {
        ...prev,
        display_periods: next.length > 0 ? next : [{ startDate: '', startTime: '', endDate: '', endTime: '' }],
        unlimited_display: next.length === 0,
      }
    })
  }

  // Leaflet 기본 아이콘 설정
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setThumbnailPreview(reader.result)
    }
    reader.readAsDataURL(file)

    setThumbnailFile(file)
    setShouldRemoveThumbnail(false)
    setError('')
  }

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    }

    try {
      return await imageCompression(file, options)
    } catch (error) {
      console.error('Error compressing image:', error)
      return file
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validation
    if (!formData.name_ko.trim()) {
      setError('장소명(한국어)을 입력해주세요.')
      return
    }

    if (!formData.type) {
      setError('카테고리를 선택해주세요.')
      return
    }

    setIsUploading(true)

    try {
      let thumbnailUrl = place?.thumbnail_url || null

      // 기존 대표사진 삭제 요청 (새 파일 업로드가 있으면 업로드가 우선)
      if (shouldRemoveThumbnail && !thumbnailFile) {
        thumbnailUrl = null
      }

      // Upload thumbnail if new file selected
      if (thumbnailFile) {
        const compressedFile = await compressImage(thumbnailFile)
        const timestamp = Date.now()
        const fileExtension = compressedFile?.name?.split('.').pop() || 'jpg'
        const baseName = (formData.name_ko || formData.name_en || place?.name || 'place').trim()
        const safeName = baseName
          .replace(/\s+/g, '_')
          .replace(/[^\w\-]+/g, '')
          .slice(0, 60) || 'place'
        const thumbnailPath = `places/${timestamp}_${safeName}.${fileExtension}`

        const { data: uploadData, error: uploadError } = await db.uploadImage(compressedFile, thumbnailPath)

        if (uploadError) {
          throw new Error('대표사진 업로드에 실패했습니다.')
        }

        thumbnailUrl = uploadData.publicUrl
      }

      // 복수 노출기간: 무제한이면 [], 아니면 구간 배열. 날짜 필수, 시간 선택(미입력 시 시작 00:00, 종료 23:59:59)
      const display_periods = formData.unlimited_display
        ? []
        : (formData.display_periods || [])
            .filter((p) => p.startDate && p.endDate)
            .map((p) => {
              const start = `${p.startDate} ${p.startTime ? (p.startTime.length === 5 ? p.startTime + ':00' : p.startTime) : '00:00:00'}`
              const end = `${p.endDate} ${p.endTime ? (p.endTime.length === 5 ? p.endTime + ':00' : p.endTime) : '23:59:59'}`
              return { start: kstDateTimeToDbString(start) || null, end: kstDateTimeToDbString(end) || null }
            })
            .filter((p) => p.start != null && p.end != null)

      const payload = {
        name: formData.name_ko.trim(),
        name_en: formData.name_en?.trim() || null,
        type: formData.type,
        description: formData.description_ko || '',
        // description_en은 추후 백엔드 확장 시 전달
        lat: formData.lat,
        lng: formData.lng,
        is_active: formData.is_active,
        display_periods,
        unlimited_display: formData.unlimited_display,
        info_url: formData.info_url,
        phone: formData.phone,
        thumbnail_url: thumbnailUrl,
        hashtags: selectedTags,
      }

      const result = await savePlace(payload, place?.id || null)

      if (!result.success) {
        throw new Error(result.error || '장소 저장에 실패했습니다.')
      }

      setSuccess(place ? '장소가 수정되었습니다.' : '장소가 등록되었습니다.')
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (err) {
      console.error('Error saving place:', err)
      setError(err.message || '장소 저장에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-6">
        {place ? '장소 수정' : '장소 등록'}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            카테고리 <span className="text-red-400">*</span>
          </label>
          <select
            value={formData.type}
            onChange={(e) => handleInputChange('type', e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
          >
            <option value="">카테고리 선택</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.code_value}>
                {formatCommonCodeLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Name (KO/EN) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              장소명 (한국어) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name_ko}
              onChange={(e) => handleInputChange('name_ko', e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
              placeholder="예: 디올 성수 팝업스토어"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              장소명 (영문) <span className="text-gray-500 text-xs">(선택)</span>
            </label>
            <input
              type="text"
              value={formData.name_en}
              onChange={(e) => handleInputChange('name_en', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
              placeholder="예: Dior Seongsu Pop-up"
            />
          </div>
        </div>

        {/* Thumbnail */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            대표사진 <span className="text-gray-500 text-xs">(선택)</span>
          </label>
          {thumbnailPreview && (
            <div className="mb-4">
              <div className="max-w-md max-h-64 flex items-center justify-center rounded-lg border border-gray-700 overflow-hidden bg-gray-800">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="max-w-full max-h-64 w-auto h-auto object-contain"
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailFile(null)
                    setThumbnailPreview(null)
                    setShouldRemoveThumbnail(true)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 hover:border-red-400/60 hover:text-red-300 transition-colors"
                >
                  대표사진 삭제
                </button>
                {shouldRemoveThumbnail && (
                  <span className="text-xs text-gray-400">
                    저장하면 대표사진이 제거됩니다.
                  </span>
                )}
              </div>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#ADFF2F] file:text-black hover:file:bg-[#ADFF2F]/90"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            위치 설정 <span className="text-gray-500 text-xs">(선택)</span>
          </label>

          {/* 주소 검색 */}
          <div className="mb-3 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-gray-400 mb-1">주소 검색 (도로명/지번)</label>
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => {
                  setAddressQuery(e.target.value)
                  setGeoMessage('')
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    await handleAddressSearch()
                  }
                }}
                placeholder="예: 서울 성동구 성수이로 89"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleAddressSearch}
              className="px-4 py-2 bg-[#ADFF2F] text-black rounded-lg hover:bg-[#ADFF2F]/90 transition-colors text-sm font-semibold"
            >
              검색
            </button>
          </div>
          {geoMessage && (
            <p className="text-xs mb-2 text-gray-400">
              {geoMessage}
            </p>
          )}

          <p className="text-xs text-gray-400 mb-2">
            지도를 클릭하여 위치를 선택하거나, 주소 검색 또는 아래 입력란에 직접 좌표를 입력할 수 있습니다.
          </p>
          
          {/* Map (Naver) */}
          <AdminNaverMap
            lat={formData.lat}
            lng={formData.lng}
            onChangeLatLng={(newLat, newLng) => {
              setFormData(prev => ({ ...prev, lat: newLat, lng: newLng }))
            }}
          />

          {/* Coordinate inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                위도 (Latitude)
              </label>
              <input
                type="number"
                step="any"
                value={formData.lat}
                onChange={(e) => handleInputChange('lat', e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                placeholder="37.5432"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                경도 (Longitude)
              </label>
              <input
                type="number"
                step="any"
                value={formData.lng}
                onChange={(e) => handleInputChange('lng', e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                placeholder="127.0543"
              />
            </div>
          </div>
        </div>

        {/* Description (KO) & Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col h-full">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              설명 (한국어) <span className="text-gray-500 text-xs">(선택)</span>
            </label>
            <textarea
              value={formData.description_ko}
              onChange={(e) => handleInputChange('description_ko', e.target.value)}
              rows={6}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white resize-none flex-1 min-h-[160px]"
              placeholder="장소에 대한 설명을 한국어로 입력하세요..."
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Info URL <span className="text-gray-500 text-xs">(선택, 새 탭에서 열림)</span>
              </label>
              <input
                type="url"
                value={formData.info_url}
                onChange={(e) => handleInputChange('info_url', e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                placeholder="https://example.com/info"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                전화번호 <span className="text-gray-500 text-xs">(선택)</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                placeholder="예: 02-123-4567"
              />
            </div>
            {/* Description (English) – 추후 사용자 화면에서 사용 예정 */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                설명 (영어) <span className="text-gray-500 text-xs">(선택)</span>
              </label>
              <textarea
                value={formData.description_en}
                onChange={(e) => handleInputChange('description_en', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white resize-none"
                placeholder="Description in English (for international users)..."
              />
            </div>
            {/* Tags from common codes */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Tags <span className="text-gray-500 text-xs">(선택)</span>
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
                {tagGroups?.admission?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Admission</p>
                    <div className="flex flex-wrap gap-2">
                      {tagGroups.admission.map((tag) => (
                        <label
                          key={tag.code_value}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/60 text-gray-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded bg-gray-900 border-gray-600 text-[#ADFF2F] focus:ring-[#ADFF2F]"
                            checked={selectedTags.includes(tag.code_value)}
                            onChange={(e) => {
                              setSelectedTags((prev) =>
                                e.target.checked
                                  ? [...prev, tag.code_value]
                                  : prev.filter((v) => v !== tag.code_value)
                              )
                            }}
                          />
                          <span>{formatCommonCodeLabel(tag)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {tagGroups?.benefit?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Benefits</p>
                    <div className="flex flex-wrap gap-2">
                      {tagGroups.benefit.map((tag) => (
                        <label
                          key={tag.code_value}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/60 text-gray-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded bg-gray-900 border-gray-600 text-[#ADFF2F] focus:ring-[#ADFF2F]"
                            checked={selectedTags.includes(tag.code_value)}
                            onChange={(e) => {
                              setSelectedTags((prev) =>
                                e.target.checked
                                  ? [...prev, tag.code_value]
                                  : prev.filter((v) => v !== tag.code_value)
                              )
                            }}
                          />
                          <span>{formatCommonCodeLabel(tag)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {tagGroups?.amenity?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Amenities</p>
                    <div className="flex flex-wrap gap-2">
                      {tagGroups.amenity.map((tag) => (
                        <label
                          key={tag.code_value}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/60 text-gray-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded bg-gray-900 border-gray-600 text-[#ADFF2F] focus:ring-[#ADFF2F]"
                            checked={selectedTags.includes(tag.code_value)}
                            onChange={(e) => {
                              setSelectedTags((prev) =>
                                e.target.checked
                                  ? [...prev, tag.code_value]
                                  : prev.filter((v) => v !== tag.code_value)
                              )
                            }}
                          />
                          <span>{formatCommonCodeLabel(tag)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {tagGroups?.content?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">Content</p>
                    <div className="flex flex-wrap gap-2">
                      {tagGroups.content.map((tag) => (
                        <label
                          key={tag.code_value}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800/60 text-gray-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded bg-gray-900 border-gray-600 text-[#ADFF2F] focus:ring-[#ADFF2F]"
                            checked={selectedTags.includes(tag.code_value)}
                            onChange={(e) => {
                              setSelectedTags((prev) =>
                                e.target.checked
                                  ? [...prev, tag.code_value]
                                  : prev.filter((v) => v !== tag.code_value)
                              )
                            }}
                          />
                          <span>{formatCommonCodeLabel(tag)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Display Period (복수 구간 지원) */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">
            노출기간 <span className="text-gray-500 text-xs">(선택)</span>
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.unlimited_display}
                onChange={(e) => {
                  const checked = e.target.checked
                  const today = getTodayDateString()
                  setFormData((prev) => ({
                    ...prev,
                    unlimited_display: checked,
                    display_periods: checked
                      ? []
                      : (prev.display_periods?.length
                          ? prev.display_periods
                          : [{ startDate: today, startTime: '', endDate: today, endTime: '' }]),
                  }))
                }}
                className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-[#ADFF2F] focus:ring-[#ADFF2F]"
              />
              <span className="text-sm text-gray-300">무제한 노출</span>
            </label>

            {!formData.unlimited_display && (
              <div className="space-y-4 pl-6">
                {(formData.display_periods || []).map((period, index) => (
                  <div key={index} className="flex gap-2 items-end flex-wrap">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 min-w-0">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">시작일 <span className="text-red-400">(필수)</span></label>
                        <input
                          type="date"
                          value={period.startDate || ''}
                          onChange={(e) => setDisplayPeriod(index, 'startDate', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">시작 시간 (선택)</label>
                        <input
                          type="time"
                          value={period.startTime || ''}
                          onChange={(e) => setDisplayPeriod(index, 'startTime', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">종료일 <span className="text-red-400">(필수)</span></label>
                        <input
                          type="date"
                          value={period.endDate || ''}
                          min={period.startDate || ''}
                          onChange={(e) => setDisplayPeriod(index, 'endDate', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">종료 시간 (선택)</label>
                        <input
                          type="time"
                          value={period.endTime || ''}
                          onChange={(e) => setDisplayPeriod(index, 'endTime', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDisplayPeriod(index)}
                      className="px-3 py-2 bg-gray-700 hover:bg-red-900/50 text-gray-300 hover:text-red-400 rounded-lg text-sm shrink-0"
                      title="이 구간 삭제"
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDisplayPeriod}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-lg text-sm text-gray-400 hover:text-[#ADFF2F] transition-colors"
                >
                  + 노출기간 추가
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Status */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-[#ADFF2F] focus:ring-[#ADFF2F]"
            />
            <span className="text-sm text-gray-300">활성화</span>
          </label>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              disabled={isUploading || isDeleting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#ADFF2F] hover:bg-[#ADFF2F]/90 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUploading || isDeleting}
            >
              {isUploading ? '저장 중...' : place ? '수정' : '등록'}
            </button>
          </div>
          {place?.id && onDeletePlace && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('이 장소를 삭제하시겠습니까?')) return
                setIsDeleting(true)
                setError('')
                const result = await onDeletePlace(place.id)
                if (result.success) {
                  setSuccess('장소가 삭제되었습니다.')
                  setTimeout(() => onSuccess(), 500)
                } else {
                  setError(result.error || '삭제에 실패했습니다.')
                }
                setIsDeleting(false)
              }}
              className="w-full px-4 py-2 bg-red-900/80 hover:bg-red-900 text-red-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUploading || isDeleting}
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default PlacesManagement
