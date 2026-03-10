import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import exifr from 'exifr'
import imageCompression from 'browser-image-compression'
import Masonry from 'react-masonry-css'
import { auth, db, supabase } from './lib/supabase'
import { useNaverMapSdk } from './lib/useNaverMapSdk'
import { getUserLocation, calculateDistance, formatDistance } from './utils/geolocation'
import { getCommonCodes, getCustomPlaceNames } from './lib/admin'
import { formatUtcAsKstDisplay, formatKstDisplayDateOnly, isDateOnlyPeriod, getTodayKSTDateKey, getKstDateKeyFromString, getCalendarDaysBetweenKeys, getCurrentOrNextPeriod } from './lib/kstDateUtils.js'

// 간단 i18n 문자열
const I18N = {
  navDiscover: { ko: '발견', en: 'Discover' },
  navMap: { ko: '지도', en: 'Map' },
  navMy: { ko: '마이', en: 'My' },
  discoverTitle: { ko: '발견', en: 'Discover' },
  discoverSortDistance: { ko: '거리순', en: 'Distance' },
  discoverSortLatest: { ko: '최신순', en: 'Latest' },
  discoverSortHot: { ko: '인기순', en: 'Hot' },
  discoverNoSpots: { ko: '현재 노출 중인 팝업이 없습니다.', en: 'No pop-up stores available.' },
  mapTitle: { ko: '팝업 지도', en: 'Pop-up Map' },
  mapActiveSignals: { ko: '위치 정보가 있는 포스트', en: 'active signals' },
  mapNoLocation: { ko: '위치 데이터가 없습니다.', en: 'No location data available' },

  // 댓글 영역
  commentTitle: { ko: '댓글', en: 'Comments' },
  commentLoginRequired: {
    ko: '로그인 후 댓글을 작성할 수 있습니다.',
    en: 'Please log in to write a comment.',
  },
  commentPlaceholder: {
    ko: '장소에 대한 댓글을 남겨주세요...',
    en: 'Leave a comment about this place...',
  },
  commentAddPhoto: { ko: '사진 추가', en: 'Add photo' },
  commentSubmit: { ko: '등록', en: 'Post' },
  commentSubmitting: { ko: '등록 중...', en: 'Posting...' },
  commentLoading: {
    ko: '댓글을 불러오는 중입니다...',
    en: 'Loading comments...',
  },
  commentEmpty: {
    ko: '첫 댓글을 남겨보세요.',
    en: 'Be the first to comment.',
  },
  commentErrorNeedContent: {
    ko: '내용이나 사진 중 하나는 있어야 합니다.',
    en: 'You need text or at least one photo.',
  },
  commentErrorGeneric: {
    ko: '댓글 저장 중 오류가 발생했습니다.',
    en: 'An error occurred while saving the comment.',
  },
  commentAnonymous: { ko: '익명', en: 'Anonymous' },
}

// 사용자 지도용 컴포넌트 — App 바깥에 두어 줌 시 setLeafletZoom 리렌더만 하고 언마운트/재마운트 되지 않도록 함 (깜빡임 방지)
function LiveRadarNaverMap({
  center,
  mapItems,
  sdkReady,
  mapFocusSpot,
  onFocusDone,
  userLocation,
  onMapReady,
  onZoomChange,
  onMapClick,
  onClusterClick,
  onSpotClick,
  onPostClick,
  getSpotPopupHtml,
  getPostPopupHtml,
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const userLocMarkerRef = useRef(null)
  const infoWindowRef = useRef(null)
  const lastCenterRef = useRef(null)
  const lastZoomLevelRef = useRef(null) // 정수 줌만 보고 — zoom_changed가 연속 발생해도 마커 전체 재생성은 줌 레벨이 바뀔 때만

  const getClusterIconHtml = (count) =>
    `<div style="position:relative;width:48px;height:48px;"><div style="position:absolute;inset:0;border-radius:50%;background:#ADFF2F;opacity:0.75;"></div><div style="position:relative;width:48px;height:48px;border-radius:50%;background:#ADFF2F;border:2px solid #000;display:flex;align-items:center;justify-content:center;"><span style="color:#000;font-weight:bold;font-size:12px;">${count}+</span></div></div>`
  const getCustomIconHtml = (imageUrl, isAdmin) => {
    const borderColor = isAdmin ? '#ef4444' : '#ADFF2F'
    const src = imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzMzMzMzIi8+CjxwYXRoIGQ9Ik0zMiAyMEMyNS4zNzI2IDIwIDIwIDI1LjM3MjYgMjAgMzJDMjAgMzguNjI3NCAyNS4zNzI2IDQ0IDMyIDQ0QzM4LjYyNzQgNDQgNDQgMzguNjI3NCA0NCAzMkM0NCAyNS4zNzI2IDM4LjYyNzQgMjAgMzIgMjBaIiBmaWxsPSIjQUREQ0YyRiIvPgo8L3N2Zz4K'
    const escaped = String(src).replace(/"/g, '&quot;')
    return `<div style="position:relative;width:64px;height:80px;"><div style="position:relative;width:64px;height:64px;border-radius:50%;overflow:hidden;border:2px solid ${borderColor};background:#000;"><img src="${escaped}" alt="pin" style="width:100%;height:100%;object-fit:cover;" /></div><div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%) translateY(100%);"><div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:8px solid ${borderColor};"></div></div></div>`
  }

  useEffect(() => {
    if (!sdkReady || !window.naver?.maps || !mapRef.current || mapInstanceRef.current) return
    const map = new naver.maps.Map(mapRef.current, {
      center: new naver.maps.LatLng(center[0], center[1]),
      zoom: 16,
      minZoom: 6,
      zoomControl: false,
    })
    mapInstanceRef.current = map
    lastCenterRef.current = [center[0], center[1]]
    lastZoomLevelRef.current = 16
    if (onMapReady) onMapReady(map)
    const zoomListener = naver.maps.Event.addListener(map, 'zoom_changed', () => {
      const z = map.getZoom()
      const zInt = Math.round(z)
      if (onZoomChange && lastZoomLevelRef.current !== zInt) {
        lastZoomLevelRef.current = zInt
        onZoomChange(zInt)
      }
    })
    const clickListener = naver.maps.Event.addListener(map, 'click', () => {
      // 지도 빈 공간 클릭 시 현재 열린 팝업 닫기
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }
      if (onMapClick) onMapClick()
    })
    return () => {
      naver.maps.Event.removeListener(zoomListener)
      naver.maps.Event.removeListener(clickListener)
      if (onMapReady) onMapReady(null)
      mapInstanceRef.current = null
      lastCenterRef.current = null
      lastZoomLevelRef.current = null
    }
  }, [sdkReady])

  // 중심은 “지역 선택” 등으로 실제로 바뀐 경우에만 이동. 줌 시 부모 리렌더로 center가 새 배열로 넘어와도 좌표가 같으면 setCenter 호출 안 함.
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !center || center.length < 2) return
    const lat = center[0]
    const lng = center[1]
    const last = lastCenterRef.current
    if (last && last[0] === lat && last[1] === lng) return
    lastCenterRef.current = [lat, lng]
    map.setCenter(new naver.maps.LatLng(lat, lng))
  }, [center])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapFocusSpot?.lat || !mapFocusSpot?.lng) return

    const targetLatLng = new naver.maps.LatLng(mapFocusSpot.lat, mapFocusSpot.lng)
    // 위치를 중심 근처로 이동
    map.setCenter(targetLatLng)
    // 너무 과하게 확대되지 않도록, 최대 확대에서 2~3단계 정도만 덜 확대
    const maxZoom = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : 21
    const focusZoom = Math.max(6, (maxZoom || 21) - 2)
    map.setZoom(focusZoom)

    // 지도에서 보기 버튼으로 진입한 경우, 해당 장소 팝업도 바로 열어줌
    const spot = mapFocusSpot
    if (spot && getSpotPopupHtml && onSpotClick) {
      const html = getSpotPopupHtml(spot)
      const wrap = document.createElement('div')
      wrap.innerHTML = html

      const infoWindow = infoWindowRef.current || new naver.maps.InfoWindow({ borderWidth: 0 })
      infoWindowRef.current = infoWindow

      const btn = wrap.querySelector('.naver-popup-view-detail')
      if (btn) {
        btn.addEventListener('click', () => {
          onSpotClick(spot)
          infoWindow.close()
        })
      }

      infoWindow.setContent(wrap)
      infoWindow.open(map, targetLatLng)

      // 팝업이 화면 중앙 근처에 보이도록, 약간 위로 올려서 시야 중심에 맞춤
      requestAnimationFrame(() => {
        // 위로 60px 정도 이동 (단말 해상도에 따라 대략적인 값)
        map.panBy(0, -60)
      })
    }

    if (onFocusDone) onFocusDone()
  }, [mapFocusSpot, onFocusDone, getSpotPopupHtml, onSpotClick])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (userLocMarkerRef.current) {
      userLocMarkerRef.current.setMap(null)
      userLocMarkerRef.current = null
    }
    if (userLocation?.lat != null && userLocation?.lng != null) {
      const el = document.createElement('div')
      el.innerHTML = `
        <div style="position:relative;width:32px;height:32px;margin-left:-16px;margin-top:-16px;">
          <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(59,130,246,0.7);animation:user-location-pulse 1.8s ease-out infinite;"></div>
          <div style="position:absolute;inset:0;border-radius:50%;background:#60A5FA;border:2px solid #3B82F6;box-shadow:0 0 0 4px rgba(59,130,246,0.35);"></div>
        </div>
      `
      el.className = 'user-location-marker'
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(userLocation.lat, userLocation.lng),
        map,
        icon: { content: el, anchor: new naver.maps.Point(16, 16) },
        zIndex: 1000,
      })
      userLocMarkerRef.current = marker
    }
    return () => {
      if (userLocMarkerRef.current) {
        userLocMarkerRef.current.setMap(null)
        userLocMarkerRef.current = null
      }
    }
  }, [userLocation])

  function openSameLocationCarousel(map, pos, posts, infoWindow, getSpotHtml, getPostHtml, onSpot, onPost) {
    const n = posts.length
    if (n === 0) return
    let index = 0
    const wrap = document.createElement('div')
    wrap.style.cssText = 'min-width:200px;max-width:min(280px,calc(100vw - 32px));box-sizing:border-box;position:relative;background:transparent;'
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;align-items:center;gap:16px;background:transparent;'
    const prevBtn = document.createElement('button')
    prevBtn.type = 'button'
    prevBtn.setAttribute('aria-label', '이전')
    prevBtn.innerHTML = '<span style="display:block;line-height:1;font-size:18px;">‹</span>'
    prevBtn.style.cssText = 'width:36px;height:36px;border-radius:50%;border:1px solid #6b7280;background:#374151;color:#fff;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;'
    const contentArea = document.createElement('div')
    contentArea.className = 'carousel-content'
    contentArea.style.flex = '1'
    contentArea.style.minWidth = '0'
    contentArea.style.display = 'flex'
    contentArea.style.justifyContent = 'center'
    const nextBtn = document.createElement('button')
    nextBtn.type = 'button'
    nextBtn.setAttribute('aria-label', '다음')
    nextBtn.innerHTML = '<span style="display:block;line-height:1;font-size:18px;">›</span>'
    nextBtn.style.cssText = 'width:36px;height:36px;border-radius:50%;border:1px solid #6b7280;background:#374151;color:#fff;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0;'
    row.appendChild(prevBtn)
    row.appendChild(contentArea)
    row.appendChild(nextBtn)
    const footer = document.createElement('div')
    footer.style.cssText = 'display:flex;justify-content:center;margin-top:12px;'
    const counter = document.createElement('span')
    counter.style.cssText = 'font-size:12px;color:#9ca3af;display:inline-block;padding:6px 12px;background:#111827;border-radius:8px;'
    footer.appendChild(counter)
    wrap.appendChild(row)
    wrap.appendChild(footer)

    function showSlide(i) {
      index = (i + n) % n
      const it = posts[index]
      const isPlace = it.source === 'place' || it.spotData
      const html = isPlace && it.spotData ? getSpotHtml(it.spotData) : getPostHtml(it)
      contentArea.innerHTML = html
      counter.textContent = `${index + 1} / ${n}`
      const btn = contentArea.querySelector('.naver-popup-view-detail')
      if (btn) {
        btn.addEventListener('click', () => {
          if (isPlace && it.spotData) onSpot(it.spotData)
          else onPost(it)
          infoWindow.close()
        })
      }
    }

    prevBtn.addEventListener('click', () => showSlide(index - 1))
    nextBtn.addEventListener('click', () => showSlide(index + 1))
    showSlide(0)
    infoWindow.setContent(wrap)
    infoWindow.open(map, pos)
    requestAnimationFrame(() => {
      let el = wrap.parentElement
      for (let i = 0; i < 3 && el; i++) {
        el.style.background = 'transparent'
        el = el.parentElement
      }
    })
  }

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapItems?.length) {
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      return
    }
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    // InfoWindow는 한 번만 생성해서 재사용 (포커스 이동/마커 클릭 모두 같은 윈도우 사용)
    let infoWindow = infoWindowRef.current
    if (!infoWindow) {
      infoWindow = new naver.maps.InfoWindow({ borderWidth: 0 })
      infoWindowRef.current = infoWindow
    }

    mapItems.forEach((item) => {
      const lat = item.centerLat ?? item.metadata?.lat
      const lng = item.centerLng ?? item.metadata?.lng
      if (lat == null || lng == null) return
      const pos = new naver.maps.LatLng(lat, lng)

      if (item.isCluster) {
        const div = document.createElement('div')
        div.innerHTML = getClusterIconHtml(item.count)
        div.style.cursor = 'pointer'
        const marker = new naver.maps.Marker({
          position: pos,
          map,
          icon: { content: div, anchor: new naver.maps.Point(24, 24) },
        })
        naver.maps.Event.addListener(marker, 'click', () => {
          if (item.sameLocationGroup && item.posts && item.posts.length > 1) {
            openSameLocationCarousel(map, pos, item.posts, infoWindow, getSpotPopupHtml, getPostPopupHtml, onSpotClick, onPostClick)
          } else if (onClusterClick) {
            onClusterClick(item)
          }
        })
        markersRef.current.push(marker)
        return
      }

      const isPlace = item.source === 'place' || item.spotData
      const spot = item.spotData
      const markerImage = item.image || item.images?.[0] || null
      const div = document.createElement('div')
      div.innerHTML = getCustomIconHtml(markerImage, !!isPlace)
      div.style.cursor = 'pointer'
      const marker = new naver.maps.Marker({
        position: pos,
        map,
        icon: { content: div, anchor: new naver.maps.Point(32, 80) },
      })

      naver.maps.Event.addListener(marker, 'click', () => {
        if (isPlace && spot) {
          const html = getSpotPopupHtml(spot)
          const wrap = document.createElement('div')
          wrap.innerHTML = html
          const btn = wrap.querySelector('.naver-popup-view-detail')
          if (btn) btn.addEventListener('click', () => { onSpotClick(spot); infoWindow.close() })
          infoWindow.setContent(wrap)
          infoWindow.open(map, pos)
        } else {
          const html = getPostPopupHtml(item)
          const wrap = document.createElement('div')
          wrap.innerHTML = html
          const btn = wrap.querySelector('.naver-popup-view-detail')
          if (btn) btn.addEventListener('click', () => { onPostClick(item); infoWindow.close() })
          infoWindow.setContent(wrap)
          infoWindow.open(map, pos)
        }
      })
      markersRef.current.push(marker)
    })
  }, [sdkReady, mapItems, onClusterClick, onSpotClick, onPostClick, getSpotPopupHtml, getPostPopupHtml])

  return <div ref={mapRef} className="w-full h-full" />
}

/** 하단 고정 메뉴 내용 영역 높이(px). 지도 paddingBottom과 동일하게 맞춰 빈틈 제거 */
const BOTTOM_NAV_CONTENT_HEIGHT = 72

function MapControls({ naverMapRef, userLocation, showPickedOnlyOnMap, onTogglePickedOnly, pickedPlaceIds, lang }) {
  const hasPicked = Array.isArray(pickedPlaceIds) && pickedPlaceIds.length > 0
  return (
    <div className="absolute right-3 z-[1100] flex flex-col gap-2" style={{ bottom: '40px' }}>
      {/* 픽한 장소만 보기 필터 (로그인 + 픽한 장소가 있을 때 표시) */}
      {hasPicked && (
        <button
          type="button"
          onClick={onTogglePickedOnly}
          className={`flex items-center justify-center w-10 h-10 rounded-full border shadow-lg transition-colors ${
            showPickedOnlyOnMap
              ? 'bg-[#ADFF2F]/30 border-[#ADFF2F] text-[#ADFF2F]'
              : 'bg-black/80 border-gray-600 text-gray-400 hover:border-[#ADFF2F]/50 hover:text-[#ADFF2F]'
          }`}
          aria-label={lang === 'ko' ? '픽한 장소만 보기' : 'Show picked only'}
          title={lang === 'ko' ? '픽한 장소만 보기' : 'Show picked only'}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      )}
      {userLocation && (
        <button
          type="button"
          onClick={() => {
            const map = naverMapRef?.current
            if (map && window.naver?.maps) {
              map.panTo(new naver.maps.LatLng(userLocation.lat, userLocation.lng))
              map.setZoom(16)
            }
          }}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/80 border border-[#ADFF2F]/50 text-[#ADFF2F] shadow-lg hover:bg-[#ADFF2F]/20 transition-colors"
          aria-label="현재 위치로 이동"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
          </svg>
        </button>
      )}
    </div>
  )
}

function App() {
  const location = useLocation()
  
  // /admin 경로에서는 App 컴포넌트를 렌더링하지 않음
  if (location.pathname.startsWith('/admin')) {
    return null
  }

  // 앱 시작 시 네이버 지도 SDK를 미리 로드해 첫 지도 진입 지연/레이스를 줄인다.
  const isNaverMapSdkReady = useNaverMapSdk()

  const [currentView, setCurrentView] = useState('discover')
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [postPlace, setPostPlace] = useState('')
  const [postCategory, setPostCategory] = useState('')
  const [postCustomPlace, setPostCustomPlace] = useState('')
  const [postVibe, setPostVibe] = useState('')
  const [postDescription, setPostDescription] = useState('')
  const [postMainImage, setPostMainImage] = useState(null)
  const [postAdditionalImages, setPostAdditionalImages] = useState([])
  const [postMetadata, setPostMetadata] = useState(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [vibePosts, setVibePosts] = useState([])
  const [isPosting, setIsPosting] = useState(false) // Post Vibe 업로드 중 상태
  const [mapZoom, setMapZoom] = useState(1) // 1 = 클러스터, 2 = 개별 핀
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [selectedPin, setSelectedPin] = useState(null)
  const [leafletZoom, setLeafletZoom] = useState(16) // 지도 실제 확대 수준 (확대 시 클러스터 해제용)
  const [spotFilter, setSpotFilter] = useState(null) // 장소 필터링 상태
  const [selectedPost, setSelectedPost] = useState(null) // 선택된 포스트 (Detail View)
  const [user, setUser] = useState(null) // 현재 로그인한 사용자
  const [showLoginModal, setShowLoginModal] = useState(false) // 로그인 모달 표시 여부
  const [hotSpots, setHotSpots] = useState([]) // 팝업스토어 목록 (Supabase에서 로드)
  const [isLoadingPosts, setIsLoadingPosts] = useState(true) // 포스트 로딩 상태
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true) // 장소 로딩 상태
  const [categories, setCategories] = useState([]) // 카테고리 목록
  const [selectedHotSpotCategory, setSelectedHotSpotCategory] = useState('popup_store') // Hot Spots Now에서 선택된 카테고리
  const [customPlaceNames, setCustomPlaceNames] = useState([]) // 사용자 입력 "기타" 장소명 목록
  const [postsError, setPostsError] = useState(null) // 포스트 로드 에러
  const [placesError, setPlacesError] = useState(null) // 장소 로드 에러
  const [placeTagLabelMap, setPlaceTagLabelMap] = useState({}) // code_value -> code_label (활성 태그만, 사용자 화면 표시용)
  const [postLikes, setPostLikes] = useState({}) // { postId: { count: number, liked: boolean } }
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false) // 삭제 확인 모달 표시 여부
  const [postToDelete, setPostToDelete] = useState(null) // 삭제할 포스트 ID
  const [userLocation, setUserLocation] = useState(null) // { lat: number, lng: number } | null
  const naverMapInstanceRef = useRef(null) // 사용자 지도(Naver) 인스턴스 - MapControls용 (ref로 두어 setState 루프 방지)
  const [lang, setLang] = useState(() => localStorage.getItem('spotvibe_lang') || 'ko') // 'ko' | 'en'
  const [showRunningOnly, setShowRunningOnly] = useState(true) // 진행 중인 팝업만 보기 (Discover/Map 공통)
  const [pickedPlaceIds, setPickedPlaceIds] = useState([]) // 사용자가 Pick한 장소 ID 목록
  const [placeIdsCommentedByUser, setPlaceIdsCommentedByUser] = useState([]) // 댓글 단 장소 ID 목록 (마이페이지용)
  const [showPickedOnlyOnMap, setShowPickedOnlyOnMap] = useState(false) // 지도에서 픽한 장소만 보기

  const regions = [
    { id: 'Seongsu', name: 'Seongsu', active: true },
    { id: 'Hongdae', name: 'Hongdae', active: false },
    { id: 'Hannam', name: 'Hannam', active: false },
    { id: 'Gangnam', name: 'Gangnam', active: false },
  ]

  // 공통코드 카테고리 라벨: DB의 code_label_ko / code_label_en 기준 다국어 (구 code_label 호환)
  const getCategoryLabel = (cat, l) => {
    if (!cat) return ''
    const ko = (cat.code_label_ko ?? cat.code_label ?? '').trim()
    const en = (cat.code_label_en ?? '').trim()
    return l === 'en' ? (en || ko) : (ko || en || '')
  }

  // 지역 선택 상태 복원 (새로고침 시 유지)
  // - 이전에는 여기서 currentView를 'feed'로 강제로 변경했지만,
  //   이는 초기 진입 시 Home 화면이 보이지 않거나 뷰 전환이 꼬이는 원인이 되었음.
  // - 지금은 선택된 지역만 복원하고, 화면 전환은 사용자의 명시적인 액션(지역 카드 클릭, 하단 네비 등)에만 맡김.
  useEffect(() => {
    const savedRegionId = localStorage.getItem('selectedRegionId')
    if (savedRegionId) {
      const savedRegion = regions.find((r) => r.id === savedRegionId)
      if (savedRegion && savedRegion.active) {
        setSelectedRegion(savedRegion)
      }
    }
  }, [])

  // 사용자 위치 가져오기
  useEffect(() => {
    const fetchUserLocation = async () => {
      const location = await getUserLocation()
      if (location) {
        setUserLocation(location)
      }
    }
    fetchUserLocation()
  }, [])

  // 언어 설정 유지
  useEffect(() => {
    if (lang) {
      localStorage.setItem('spotvibe_lang', lang)
    }
  }, [lang])

  // 브라우저 뒤로가기 처리
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state) {
        const { view, postId } = event.state
        if (view === 'post-detail' && postId) {
          // 포스트 상세 화면으로 복원
          const post = vibePosts.find(p => p.id === postId)
          if (post) {
            setSelectedPost(post)
            setCurrentView('post-detail')
          } else {
            // 포스트를 찾을 수 없으면 Feed로 이동
            setSelectedPost(null)
            setCurrentView('feed')
          }
        } else if (view === 'feed' || view === 'discover' || view === 'map' || view === 'my') {
          // 다른 뷰로 복원
          setSelectedPost(null)
          setCurrentView(view)
        }
      } else {
        // 히스토리 상태가 없으면 Feed로 이동
        setSelectedPost(null)
        setCurrentView('feed')
      }
    }

    window.addEventListener('popstate', handlePopState)
    
    // 초기 히스토리 상태 설정
    if (!window.history.state) {
      window.history.replaceState({ view: currentView }, '', '#')
    }

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [vibePosts, currentView])

  // GA/GTM: 화면 전환 시 screen_view 이벤트 전송 (discover/map/my 등 구분용)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.dataLayer) return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'screen_view',
      screen_name: currentView,
    })
  }, [currentView])

  // Supabase에서 포스트 데이터 로드
  useEffect(() => {
    const loadPosts = async () => {
      try {
        setIsLoadingPosts(true)
        setPostsError(null)
        const posts = await db.getPosts()
        setVibePosts(posts)
        
        // 좋아요 정보 로드
        if (posts.length > 0 && user?.id) {
          const postIds = posts.map(p => p.id)
          const { likeCounts, userLikes } = await db.getPostLikes(postIds, user.id)
          
          const likesData = {}
          postIds.forEach(postId => {
            likesData[postId] = {
              count: likeCounts[postId] || 0,
              liked: userLikes[postId] || false
            }
          })
          setPostLikes(likesData)
        } else if (posts.length > 0) {
          // 로그인하지 않은 경우 좋아요 개수만 로드
          const postIds = posts.map(p => p.id)
          const { likeCounts } = await db.getPostLikes(postIds)
          
          const likesData = {}
          postIds.forEach(postId => {
            likesData[postId] = {
              count: likeCounts[postId] || 0,
              liked: false
            }
          })
          setPostLikes(likesData)
        }
      } catch (error) {
        console.error('Error loading posts:', error)
        setPostsError('Failed to load posts. Please try again later.')
      } finally {
        setIsLoadingPosts(false)
      }
    }

    loadPosts()
  }, [user])

  // 로그인 사용자의 Pick한 장소 ID 목록 로드
  useEffect(() => {
    const loadPickedPlaces = async () => {
      if (!user?.id) {
        setPickedPlaceIds([])
        return
      }
      try {
        const ids = await db.getPickedPlaceIds(user.id)
        setPickedPlaceIds(ids || [])
      } catch (err) {
        console.error('Error loading picked places:', err)
        setPickedPlaceIds([])
      }
    }
    loadPickedPlaces()
  }, [user?.id])

  // 로그인 사용자가 댓글 단 장소 ID 목록 로드 (마이페이지용)
  useEffect(() => {
    const loadCommentedPlaces = async () => {
      if (!user?.id) {
        setPlaceIdsCommentedByUser([])
        return
      }
      try {
        const ids = await db.getPlaceIdsCommentedByUser(user.id)
        setPlaceIdsCommentedByUser(ids || [])
      } catch (err) {
        console.error('Error loading commented places:', err)
        setPlaceIdsCommentedByUser([])
      }
    }
    loadCommentedPlaces()
  }, [user?.id])

  // 장소 Pick 토글 (Discover 리스트/상세에서 사용)
  const handleTogglePlacePick = async (placeId, e) => {
    if (e) e.stopPropagation()
    if (!user?.id) {
      setShowLoginModal(true)
      return
    }
    try {
      const { picked } = await db.togglePlacePick(placeId, user.id)
      setPickedPlaceIds((prev) =>
        picked ? [...prev, placeId] : prev.filter((id) => id !== placeId)
      )
    } catch (err) {
      console.error('Error toggling place pick:', err)
    }
  }

  // Supabase에서 팝업스토어 목록 로드 및 정렬
  useEffect(() => {
    const loadPlaces = async () => {
      try {
        setIsLoadingPlaces(true)
        setPlacesError(null)
        const [places, admission, benefit, amenity, content] = await Promise.all([
          db.getPlaces(),
          getCommonCodes('place_tag_admission', false),
          getCommonCodes('place_tag_benefit', false),
          getCommonCodes('place_tag_amenity', false),
          getCommonCodes('place_tag_content', false),
        ])
        const labelMap = {}
        ;[...(admission || []), ...(benefit || []), ...(amenity || []), ...(content || [])].forEach((c) => {
          if (!c.code_value) return
          const ko = c.code_label_ko || c.code_label || ''
          const en = c.code_label_en || ko
          labelMap[c.code_value] = { ko, en }
        })
        setPlaceTagLabelMap(labelMap)
        
        // 장소별 포스팅 통계 (최신 Vibe 표시용) - 항상 계산
        const vibeIdToLabel = {
          verybusy: '🔥 Very Busy',
          busy: '⏱️ Busy',
          nowait: '✅ No Wait',
          quiet: '🟢 Quiet',
          soldout: '⚠️ Sold Out / Closed',
        }
        const getVibeLabel = (vibeId) => vibeIdToLabel[vibeId] || '🟢 Quiet'

        const placeStats = {}
        vibePosts.forEach((post) => {
          const placeName = post.placeName || post.place_name
          if (!placeName) return

          if (!placeStats[placeName]) {
            placeStats[placeName] = {
              count: 0,
              latestTimestamp: null,
              latestVibe: null,
            }
          }

          placeStats[placeName].count++

          const postTime = post.timestamp
            ? new Date(post.timestamp).getTime()
            : (post.metadata?.capturedAt
                ? new Date(post.metadata.capturedAt).getTime()
                : 0)

          if (
            !placeStats[placeName].latestTimestamp ||
            postTime > placeStats[placeName].latestTimestamp
          ) {
            placeStats[placeName].latestTimestamp = postTime
            placeStats[placeName].latestVibe = post.vibe || null
          }
        })

        // places를 hotSpots 형식으로 변환
        // - status: 사용자 최신 Vibe 라벨
        // - displayStatus: Supabase에서 계산된 노출 상태(active/scheduled/unlimited 등)
        let formattedPlaces = places.map((place) => {
          const stats = placeStats[place.name]
          const vibeLabel = stats?.latestVibe
            ? getVibeLabel(stats.latestVibe)
            : (place.status || '🟢 Quiet')
          return {
            id: place.id,
            name: place.name,
            nameEn: place.nameEn || place.name,
            type: place.type || 'other',
            status: vibeLabel,
            wait: place.wait || 'Quiet',
            lat: place.lat,
            lng: place.lng,
            thumbnail_url: place.thumbnail_url,
            description: place.description,
            created_at: place.created_at ? new Date(place.created_at) : null,
            display_start_date: place.display_start_date,
            display_end_date: place.display_end_date,
            display_periods: place.display_periods,
            displayStatus: place.displayStatus || 'active',
            info_url: place.info_url,
            phone: place.phone,
            hashtags: place.hashtags || [],
            commentCount: place.commentCount || 0,
            latestCommentAt: place.latestCommentAt ? new Date(place.latestCommentAt) : null,
          }
        })

        // 정렬 로직
        if (userLocation) {
          // GPS 위치가 있을 때: 거리순 정렬
          formattedPlaces = formattedPlaces
            .map((place) => {
              if (place.lat && place.lng) {
                const distance = calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  place.lat,
                  place.lng
                )
                return { ...place, distance }
              }
              return place
            })
            .sort((a, b) => {
              if (a.distance !== undefined && b.distance !== undefined) {
                return a.distance - b.distance
              }
              if (a.distance !== undefined) return -1
              if (b.distance !== undefined) return 1
              return 0
            })
        } else {
          // GPS 위치가 없을 때: 포스팅 수 → 최신 포스팅 시간 → 이름순
          formattedPlaces = formattedPlaces
            .map((place) => {
              const stats = placeStats[place.name] || { count: 0, latestTimestamp: 0 }
              return {
                ...place,
                postCount: stats.count,
                latestPostTime: stats.latestTimestamp,
              }
            })
            .sort((a, b) => {
              if (a.postCount !== b.postCount) {
                return b.postCount - a.postCount
              }
              if (a.latestPostTime !== b.latestPostTime) {
                return (b.latestPostTime || 0) - (a.latestPostTime || 0)
              }
              return a.name.localeCompare(b.name)
            })
        }

        setHotSpots(formattedPlaces)
      } catch (error) {
        console.error('Error loading places:', error)
        setPlacesError('Failed to load places. Please try again later.')
      } finally {
        setIsLoadingPlaces(false)
      }
    }

    loadPlaces()
  }, [userLocation, vibePosts])

  // 사용자 세션 확인 및 인증 상태 관리
  useEffect(() => {
    // 세션에서 사용자 정보 추출하는 헬퍼 함수
    const extractUserFromSession = (session) => {
      if (!session?.user) return null
      return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
        avatar: session.user.user_metadata?.avatar_url || null,
      }
    }

    // 세션 확인 및 사용자 상태 업데이트
    const checkSession = async () => {
      try {
        const { session, error } = await auth.getSession()
        if (error) {
          console.error('Session check error:', error)
          return
        }
        
        if (session?.user) {
          const userData = extractUserFromSession(session)
          if (userData) {
            setUser(userData)
            console.log('User session found:', userData)
          }
        } else {
          console.log('No active session')
          setUser(null)
        }
      } catch (error) {
        console.error('Error checking session:', error)
      }
    }

    // OAuth 리디렉션 후 hash 처리
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const error = hashParams.get('error')
      const errorDescription = hashParams.get('error_description')
      const errorCode = hashParams.get('error_code')
      
      // 모든 hash 파라미터 로그 (디버깅용)
      if (window.location.hash) {
        console.log('OAuth callback hash params:', {
          hash: window.location.hash,
          accessToken: accessToken ? 'present' : 'missing',
          error: error || 'none',
          errorDescription: errorDescription || 'none',
          errorCode: errorCode || 'none',
          allParams: Object.fromEntries(hashParams.entries())
        })
      }
      
      if (error) {
        console.error('OAuth error details:', {
          error,
          errorDescription,
          errorCode,
          fullHash: window.location.hash,
          currentUrl: window.location.href
        })
        
        // 사용자에게 친화적인 에러 메시지 표시
        alert(`로그인 오류가 발생했습니다.\n\n오류: ${error}\n${errorDescription ? `상세: ${errorDescription}` : ''}\n\n콘솔을 확인하여 자세한 정보를 확인하세요.`)
        
        window.history.replaceState(null, '', window.location.pathname)
        return
      }
      
      // hash에 access_token이 있거나, 리디렉션 직후라면 세션 확인
      if (accessToken || window.location.hash) {
        // Supabase가 세션을 설정할 시간을 주기 위해 약간 대기
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 세션 확인
        await checkSession()
        
        // URL에서 hash 제거
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      }
    }

    // 초기 세션 확인 및 OAuth 콜백 처리
    handleAuthCallback()
    
    // 추가로 세션 확인 (리디렉션 후 약간의 지연을 두고)
    setTimeout(() => {
      checkSession()
    }, 500)

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session)
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const userData = extractUserFromSession(session)
          if (userData) {
            setUser(userData)
            console.log('User signed in:', userData)
            
            // 로그인 성공 시 로그인 모달 닫고 Post Vibe 모달 열기
            if (showLoginModal) {
              setShowLoginModal(false)
              setIsModalOpen(true)
            }
          }
        }
        
        // URL에서 hash 제거
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        console.log('User signed out')
      } else if (session?.user) {
        // 기타 이벤트에서도 세션이 있으면 사용자 정보 업데이트
        const userData = extractUserFromSession(session)
        if (userData) {
          setUser(userData)
        }
      } else {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [showLoginModal])

  // 카테고리 목록 로드
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoryCodes = await getCommonCodes('place_category', false)
        setCategories(categoryCodes)
        // 기본 카테고리 설정 (popup_store가 있으면 그것, 없으면 첫 번째)
        if (categoryCodes.length > 0) {
          const popupStoreCategory = categoryCodes.find(cat => cat.code_value === 'popup_store')
          if (popupStoreCategory) {
            setSelectedHotSpotCategory('popup_store')
          } else {
            setSelectedHotSpotCategory(categoryCodes[0].code_value)
          }
        }
      } catch (error) {
        console.error('Error loading categories:', error)
      }
    }
    loadCategories()
  }, [])

  // 사용자 입력 "기타" 장소명 목록 로드
  useEffect(() => {
    const loadCustomPlaceNames = async () => {
      try {
        const names = await getCustomPlaceNames()
        setCustomPlaceNames(names)
      } catch (error) {
        console.error('Error loading custom place names:', error)
      }
    }
    loadCustomPlaceNames()
  }, [])

  // Post Vibe 모달에서 사용할 장소 목록 (카테고리별로 필터링)
  const getFilteredPlaces = () => {
    if (!postCategory || postCategory === 'other') {
      return []
    }
    
    // 선택한 카테고리에 해당하는 장소만 필터링
    const filtered = hotSpots.filter(spot => spot.type === postCategory)
    
    // 거리 정보가 있으면 거리순으로 정렬
    if (userLocation) {
      return filtered.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance
        }
        if (a.distance !== undefined) return -1
        if (b.distance !== undefined) return 1
        return a.name.localeCompare(b.name)
      })
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  const filteredPlaces = getFilteredPlaces()
  const vibeOptions = [
    { id: 'verybusy', label: '🔥 Very Busy', emoji: '🔥', description: '40min+' },
    { id: 'busy', label: '⏱️ Busy', emoji: '⏱️', description: '10-20min' },
    { id: 'nowait', label: '✅ No Wait', emoji: '✅', description: 'No Wait' },
    { id: 'quiet', label: '🟢 Quiet', emoji: '🟢', description: 'Quiet' },
    { id: 'soldout', label: '⚠️ Sold Out / Closed', emoji: '⚠️', description: 'Closed' },
  ]

  // 브라우저 스크롤 복원 비활성화
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  // Feed 뷰 언마운트 시 스크롤 위치 초기화
  // - 모든 훅은 조건부 렌더링(if currentView === '...') 이전에 위치해야 하므로 여기서 호출
  useEffect(() => {
    if (currentView !== 'feed') return
    
    return () => {
      // Feed 뷰가 언마운트될 때 스크롤 위치를 초기화하여
      // 다음 뷰(PostDetailView 등)로 전환 시 스크롤 위치가 유지되지 않도록 함
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
      }
    }
  }, [currentView])

  const handleRegionClick = (region) => {
    if (region.active) {
      setSelectedRegion(region)
      setCurrentView('discover') // 최초 진입 시 Discover 화면으로
      // localStorage에 저장 (새로고침 시 복원용)
      localStorage.setItem('selectedRegionId', region.id)
    } else {
      alert('준비 중입니다')
    }
  }

  const handlePlaceClick = (placeId) => {
    const place = hotSpots.find((p) => p.id === placeId)
    if (place) {
      setSpotFilter(placeId)
      setCurrentView('feed')
    }
  }

  const handlePostClick = (post) => {
    // 포스트 클릭 시 Detail View로 전환
    if (!post || !post.id) {
      console.error('Invalid post object:', post)
      return
    }
    
    // 스크롤을 최상단으로 강제 이동 (뷰 전환 전 - 모든 방법 시도)
    const forceScrollToTop = () => {
      // 즉시 스크롤 초기화 (모든 방법)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
        document.documentElement.scrollIntoView({ behavior: 'instant', block: 'start' })
      }
      if (document.body) {
        document.body.scrollTop = 0
      }
      // 모든 스크롤 가능한 요소 초기화
      const scrollableElements = document.querySelectorAll('[style*="overflow"], [class*="overflow"]')
      scrollableElements.forEach(el => {
        if (el.scrollTop > 0) {
          el.scrollTop = 0
        }
      })
    }
    
    // 즉시 실행 (여러 번) - setCurrentView 전에 확실히 초기화
    forceScrollToTop()
    forceScrollToTop()
    forceScrollToTop()
    
    // 원본 포스트 데이터 확인 (vibePosts에서 찾기)
    const originalPost = vibePosts.find(p => p.id === post.id) || post
    
    // 브라우저 히스토리에 추가
    window.history.pushState({ view: 'post-detail', postId: originalPost.id }, '', `#post-${originalPost.id}`)
    
    // 상태 변경 전에 한 번 더 스크롤 초기화
    requestAnimationFrame(() => {
      forceScrollToTop()
    })
    
    const fromView = currentView
    setViewBeforePostDetail(fromView)
    viewBeforePostDetailRef.current = fromView
    setSelectedPost(originalPost)
    setCurrentView('post-detail')
    
    // 뷰 전환 후에도 스크롤 위치 보장 (여러 타이밍에 걸쳐)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        forceScrollToTop()
        setTimeout(() => {
          forceScrollToTop()
          setTimeout(() => {
            forceScrollToTop()
          }, 10)
        }, 0)
      })
    })
    
    // 추가 보장을 위해 더 긴 지연 후에도 실행
    setTimeout(() => {
      forceScrollToTop()
    }, 50)
    setTimeout(() => {
      forceScrollToTop()
    }, 100)
  }
  
  const handleClosePostDetail = () => {
    const previousView = viewBeforePostDetail || viewBeforePostDetailRef.current || 'feed'
    window.history.pushState({ view: previousView }, '', previousView === 'feed' ? '#feed' : '#')
    setSelectedPost(null)
    setViewBeforePostDetail(null)
    viewBeforePostDetailRef.current = null
    setCurrentView(previousView)
  }
  
  // 브라우저 뒤로가기 처리 (포스트 상세에서 뒤로가기 시 진입 전 뷰로 복귀)
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state) {
        const { view, postId } = event.state
        if (view === 'post-detail' && postId) {
          const post = vibePosts.find(p => p.id === postId)
          if (post) {
            setSelectedPost(post)
            setCurrentView('post-detail')
          }
        } else if (view === 'feed' || view === 'map' || view === 'quest' || view === 'my') {
          setSelectedPost(null)
          setCurrentView(view)
        } else {
          setSelectedPost(null)
          setCurrentView(viewBeforePostDetailRef.current || 'feed')
        }
      } else {
        setSelectedPost(null)
        setCurrentView(viewBeforePostDetailRef.current || 'feed')
      }
    }

    window.addEventListener('popstate', handlePopState)
    if (!window.history.state) {
      window.history.replaceState({ view: currentView }, '', '#')
    }
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentView, vibePosts])

  // 좋아요 토글 함수
  const handleToggleLike = async (postId, e) => {
    e?.stopPropagation() // 이벤트 전파 방지
    
    if (!user?.id) {
      setShowLoginModal(true)
      return
    }

    try {
      const result = await db.togglePostLike(postId, user.id)
      const newCount = await db.getPostLikeCount(postId)
      
      // 로컬 state 업데이트
      setPostLikes(prev => ({
        ...prev,
        [postId]: {
          count: newCount,
          liked: result.liked
        }
      }))
    } catch (error) {
      console.error('Error toggling like:', error)
      alert('Failed to update like. Please try again.')
    }
  }

  // 삭제 확인 모달 열기
  const handleOpenDeleteConfirm = (postId) => {
    console.log('handleOpenDeleteConfirm called with postId:', postId)
    if (!user?.id) {
      console.log('User not logged in, showing login modal')
      setShowLoginModal(true)
      return
    }
    console.log('Setting postToDelete and showing delete confirm modal')
    console.log('Current showDeleteConfirmModal state:', showDeleteConfirmModal)
    setPostToDelete(postId)
    setShowDeleteConfirmModal(true)
    // 상태 업데이트 확인을 위한 추가 로그
    setTimeout(() => {
      console.log('After setState - showDeleteConfirmModal should be true')
    }, 0)
  }

  // 삭제 확인 모달 닫기
  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirmModal(false)
    setPostToDelete(null)
  }

  // 포스팅 삭제 함수
  const handleDeletePost = async (postId) => {
    if (!user?.id) {
      return
    }

    try {
      await db.deletePost(postId, user.id)
      
      // 로컬 state에서 포스트 제거
      setVibePosts(prev => prev.filter(p => p.id !== postId))
      
      // 좋아요 정보에서도 제거
      setPostLikes(prev => {
        const newLikes = { ...prev }
        delete newLikes[postId]
        return newLikes
      })
      
      // 삭제 확인 모달 닫기
      handleCloseDeleteConfirm()
      
      // 상세 화면 닫고 Feed로 이동
      handleClosePostDetail()
      
      // 성공 메시지
      setToastMessage('Post deleted successfully! 🗑️')
      setShowToast(true)
      setTimeout(() => {
        setShowToast(false)
        setToastMessage('')
      }, 3000)
    } catch (error) {
      console.error('Error deleting post:', error)
      handleCloseDeleteConfirm()
      alert(error.message || 'Failed to delete post. Please try again.')
    }
  }

  const handleClearFilter = () => {
    setSpotFilter(null)
  }

  // 필터링된 포스트 가져오기
  const getFilteredPosts = () => {
    if (!spotFilter) return vibePosts
    return vibePosts.filter((post) => post.placeId === spotFilter)
  }

  const handleOpenModal = () => {
    // 로그인 체크
    if (!user) {
      setShowLoginModal(true)
      return
    }
    setIsModalOpen(true)
  }

  const handleGoogleLogin = async () => {
    const { error } = await auth.signInWithGoogle()
    if (error) {
      console.error('Login error:', error)
      alert('Failed to sign in. Please try again.')
    }
    // 로그인 성공 시 onAuthStateChange에서 자동으로 처리됨
  }

  const handleLogout = async () => {
    const { error } = await auth.signOut()
    if (error) {
      console.error('Logout error:', error)
    } else {
      setUser(null)
      setShowLoginModal(false)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setPostPlace('')
    setPostCategory('')
    setPostCustomPlace('')
    setPostVibe('')
    setPostDescription('')
    setPostMainImage(null)
    setPostAdditionalImages([])
    setPostMetadata(null)
  }

  // 실제 EXIF 메타데이터 검증 (exifr 사용)
  const validateImageMetadata = async (file) => {
    console.log('Starting EXIF metadata validation (exifr) for file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified),
    })

    try {
      // exifr로 전체 EXIF 데이터 파싱 (GPS 포함)
      // 옵션 1: GPS 데이터만 파싱
      const gpsResult = await exifr.gps(file)
      console.log('exifr.gps() result:', gpsResult)
      
      // 옵션 2: 전체 EXIF 데이터 파싱 (디버깅용)
      const fullResult = await exifr.parse(file)
      console.log('exifr.parse() full result:', fullResult)
      console.log('Full result keys:', Object.keys(fullResult || {}))
      
      // GPS 정보 추출 (여러 방법 시도)
      let latitude = null
      let longitude = null
      
      // 방법 1: gps() 결과에서
      if (gpsResult && gpsResult.latitude != null && gpsResult.longitude != null) {
        latitude = gpsResult.latitude
        longitude = gpsResult.longitude
        console.log('GPS found via exifr.gps():', { latitude, longitude })
      }
      // 방법 2: parse() 결과에서
      else if (fullResult) {
        if (fullResult.latitude != null && fullResult.longitude != null) {
          latitude = fullResult.latitude
          longitude = fullResult.longitude
          console.log('GPS found via exifr.parse() - direct:', { latitude, longitude })
        }
        // 방법 3: GPS 객체에서
        else if (fullResult.GPSLatitude != null && fullResult.GPSLongitude != null) {
          // DMS 형식일 수 있음
          const latDMS = fullResult.GPSLatitude
          const latRef = fullResult.GPSLatitudeRef
          const lngDMS = fullResult.GPSLongitude
          const lngRef = fullResult.GPSLongitudeRef
          
          console.log('GPS found in GPS object (DMS format):', {
            GPSLatitude: latDMS,
            GPSLatitudeRef: latRef,
            GPSLongitude: lngDMS,
            GPSLongitudeRef: lngRef
          })
          
          // DMS를 십진수로 변환
          const convertDMSToDD = (dms, ref) => {
            if (!dms || !Array.isArray(dms) || dms.length < 3) return null
            let dd = dms[0] + dms[1] / 60 + dms[2] / (60 * 60)
            if (ref === 'S' || ref === 'W') dd = dd * -1
            return dd
          }
          
          latitude = convertDMSToDD(latDMS, latRef)
          longitude = convertDMSToDD(lngDMS, lngRef)
          
          if (latitude != null && longitude != null) {
            console.log('GPS converted from DMS:', { latitude, longitude })
          }
        }
      }

      // GPS 정보가 없으면 실패
      if (latitude == null || longitude == null) {
        console.warn('GPS information not found in any format')
        console.log('Available data:', {
          gpsResult,
          fullResultKeys: Object.keys(fullResult || {}),
          hasGPSLatitude: fullResult?.GPSLatitude != null,
          hasGPSLongitude: fullResult?.GPSLongitude != null,
          hasLatitude: fullResult?.latitude != null,
          hasLongitude: fullResult?.longitude != null,
        })
        alert(
          'Photo does not contain location information. Please check your GPS settings and upload a photo taken with GPS enabled.'
        )
        return null
      }

      // 촬영 시간
      let capturedAt = null
      if (fullResult?.DateTimeOriginal) {
        capturedAt = new Date(fullResult.DateTimeOriginal)
        console.log('Using DateTimeOriginal from exifr:', fullResult.DateTimeOriginal, '->', capturedAt)
      } else if (fullResult?.DateTime) {
        capturedAt = new Date(fullResult.DateTime)
        console.log('Using DateTime from exifr:', fullResult.DateTime, '->', capturedAt)
      } else {
        capturedAt = new Date(file.lastModified)
        console.log('Using file.lastModified as capturedAt:', capturedAt)
      }

      if (isNaN(capturedAt.getTime())) {
        capturedAt = new Date(file.lastModified)
      }

      const locationName = `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`

      const metadata = {
        lat: latitude,
        lng: longitude,
        capturedAt,
        locationName,
      }

      console.log('Metadata successfully extracted (exifr):', metadata)
      return metadata
    } catch (error) {
      console.error('Error reading EXIF data with exifr:', error)
      console.error('Error stack:', error.stack)
      alert(
        'Failed to read photo metadata. The photo may not be a valid image file or may not contain GPS information.'
      )
      return null
    }
  }

  const handleMainImageSelect = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const metadata = await validateImageMetadata(file)
      if (metadata) {
        setPostMainImage(file)
        setPostMetadata(metadata)
      } else {
        // 검증 실패 시 input 초기화
        e.target.value = ''
      }
    }
  }

  const handleAdditionalImagesSelect = (e) => {
    const files = Array.from(e.target.files)
    const remainingSlots = 4 - postAdditionalImages.length
    const filesToAdd = files.slice(0, remainingSlots)
    
    if (filesToAdd.length > 0) {
      setPostAdditionalImages([...postAdditionalImages, ...filesToAdd])
    }
    
    // input 초기화
    e.target.value = ''
  }

  const handleRemoveAdditionalImage = (index) => {
    setPostAdditionalImages(postAdditionalImages.filter((_, i) => i !== index))
  }

  // 이미지 압축 함수
  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.5, // 최대 파일 크기 500KB
      maxWidthOrHeight: 1200, // 최대 너비/높이 1200px
      useWebWorker: true, // 웹 워커 사용 (성능 향상)
      fileType: 'image/jpeg', // JPEG 형식으로 변환
      initialQuality: 0.85, // 초기 품질 85%
    }

    try {
      const compressedFile = await imageCompression(file, options)
      console.log('Image compressed:', {
        original: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        compressed: (compressedFile.size / 1024 / 1024).toFixed(2) + ' MB',
        reduction: ((1 - compressedFile.size / file.size) * 100).toFixed(1) + '%'
      })
      return compressedFile
    } catch (error) {
      console.error('Error compressing image:', error)
      // 압축 실패 시 원본 파일 반환
      return file
    }
  }

  const handlePostVibe = async () => {
    if (!postVibe) {
      alert('Please select a vibe status')
      return
    }
    
    // 카테고리 선택 확인
    if (!postCategory) {
      alert('Please select a category')
      return
    }
    
    // 장소 선택 확인
    if (postCategory === 'other') {
      if (!postCustomPlace || !postCustomPlace.trim()) {
        alert('Please enter a place name')
        return
      }
    } else {
      if (!postPlace) {
        alert('Please select a place')
        return
      }
    }

    if (!postMainImage || !postMetadata) {
      alert('Main photo with GPS metadata is required. Please upload a GPS-enabled photo.')
      return
    }

    setIsPosting(true)

    try {
      // 1. 이미지 압축 및 업로드
      const timestamp = Date.now()
      const userId = user?.id || 'anonymous'
      
      // 메인 이미지 압축
      const compressedMainImage = await compressImage(postMainImage)
      const mainImagePath = `${userId}/${timestamp}_main_${compressedMainImage.name.replace(/\.[^/.]+$/, '.jpg')}`
      const { data: mainImageData, error: mainImageError } = await db.uploadImage(compressedMainImage, mainImagePath)
      
      if (mainImageError) {
        throw new Error('Failed to upload main image')
      }

      // 추가 이미지 압축 및 업로드
      const additionalImageUrls = []
      const additionalMetadata = []
      
      for (let i = 0; i < postAdditionalImages.length; i++) {
        const img = postAdditionalImages[i]
        // 추가 이미지 압축
        const compressedImg = await compressImage(img)
        const imgPath = `${userId}/${timestamp}_additional_${i}_${compressedImg.name.replace(/\.[^/.]+$/, '.jpg')}`
        const { data: imgData, error: imgError } = await db.uploadImage(compressedImg, imgPath)
        
        if (imgError) {
          console.error('Failed to upload additional image:', imgError)
          continue // 개별 이미지 실패는 건너뛰고 계속 진행
        }
        
        additionalImageUrls.push(imgData.publicUrl)
        additionalMetadata.push({
          capturedAt: new Date(postMetadata.capturedAt.getTime() + (i + 1) * 60000), // 1분씩 차이
        })
      }

      // 2. 장소 ID 찾기 (hotSpots에서 찾거나 null)
      const selectedPlace = postCategory !== 'other' ? hotSpots.find((p) => p.name === postPlace) : null
      const placeId = selectedPlace?.id || null
      
      // 장소명 결정 (카테고리별)
      const finalPlaceName = postCategory === 'other' ? postCustomPlace.trim() : postPlace

      // 3. Supabase에 포스트 저장
      
      const postData = {
        placeId: placeId,
        placeName: finalPlaceName,
        vibe: postVibe,
        description: postDescription.trim() || null,
        mainImageUrl: mainImageData.publicUrl,
        additionalImageUrls: additionalImageUrls,
        metadata: {
          lat: postMetadata.lat,
          lng: postMetadata.lng,
          capturedAt: postMetadata.capturedAt,
          locationName: postMetadata.locationName,
          vibeStatus: postVibe,
          additionalMetadata: additionalMetadata,
        },
        userId: user?.id || null,
        categoryType: postCategory || 'other',
      }

      const savedPost = await db.createPost(postData)

      // 4. "기타" 카테고리 선택 시 custom_place_names 테이블에 저장/업데이트
      if (postCategory === 'other' && postCustomPlace && postCustomPlace.trim()) {
        try {
          const placeName = postCustomPlace.trim()
          
          // 기존 레코드 확인
          const { data: existing } = await supabase
            .from('custom_place_names')
            .select('*')
            .eq('place_name', placeName)
            .eq('category_type', 'other')
            .single()
          
          if (existing) {
            // 이미 존재하면 usage_count 증가 및 last_used_at 업데이트
            await supabase
              .from('custom_place_names')
              .update({
                usage_count: existing.usage_count + 1,
                last_used_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
          } else {
            // 없으면 새로 insert
            await supabase
              .from('custom_place_names')
              .insert({
                place_name: placeName,
                category_type: 'other',
                usage_count: 1,
                first_used_at: new Date().toISOString(),
                last_used_at: new Date().toISOString(),
              })
          }
        } catch (error) {
          // custom_place_names 저장 실패는 로그만 남기고 포스팅은 계속 진행
          console.error('Error saving custom place name:', error)
        }
      }

      // 5. 로컬 state 업데이트 (새로 저장된 포스트 추가)
      const newPost = {
        id: savedPost.id,
        placeId: savedPost.place_id,
        placeName: savedPost.place_name,
        vibe: savedPost.vibe,
        description: savedPost.description || null,
        image: mainImageData.publicUrl,
        images: [mainImageData.publicUrl, ...additionalImageUrls],
        timestamp: new Date(savedPost.created_at),
        user: user?.id || user?.email || 'anonymous',
        userId: user?.id || null,
        category_type: savedPost.category_type ?? postCategory ?? 'other',
        metadata: {
          lat: postMetadata.lat,
          lng: postMetadata.lng,
          capturedAt: postMetadata.capturedAt,
          locationName: postMetadata.locationName,
          vibeStatus: postVibe,
          additionalMetadata: additionalMetadata,
        },
      }

      setVibePosts([newPost, ...vibePosts])
      handleCloseModal()
      setToastMessage('Vibe Posted Successfully! 🎉')
      setShowToast(true)
      setTimeout(() => {
        setShowToast(false)
        setToastMessage('')
      }, 3000)
    } catch (error) {
      console.error('Error posting vibe:', error)
      alert(`Failed to post vibe: ${error.message || 'Unknown error'}`)
    } finally {
      setIsPosting(false)
    }
  }

  const formatCapturedTime = (date) => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${ampm}`
  }

  const formatDate = (date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getTimeAgo = (date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  // 촬영 시간을 최신성에 따라 포맷팅 (라벨 없이 시간 정보만)
  const formatCapturedTimeWithRecency = (date) => {
    if (!date) return ''
    
    const capturedDate = new Date(date)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - capturedDate.getTime()) / 60000)
    
    // 1시간 이내: 상대 시간 표시
    if (diffMinutes < 60) {
      return getTimeAgo(capturedDate)
    }
    
    // 오늘: "Today {time}"
    const today = new Date()
    if (capturedDate.toDateString() === today.toDateString()) {
      return `Today ${formatCapturedTime(capturedDate)}`
    }
    
    // 어제: "Yesterday {time}"
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (capturedDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${formatCapturedTime(capturedDate)}`
    }
    
    // 그 이전: "{date} {time}"
    return `${formatDate(capturedDate)} ${formatCapturedTime(capturedDate)}`
  }

  const getVibeInfo = (vibeId) => {
    return vibeOptions.find((v) => v.id === vibeId) || vibeOptions[0]
  }

  // 노출 기간: 날짜-only(시작 00:00, 종료 23:59)면 시간 숨기고, 그 외에는 일시(날짜+시간) 표시
  const formatDisplayPeriod = (startDate, endDate) => {
    if (!startDate && !endDate) return null

    // DB 값 기준으로 날짜-only 여부 판단
    const dateOnly = isDateOnlyPeriod(startDate, endDate)

    // 먼저 전체 포맷(날짜+시간) 생성
    const fullStart = startDate ? formatUtcAsKstDisplay(startDate) : null
    const fullEnd = endDate ? formatUtcAsKstDisplay(endDate) : null

    // 날짜-only 이거나, 포맷 결과가 00:00 / 23:59로 끝나는 경우에는 시간 숨김
    const shouldHideTime =
      dateOnly ||
      ((fullStart == null || fullStart.endsWith('00:00')) &&
        (fullEnd == null || fullEnd.endsWith('23:59')))

    const startStr = startDate
      ? shouldHideTime
        ? formatKstDisplayDateOnly(startDate)
        : fullStart
      : null
    const endStr = endDate
      ? shouldHideTime
        ? formatKstDisplayDateOnly(endDate)
        : fullEnd
      : null
    if (startStr && endStr) return `${startStr} ~ ${endStr}`
    if (startStr) return `${startStr} ~`
    if (endStr) return `~ ${endStr}`
    return null
  }

  // 복수 노출기간 시 현재/다음 구간 하나 반환, 없으면 단일 기간 폴백
  const getEffectiveDisplayPeriod = (spot) => {
    const ep = getCurrentOrNextPeriod(spot.display_periods || [])
    if (ep) return ep
    if (spot.display_start_date || spot.display_end_date) {
      return { start: spot.display_start_date, end: spot.display_end_date }
    }
    return null
  }

  const formatDisplayPeriodForSpot = (spot) => {
    const ep = getEffectiveDisplayPeriod(spot)
    return ep ? formatDisplayPeriod(ep.start, ep.end) : null
  }

  // Discover 목록용 짧은 노출 기간 표시: "26.02.23.~26.03.15." (연도 앞 두 자리만, 시간 없음)
  const formatDisplayPeriodShortForSpot = (spot) => {
    const ep = getEffectiveDisplayPeriod(spot)
    if (!ep || (!ep.start && !ep.end)) return null

    const fmt = (v) => {
      if (!v) return null
      const s = typeof v === 'string' ? v : String(v)
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (!m) return null
      const yy = m[1].slice(2)
      const mm = m[2]
      const dd = m[3]
      // 예: "26. 02. 23."
      return `${yy}. ${mm}. ${dd}.`
    }

    const startStr = fmt(ep.start)
    const endStr = fmt(ep.end)
    if (startStr && endStr) return `${startStr} ~ ${endStr}`
    if (startStr) return `${startStr} ~`
    if (endStr) return `~ ${endStr}`
    return null
  }

  // D-day 배지 라벨 (Discover·Feed 공통 — 복수 구간 시 현재/다음 구간 기준, 한국 시간 날짜)
  const getDDayBadgeLabel = (spot) => {
    const ep = getEffectiveDisplayPeriod(spot)
    if (!ep || (!ep.start && !ep.end)) return null
    const now = new Date()
    const todayKey = getTodayKSTDateKey()
    const startKey = getKstDateKeyFromString(ep.start)
    const endKey = getKstDateKeyFromString(ep.end)
    const startDiffDays = startKey != null ? getCalendarDaysBetweenKeys(todayKey, startKey) : null
    const endDiffDays = endKey != null ? getCalendarDaysBetweenKeys(todayKey, endKey) : null
    const start = ep.start ? new Date(ep.start) : null
    const end = ep.end ? new Date(ep.end) : null
    if (start && now < start) {
      if (startDiffDays !== null && startDiffDays > 0) return `D-${startDiffDays}`
      return 'D-0'
    }
    if (start && (!end || now <= end)) {
      if (endDiffDays === null) return 'On now'
      if (endDiffDays > 1) return `${endDiffDays} days left`
      if (endDiffDays === 1) return 'Ends tomorrow'
      if (endDiffDays === 0) return 'Ends today'
      return 'On now'
    }
    return null
  }

  // 혼잡도/Vibe 라벨 (Discover·Feed 공통 — 최신 포스트 30분 이내만 표시)
  const getFreshVibeLabelForSpot = (spot) => {
    const now = new Date()
    const postsForPlace = vibePosts.filter((p) => {
      const placeName = p.placeName || p.place_name
      return (p.placeId && p.placeId === spot.id) || (placeName && (placeName === spot.name || placeName === spot.name_en))
    })
    if (postsForPlace.length === 0) return null
    const latest = postsForPlace.reduce((acc, cur) => {
      const t = cur.metadata?.capturedAt ? new Date(cur.metadata.capturedAt).getTime() : (cur.timestamp ? new Date(cur.timestamp).getTime() : 0)
      const accT = acc.metadata?.capturedAt ? new Date(acc.metadata.capturedAt).getTime() : (acc.timestamp ? new Date(acc.timestamp).getTime() : 0)
      return t > accT ? cur : acc
    })
    const capturedAt = latest.metadata?.capturedAt ? new Date(latest.metadata.capturedAt) : (latest.timestamp ? new Date(latest.timestamp) : null)
    if (!capturedAt) return null
    const diffMinutes = (now.getTime() - capturedAt.getTime()) / (1000 * 60)
    if (diffMinutes > 30) return null
    const vibeInfo = getVibeInfo(latest.vibe)
    return { label: vibeInfo.label, isLive: diffMinutes <= 10 }
  }

  // Discover 정렬 상태 / 상세 선택
  const [discoverSort, setDiscoverSort] = useState('distance') // 'distance' | 'latest' | 'hot'
  const [selectedDiscoverSpot, setSelectedDiscoverSpot] = useState(null)
  const [discoverDetailFrom, setDiscoverDetailFrom] = useState(null) // 'discover' | 'home' | 'my' — 장소 상세 진입 경로
  const [viewBeforePostDetail, setViewBeforePostDetail] = useState(null) // 포스트 상세 진입 전 뷰 (뒤로가기용)
  const [mapFocusSpot, setMapFocusSpot] = useState(null) // 지도에서 특정 Discover 장소로 포커스 이동용
  const viewBeforePostDetailRef = useRef(null)

  const handleNavClick = (viewId) => {
    setCurrentView(viewId)
  }

  // Home View는 현재 사용하지 않음 (초기 진입 시 Discover로 바로 진입)

  // Discover View - 관리자 등록 팝업 전용
  if (currentView === 'discover') {
    // popup_store 타입만 대상
    const popupSpots = hotSpots
      .filter((spot) => spot.type === 'popup_store')
      .filter((spot) => (showRunningOnly ? spot.displayStatus === 'active' : true))

    // 장소별 통계 (Latest/Hot 정렬용) - placeId가 없을 수 있어 name 기준
    const statsByPlaceName = {}
    vibePosts.forEach((post) => {
      const placeName = post.placeName || post.place_name
      if (!placeName) return
      if (!statsByPlaceName[placeName]) {
        statsByPlaceName[placeName] = { count: 0, latestTimestamp: 0 }
      }
      statsByPlaceName[placeName].count += 1
      const ts = post.metadata?.capturedAt
        ? new Date(post.metadata.capturedAt).getTime()
        : (post.timestamp ? new Date(post.timestamp).getTime() : 0)
      if (ts > statsByPlaceName[placeName].latestTimestamp) {
        statsByPlaceName[placeName].latestTimestamp = ts
      }
    })

    // 정렬 적용
    const sortedSpots = [...popupSpots].sort((a, b) => {
      if (discoverSort === 'distance') {
        const da = a.distance ?? Number.MAX_VALUE
        const db = b.distance ?? Number.MAX_VALUE
        return da - db
      }

      if (discoverSort === 'latest') {
        const ta = a.created_at ? a.created_at.getTime() : 0
        const tb = b.created_at ? b.created_at.getTime() : 0
        return tb - ta // 관리자 등록일 기준 최신순
      }

      if (discoverSort === 'hot') {
        const ca = a.commentCount || 0
        const cb = b.commentCount || 0
        if (cb !== ca) return cb - ca // 댓글 많은 순
        const la = a.latestCommentAt ? a.latestCommentAt.getTime() : 0
        const lb = b.latestCommentAt ? b.latestCommentAt.getTime() : 0
        return lb - la // 댓글 수 같으면 최근 댓글이 있는 장소 우선
      }

      return 0
    })

    const getFreshVibeLabel = (spot) => {
      const now = new Date()
      const postsForPlace = vibePosts.filter(
        (p) => (p.placeId && p.placeId === spot.id) || (p.placeName && (p.placeName === spot.name || p.placeName === spot.name_en))
      )
      if (postsForPlace.length === 0) return null
      const latest = postsForPlace.reduce((acc, cur) => {
        const t = cur.metadata?.capturedAt
          ? new Date(cur.metadata.capturedAt).getTime()
          : (cur.timestamp ? new Date(cur.timestamp).getTime() : 0)
        const accT = acc.metadata?.capturedAt
          ? new Date(acc.metadata.capturedAt).getTime()
          : (acc.timestamp ? new Date(acc.timestamp).getTime() : 0)
        return t > accT ? cur : acc
      })
      const capturedAt = latest.metadata?.capturedAt
        ? new Date(latest.metadata.capturedAt)
        : (latest.timestamp ? new Date(latest.timestamp) : null)
      if (!capturedAt) return null
      const diffMinutes = (now.getTime() - capturedAt.getTime()) / (1000 * 60)
      if (diffMinutes > 30) return null // 30분 넘으면 혼잡도 숨김
      const vibeInfo = getVibeInfo(latest.vibe)
      return {
        label: vibeInfo.label,
        isLive: diffMinutes <= 10,
      }
    }

    return (
      <div className="min-h-screen bg-black text-white pb-24">
        {/* Header - 높이 지도 헤더와 동일 (96px) */}
        <div className="sticky top-0 min-h-[96px] flex flex-col justify-center bg-black/95 backdrop-blur-sm z-20 border-b border-gray-800">
          <div className="min-h-[96px] max-w-[430px] mx-auto px-4 py-3 w-full">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">
                {I18N.discoverTitle[lang]}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRunningOnly((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    showRunningOnly
                      ? 'bg-[#ADFF2F]/20 text-[#ADFF2F] border-[#ADFF2F]'
                      : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-[#ADFF2F]/60'
                  }`}
                >
                  {lang === 'ko' ? '진행중' : 'Running only'}
                </button>
                <button
                  type="button"
                  onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
                  className="px-2 py-1 rounded-full border border-gray-700 text-xs text-gray-300 hover:border-[#ADFF2F]/60 hover:text-[#ADFF2F] transition-colors"
                >
                  {lang === 'ko' ? 'EN' : 'KO'}
                </button>
              </div>
            </div>

            {/* Sort Tabs */}
            <div className="flex gap-2 mt-2">
              {['distance', 'latest', 'hot'].map((key) => {
                const label =
                  key === 'distance' ? I18N.discoverSortDistance[lang]
                  : key === 'latest' ? I18N.discoverSortLatest[lang]
                  : I18N.discoverSortHot[lang]
                const isActive = discoverSort === key
                return (
                  <button
                    key={key}
                    onClick={() => setDiscoverSort(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      isActive
                        ? 'bg-[#ADFF2F] text-black border-[#ADFF2F]'
                        : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Cards - 1열 리스트 */}
        <div className="max-w-[430px] mx-auto px-4 py-4 space-y-4">
          {sortedSpots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {I18N.discoverNoSpots[lang]}
            </p>
          ) : (
            sortedSpots.map((spot) => {
              const dday = getDDayBadgeLabel(spot)
              const vibeFresh = getFreshVibeLabel(spot)
              const isPicked = pickedPlaceIds.includes(spot.id)
              return (
                <div
                  key={spot.id}
                  onClick={() => {
                    setSelectedDiscoverSpot(spot)
                    setDiscoverDetailFrom('discover')
                    setCurrentView('discover-detail')
                  }}
                  className="cursor-pointer overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 hover:border-[#ADFF2F]/60 transition-all relative"
                >
                  {/* Pick 버튼: 카드 클릭과 분리 */}
                  <button
                    type="button"
                    onClick={(e) => handleTogglePlacePick(spot.id, e)}
                    className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                    aria-label={isPicked ? (lang === 'ko' ? '픽 해제' : 'Unpick') : (lang === 'ko' ? '픽하기' : 'Pick')}
                  >
                    {isPicked ? (
                      <svg className="w-5 h-5 text-[#ADFF2F]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                    )}
                  </button>
                  {/* 이미지 영역: 오버레이 없이 썸네일만 깔끔하게 표시 */}
                  <div className="w-full overflow-hidden bg-gray-800 flex items-center justify-center">
                    {spot.thumbnail_url ? (
                      <img
                        src={spot.thumbnail_url}
                        alt={spot.name}
                        className="w-full h-auto object-contain"
                      />
                    ) : (
                      <div className="w-full h-56 bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Info area under image: 장소명, D-day, 기간, 태그 */}
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="text-sm font-semibold">
                      {lang === 'en' && spot.name_en ? spot.name_en : spot.name}
                    </p>
                    {dday && (
                      <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/80 text-[#ADFF2F] border border-[#ADFF2F]/60">
                        {dday}
                      </span>
                    )}
                    {formatDisplayPeriodShortForSpot(spot) && (
                      <p className="text-xs text-gray-400">
                        {formatDisplayPeriodShortForSpot(spot)}
                      </p>
                    )}
                    {/* Hashtags: 활성 태그만 라벨로 표시, 숨김/삭제된 태그는 미표시 */}
                    {Array.isArray(spot.hashtags) && spot.hashtags.length > 0 && (() => {
                      const visibleTags = spot.hashtags.filter((codeValue) => placeTagLabelMap[codeValue]).slice(0, 4)
                      if (visibleTags.length === 0) return null
                      return (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {visibleTags.map((codeValue) => {
                            const labelObj = placeTagLabelMap[codeValue]
                            const tagLabel =
                              typeof labelObj === 'string'
                                ? labelObj
                                : (labelObj && (lang === 'en' ? (labelObj.en || labelObj.ko) : (labelObj.ko || labelObj.en)))
                            if (!tagLabel) return null
                            return (
                              <span
                                key={codeValue}
                                className="px-2 py-0.5 rounded-full bg-gray-800 text-[11px] text-gray-300"
                              >
                                #{tagLabel}
                              </span>
                            )
                          })}
                        </div>
                      )
                    })()}

                  </div>
                </div>
              )
            })
          )}
        </div>

          <BottomNav currentView={currentView} onNavClick={handleNavClick} lang={lang} />
      </div>
    )
  }

  // Discover Detail View - Hotspot 상세
  if (currentView === 'discover-detail') {
    if (!selectedDiscoverSpot) {
      setCurrentView(discoverDetailFrom === 'my' ? 'my' : 'discover')
      return null
    }

    // 마이페이지 "댓글 단 장소"에서 진입 시 hotSpots에서 동일 id로 다시 조회해 구조 일치·검은 화면 방지
    const resolvedSpot =
      discoverDetailFrom === 'my' && selectedDiscoverSpot?.id != null
        ? hotSpots.find((s) => s.id === selectedDiscoverSpot.id) || selectedDiscoverSpot
        : selectedDiscoverSpot
    const spot = resolvedSpot
      ? { ...resolvedSpot, name_en: resolvedSpot.name_en ?? resolvedSpot.nameEn }
      : selectedDiscoverSpot
    if (!spot?.id) {
      setCurrentView(discoverDetailFrom === 'my' ? 'my' : 'discover')
      setSelectedDiscoverSpot(null)
      return null
    }
    const dday = getDDayBadgeLabel(spot)
    const now = new Date()
    const vibeFresh = (() => {
      const postsForPlace = vibePosts.filter(
        (p) => (p.placeId && p.placeId === spot.id) || (p.placeName && (p.placeName === spot.name || p.placeName === spot.name_en))
      )
      if (postsForPlace.length === 0) return null
      const latest = postsForPlace.reduce((acc, cur) => {
        const t = cur.metadata?.capturedAt
          ? new Date(cur.metadata.capturedAt).getTime()
          : (cur.timestamp ? new Date(cur.timestamp).getTime() : 0)
        const accT = acc.metadata?.capturedAt
          ? new Date(acc.metadata.capturedAt).getTime()
          : (acc.timestamp ? new Date(acc.timestamp).getTime() : 0)
        return t > accT ? cur : acc
      })
      const capturedAt = latest.metadata?.capturedAt
        ? new Date(latest.metadata.capturedAt)
        : (latest.timestamp ? new Date(latest.timestamp) : null)
      if (!capturedAt) return null
      const diffMinutes = (now.getTime() - capturedAt.getTime()) / (1000 * 60)
      if (diffMinutes > 30) return null
      const vibeInfo = getVibeInfo(latest.vibe)
      return {
        label: vibeInfo.label,
        isLive: diffMinutes <= 10,
      }
    })()

    const handleBack = () => {
      setSelectedDiscoverSpot(null)
      const from = discoverDetailFrom
      setDiscoverDetailFrom(null)
      if (from === 'home') setCurrentView('map')
      else if (from === 'my') setCurrentView('my')
      else setCurrentView('discover')
    }

    const backLabel =
      discoverDetailFrom === 'home'
        ? (lang === 'ko' ? '지도로' : 'Back to Map')
        : discoverDetailFrom === 'my'
          ? (lang === 'ko' ? '마이로' : 'Back to My')
          : (lang === 'ko' ? '디스커버로' : 'Back to Discover')

    return (
      <div className="min-h-screen bg-black text-white pb-24">
        {/* Header - 모바일 430px·높이 통일 */}
        <div className="sticky top-0 min-h-[96px] flex flex-col justify-center bg-black/95 backdrop-blur-sm z-20 border-b border-gray-800">
          <div className="max-w-[430px] mx-auto px-4 py-3 w-full flex items-center justify-between">
            <button
              onClick={handleBack}
              className="text-sm text-gray-400 hover:text-[#ADFF2F] flex items-center gap-1"
            >
              <span>←</span>
              <span>{backLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTogglePlacePick(spot.id)}
              className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
              aria-label={pickedPlaceIds.includes(spot.id) ? (lang === 'ko' ? '픽 해제' : 'Unpick') : (lang === 'ko' ? '픽하기' : 'Pick')}
            >
              {pickedPlaceIds.includes(spot.id) ? (
                <svg className="w-5 h-5 text-[#ADFF2F]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ) : (
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
              )}
            </button>
          </div>
        </div>

          {/* Hero + Info */}
        <div className="max-w-[430px] mx-auto px-4 pt-4">
          <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
            {/* 순수 이미지 영역 */}
            <div className="w-full overflow-hidden bg-gray-800 flex items-center justify-center">
              {spot.thumbnail_url ? (
                <img
                  src={spot.thumbnail_url}
                  alt={spot.name}
                  className="w-full h-auto object-contain"
                />
              ) : (
                <div className="w-full h-64 bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
                  No image
                </div>
              )}
            </div>

            {/* Info block: D-day, Vibe, 제목, 거리, 기간, 설명, 해시태그, 링크/전화 */}
            <div className="px-4 py-4 space-y-3">
              {/* 상단 메타 정보: D-day, Vibe, 제목, 거리 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {dday && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/80 text-[#ADFF2F] border border-[#ADFF2F]/60">
                      {dday}
                    </span>
                  )}
                  {vibeFresh && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/80 text-[#ADFF2F] border border-[#ADFF2F]/50">
                      {vibeFresh.label}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-lg font-semibold">
                    {spot.name}
                  </p>
                  {spot.distance !== undefined && (
                    <p className="text-xs text-gray-300">
                      {formatDistance(spot.distance)} away
                    </p>
                  )}
                </div>
              </div>

              {/* 지도에서 보기 버튼 */}
              {spot.lat && spot.lng && (
                <div className="pt-1">
                  <button
                      type="button"
                      onClick={() => {
                        setMapFocusSpot(spot)
                        setSelectedDiscoverSpot(spot)
                        setDiscoverDetailFrom('home')
                        setCurrentView('map')
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/80 border border-[#ADFF2F]/60 text-xs text-[#ADFF2F] hover:bg-[#ADFF2F]/10 transition-colors"
                  >
                    <img
                        src="/image/common/ico_map.png"
                        alt="comment icon"
                        className="w-5 h-5 object-contain" // 원하는 크기로 조절
                    />
                    <span>Map</span>
                  </button>
                </div>
              )}

              {/* 노출 기간 */}
              {formatDisplayPeriodForSpot(spot) && (
                <p className="text-xs text-gray-400">
                  {formatDisplayPeriodForSpot(spot)}
                </p>
              )}

              {/* 설명 */}
              {spot.description && (
                <p className="text-sm text-gray-200 mt-1 whitespace-pre-line">
                  {spot.description}
                </p>
              )}

              {/* Hashtags: 활성 태그만 라벨로 표시, 숨김/삭제된 태그는 미표시 */}
              {Array.isArray(spot.hashtags) && spot.hashtags.length > 0 && (() => {
                const visibleTags = spot.hashtags.filter((codeValue) => placeTagLabelMap[codeValue]).slice(0, 6)
                if (visibleTags.length === 0) return null
                return (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {visibleTags.map((codeValue) => {
                      const labelObj = placeTagLabelMap[codeValue]
                      const tagLabel =
                        typeof labelObj === 'string'
                          ? labelObj
                          : (labelObj && (lang === 'en' ? (labelObj.en || labelObj.ko) : (labelObj.ko || labelObj.en)))
                      if (!tagLabel) return null
                      return (
                        <span
                          key={codeValue}
                          className="px-2 py-0.5 rounded-full bg-gray-800 text-[11px] text-gray-300"
                        >
                          #{tagLabel}
                        </span>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Info URL & phone */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {spot.info_url && (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(spot.info_url, '_blank', 'noopener,noreferrer')
                    }}
                    className="px-3 py-1.5 rounded-full border border-[#ADFF2F]/60 text-xs font-semibold text-[#ADFF2F] hover:bg-[#ADFF2F]/10 transition-colors"
                  >
                    Open info
                  </button>
                )}
                {spot.phone && (
                  <span className="text-xs text-gray-300">
                    📞 {spot.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 댓글 섹션 (댓글 목록 + 작성) */}
          <PlaceCommentsSection
            spot={spot}
            user={user}
            formatCapturedTimeWithRecency={formatCapturedTimeWithRecency}
            lang={lang}
          />
        </div>

          <BottomNav currentView={currentView} onNavClick={handleNavClick} lang={lang} />
      </div>
    )
  }

  if (currentView === 'feed') {
    const filteredPosts = getFilteredPosts()
    const filteredSpot = spotFilter ? hotSpots.find((s) => s.id === spotFilter) : null

    return (
      <div className="min-h-screen bg-black text-white pb-24">
        {/* Header - 모바일 430px 통일 */}
        <div className="sticky top-0 min-h-[96px] flex flex-col justify-center bg-black/95 backdrop-blur-sm z-20 border-b border-gray-800">
          <div className="max-w-[430px] mx-auto px-4 py-3 w-full">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">
                Live Vibe Stream
              </h1>
              {selectedRegion && (
                <button
                  onClick={() => {
                    setCurrentView('home')
                    setSelectedRegion(null)
                  }}
                  className="text-sm text-gray-400 hover:text-[#ADFF2F]"
                >
                  {selectedRegion.name} →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        {spotFilter && filteredSpot && (
          <div className="sticky top-[96px] bg-[#ADFF2F]/10 border-b border-[#ADFF2F]/30 z-[9]">
            <div className="max-w-[430px] mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#ADFF2F]">
                    Viewing {filteredSpot.name}'s Vibe ({filteredPosts.length})
                  </span>
                </div>
                <button
                  onClick={handleClearFilter}
                  className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:bg-gray-700 hover:border-[#ADFF2F]/50 transition-colors"
                >
                  ✕ Clear Filter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hot Spots Now Section - 탭 방식 */}
        <div className="max-w-[430px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-300">Hot Spots Now</h2>
          </div>

          {/* 카테고리 탭 */}
          {categories.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((category) => {
                const categorySpots = hotSpots.filter(spot => spot.type === category.code_value)
                const isSelected = selectedHotSpotCategory === category.code_value
                
                return (
                  <button
                    key={category.code_value}
                    onClick={() => setSelectedHotSpotCategory(category.code_value)}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                      isSelected
                        ? 'bg-[#ADFF2F] text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {getCategoryLabel(category, lang)}
                    {categorySpots.length > 0 && (
                      <span className={`ml-2 text-xs ${isSelected ? 'text-black/70' : 'text-gray-500'}`}>
                        ({categorySpots.length})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* 선택한 카테고리의 장소 표시 */}
          {isLoadingPlaces ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-shrink-0 bg-gray-900 border border-gray-800 rounded-xl p-4 min-w-[200px] animate-pulse">
                  <div className="h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded mb-2 w-2/3"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : placesError ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">{placesError}</p>
            </div>
          ) : (() => {
            const filteredSpots = hotSpots.filter(spot => spot.type === selectedHotSpotCategory)
            
            if (filteredSpots.length > 0) {
              return (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {filteredSpots.map((spot) => {
                    const ddayLabel = getDDayBadgeLabel(spot)
                    const vibeFresh = getFreshVibeLabelForSpot(spot)
                    return (
                    <div
                      key={spot.id}
                      onClick={() => handlePlaceClick(spot.id)}
                      className={`flex-shrink-0 bg-gray-900 border rounded-xl p-4 min-w-[200px] cursor-pointer transition-all ${
                        spotFilter === spot.id
                          ? 'border-[#ADFF2F] bg-[#ADFF2F]/10 ring-2 ring-[#ADFF2F]/50'
                          : 'border-gray-800 hover:border-[#ADFF2F]/50'
                      }`}
                    >
                      <h3 className="font-bold text-sm mb-1">
                        {lang === 'en' && spot.name_en ? spot.name_en : spot.name}
                      </h3>
                      {formatDisplayPeriodForSpot(spot) && (
                        <div className="text-xs text-gray-400 mb-2 space-y-0.5">
                          <p>{formatDisplayPeriodForSpot(spot)}</p>
                          {ddayLabel && (
                            <p className="text-[11px] text-[#ADFF2F]">
                              {ddayLabel}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {vibeFresh ? (
                          <span className="text-xs text-[#ADFF2F] flex items-center gap-1">
                            {vibeFresh.isLive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                            {vibeFresh.label}
                          </span>
                        ) : null}
                        {spot.distance !== undefined && (
                          <>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-500">{formatDistance(spot.distance)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              )
            } else {
              const selectedCategory = categories.find(cat => cat.code_value === selectedHotSpotCategory)
              return (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">
                    No {getCategoryLabel(selectedCategory, lang) || 'places'} available
                  </p>
                </div>
              )
            }
          })()}
        </div>


        {/* Live Vibe Stream Section - 2열 격자 (모바일 폭 기준) */}
        <div className="max-w-[430px] mx-auto px-4 py-4">
          <h2 className="text-lg font-bold mb-3 text-gray-300">Live Vibe Stream</h2>
          {isLoadingPosts ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden animate-pulse">
                  <div className="h-64 bg-gray-700"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : postsError ? (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm mb-2">{postsError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700"
              >
                Retry
              </button>
            </div>
          ) : filteredPosts.length > 0 ? (
            <Masonry
              breakpointCols={{
                default: 2,
                640: 2,
              }}
              className="flex -ml-3 w-auto"
              columnClassName="pl-3 bg-clip-padding"
            >
              {filteredPosts.map((post, index) => {
                const vibeInfo = getVibeInfo(post.vibe)
                
                // 핀터레스트 스타일: 카드 높이 변형
                const heightVariants = ['h-64', 'h-80', 'h-72', 'h-96', 'h-68', 'h-84']
                const cardHeight = heightVariants[index % heightVariants.length]
                
                // Get main photo (first image) and count additional photos
                const mainImage = post.images?.[0] || post.image
                const additionalCount = post.images?.length > 1 ? post.images.length - 1 : 0
                
                return (
                  <div
                    key={post.id}
                    onClick={() => handlePostClick(post)}
                    className={`bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-[#ADFF2F]/50 transition-all duration-300 cursor-pointer flex flex-col mb-3 ${
                      spotFilter === post.placeId ? 'ring-2 ring-[#ADFF2F]/50' : ''
                    }`}
                  >
                    {/* Image */}
                    <div className={`relative w-full overflow-hidden flex-shrink-0 bg-gray-900 max-h-[70vh]`}>
                      <img
                        src={mainImage}
                        alt={post.placeName}
                        className="w-full h-auto object-contain max-h-[70vh]"
                      />
                      {/* Overlay Gradient (정보 텍스트 가독성용, 클릭 방해 X) */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                      
                      {/* Vibe Badge on Image */}
                      <div className="absolute top-2 right-2">
                        <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded-full flex items-center gap-1">
                          <span className="text-sm">{vibeInfo.emoji}</span>
                          <span className="text-xs font-semibold text-[#ADFF2F]">{vibeInfo.label.split(' ')[1]}</span>
                        </div>
                      </div>
                      
                      {/* Additional Photos Badge */}
                      {additionalCount > 0 && (
                        <div className="absolute bottom-2 right-2">
                          <div className="px-2 py-1 bg-black/70 backdrop-blur-sm rounded-full">
                            <span className="text-xs font-semibold text-white">+{additionalCount}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info Section */}
                    <div className="p-3 space-y-2 flex-shrink-0">
                      {/* Place Name - 말줄임 처리로 모바일 이탈 방지 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePlaceClick(post.placeId)
                        }}
                        className={`inline-block max-w-full min-w-0 px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors truncate ${
                          spotFilter === post.placeId
                            ? 'bg-[#ADFF2F]/30 text-[#ADFF2F] border-[#ADFF2F]'
                            : 'bg-[#ADFF2F]/20 text-[#ADFF2F] border-[#ADFF2F]/50 hover:bg-[#ADFF2F]/30'
                        }`}
                        title={post.placeName}
                      >
                        <span className="truncate block">📍 {post.placeName}</span>
                      </button>

                      {/* Captured Time */}
                      {(post.metadata?.capturedAt || post.timestamp) && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="whitespace-nowrap">
                            {post.metadata?.capturedAt 
                              ? formatCapturedTimeWithRecency(post.metadata.capturedAt)
                              : (post.timestamp ? formatCapturedTimeWithRecency(post.timestamp) : '')
                            }
                          </span>
                        </div>
                      )}

                      {/* Like Button */}
                      <button
                        onClick={(e) => handleToggleLike(post.id, e)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                          postLikes[post.id]?.liked
                            ? 'bg-red-500/20 text-red-500 border border-red-500'
                            : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-red-500/50'
                        }`}
                      >
                        <svg 
                          className={`w-4 h-4 ${postLikes[post.id]?.liked ? 'fill-red-500' : 'fill-none'}`} 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-xs font-semibold">
                          {postLikes[post.id]?.count || 0}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </Masonry>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">No posts found</p>
            </div>
          )}
        </div>

        {/* Floating Action Button */}
        <button
          onClick={handleOpenModal}
          className="fixed bottom-24 right-4 md:right-8 w-14 h-14 bg-[#ADFF2F] rounded-full flex items-center justify-center shadow-lg hover:shadow-[0_0_20px_rgba(173,255,47,0.5)] transition-all duration-300 hover:scale-110 z-30"
        >
          <svg
            className="w-6 h-6 text-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>

        {/* Login Modal */}
        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onLogin={handleGoogleLogin}
          />
        )}

        {/* Delete Confirm Modal - 다른 뷰에서 사용 (post-detail이 아닐 때) */}
        {currentView !== 'post-detail' && showDeleteConfirmModal && postToDelete && (
          <DeleteConfirmModal
            onClose={handleCloseDeleteConfirm}
            onConfirm={() => handleDeletePost(postToDelete)}
          />
        )}

        {/* Post Vibe Modal */}
        {isModalOpen && (
          <PostVibeModal
            categories={categories}
            places={filteredPlaces}
            customPlaceNames={customPlaceNames}
            selectedCategory={postCategory}
            selectedPlace={postPlace}
            selectedCustomPlace={postCustomPlace}
            vibeOptions={vibeOptions}
            selectedVibe={postVibe}
            selectedDescription={postDescription}
            mainImage={postMainImage}
            additionalImages={postAdditionalImages}
            metadata={postMetadata}
            userLocation={userLocation}
            lang={lang}
            getCategoryLabel={getCategoryLabel}
            onCategoryChange={setPostCategory}
            onPlaceChange={setPostPlace}
            onCustomPlaceChange={setPostCustomPlace}
            onVibeChange={setPostVibe}
            onDescriptionChange={setPostDescription}
            onMainImageSelect={handleMainImageSelect}
            onAdditionalImagesSelect={handleAdditionalImagesSelect}
            onRemoveAdditionalImage={handleRemoveAdditionalImage}
            onPost={handlePostVibe}
            onClose={handleCloseModal}
            formatCapturedTime={formatCapturedTime}
            formatDate={formatDate}
            formatDistance={formatDistance}
            isPosting={isPosting}
          />
        )}

        {/* Toast Message */}
        {showToast && toastMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[#ADFF2F] text-black px-6 py-3 rounded-full font-semibold shadow-lg z-50 animate-fade-in">
            {toastMessage}
          </div>
        )}

        {/* Bottom Navigation */}
        <BottomNav currentView={currentView} onNavClick={handleNavClick} lang={lang} />
      </div>
    )
  }

  // 클러스터링 함수 (zoomLevel: 클릭 확대 1|2, leafletZoomLevel: 지도 실제 확대 수준)
  const clusterPosts = (posts, zoomLevel, leafletZoomLevel = 16) => {
    if (zoomLevel === 2 && selectedCluster) {
      // 확대된 상태: 선택된 클러스터는 개별 마커로 펼치고, 나머지 포스트는 기존처럼 클러스터/단일로 유지
      const selectedIds = new Set(selectedCluster.posts.map((p) => p.id))
      const restPosts = posts.filter((p) => !selectedIds.has(p.id))
      const expanded = selectedCluster.posts.map((post) => {
        const mainImage = post.images?.[0] || post.image
        return {
          ...post,
          image: mainImage,
          isCluster: false,
          clusterId: selectedCluster.id,
        }
      })
      const restItems = clusterPosts(restPosts, 1, leafletZoomLevel)
      return [...expanded, ...restItems]
    }

    const postsWithCoords = posts.filter((post) => post.metadata)
    const clusters = []
    const processed = new Set()

    // 지도 확대 수준에 따른 클러스터 반경: 확대 시 반경 축소(개별 펼침), 축소 시 반경 확대(더 큰 단위로 합쳐짐)
    const clusterRadius =
      leafletZoomLevel >= 19 ? 0.00001   // ~1m
      : leafletZoomLevel >= 18 ? 0.00003 // ~3m
      : leafletZoomLevel >= 17 ? 0.00015 // ~15m
      : leafletZoomLevel >= 16 ? 0.001   // ~100m
      : leafletZoomLevel >= 15 ? 0.0018  // ~180m
      : leafletZoomLevel >= 14 ? 0.0028  // ~280m
      : leafletZoomLevel >= 13 ? 0.0045  // ~450m
      : leafletZoomLevel >= 12 ? 0.007   // ~700m
      : 0.012                            // ~1.2km (많이 축소 시)

    postsWithCoords.forEach((post, index) => {
      if (processed.has(index)) return

      const cluster = {
        id: `cluster-${index}`,
        posts: [post],
        centerLat: post.metadata.lat,
        centerLng: post.metadata.lng,
      }

      // 근처 포스트 찾기 (거리 기반, 확대 수준에 따라 반경 적용)
      postsWithCoords.forEach((otherPost, otherIndex) => {
        if (otherIndex === index || processed.has(otherIndex)) return

        const distance = Math.sqrt(
          Math.pow(post.metadata.lat - otherPost.metadata.lat, 2) +
          Math.pow(post.metadata.lng - otherPost.metadata.lng, 2)
        )

        if (distance < clusterRadius) {
          cluster.posts.push(otherPost)
          processed.add(otherIndex)
          // 클러스터 중심 재계산
          cluster.centerLat = cluster.posts.reduce((sum, p) => sum + p.metadata.lat, 0) / cluster.posts.length
          cluster.centerLng = cluster.posts.reduce((sum, p) => sum + p.metadata.lng, 0) / cluster.posts.length
        }
      })

      processed.add(index)
      clusters.push(cluster)
    })

    return clusters.map((cluster) => {
      // 메인 이미지 추출 (첫 번째 포스트의 메인 이미지 사용)
      const firstPost = cluster.posts[0]
      const mainImage = firstPost.images?.[0] || firstPost.image
      
      // 개별 포스트일 때는 첫 번째 포스트의 모든 속성 포함
      if (cluster.posts.length === 1) {
        return {
          ...firstPost, // 원본 포스트의 모든 속성 포함 (id, metadata, vibe, placeName 등)
          image: mainImage,
          isCluster: false,
          count: 1,
          centerLat: cluster.centerLat,
          centerLng: cluster.centerLng,
        }
      }
      
      // 확대해도 흩어지지 않을 정도로 같은 위치면 캐러셀 팝업용 플래그 (약 1m 이내)
      const eps = 1e-5
      const sameLocationGroup = cluster.posts.every((p) => {
        const lat = p.metadata?.lat ?? p.lat
        const lng = p.metadata?.lng ?? p.lng
        return lat != null && lng != null && Math.abs(lat - cluster.centerLat) < eps && Math.abs(lng - cluster.centerLng) < eps
      })

      // 클러스터일 때는 첫 번째 포스트의 대표 정보 포함
      return {
        ...cluster,
        ...firstPost,
        image: mainImage,
        isCluster: true,
        count: cluster.posts.length,
        id: firstPost.id,
        sameLocationGroup: sameLocationGroup && cluster.posts.length > 1,
      }
    })
  }

  // (사용 안 함) MapFitToCluster는 클러스터 클릭 시 자동 이동이 과하게 반복되어 제거되었습니다.

  // 지도 팝업용 HTML 생성 (Naver InfoWindow용, 이스케이프 포함)
  const escapeHtml = (s) => {
    if (s == null || s === '') return ''
    const t = String(s)
    return t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  const getSpotPopupHtml = (spot) => {
    const name = escapeHtml(spot?.name || '')
    const img = spot?.thumbnail_url ? `<div style="margin-bottom:12px;text-align:center;background:#1f2937;border-radius:8px;overflow:hidden;max-height:160px;"><img src="${escapeHtml(spot.thumbnail_url)}" alt="${name}" style="width:100%;height:auto;max-height:160px;object-fit:contain;" /></div>` : ''
    const typeLabel = spot?.type === 'popup_store' ? 'Pop-up Store' : spot?.type === 'restaurant' ? 'Restaurant' : spot?.type === 'shop' ? 'Shop' : spot?.type ? escapeHtml(spot.type) : ''
    const period = formatDisplayPeriodForSpot(spot) ? `<div style="font-size:12px;color:#ADFF2F;margin-bottom:4px;">${escapeHtml(formatDisplayPeriodForSpot(spot))}</div>` : ''
    // 인라인 스타일로 줄바꿈·2줄 말줄임 보장 (동적 HTML은 Tailwind 클래스 미적용 가능)
    const desc = spot?.description ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:8px;word-break:break-word;overflow-wrap:break-word;white-space:pre-line;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%;">${escapeHtml(spot.description)}</div>` : ''
    return `<div style="color:white;font-size:14px;background:#111827;border:2px solid #ef4444;border-radius:8px;padding:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);min-width:200px;max-width:min(280px,calc(100vw - 32px));box-sizing:border-box;">${img}<div style="margin-top:8px;"><div style="font-weight:700;font-size:14px;margin-bottom:4px;">${name}</div>${typeLabel ? `<div style="font-size:12px;color:#9ca3af;margin-bottom:4px;">${typeLabel}</div>` : ''}${period}${desc}</div><button type="button" class="naver-popup-view-detail" style="width:100%;background:#ADFF2F;color:#000;font-weight:600;padding:8px 12px;border-radius:6px;font-size:12px;margin-top:12px;border:none;cursor:pointer;">View Detail →</button></div>`
  }
  const getPostPopupHtml = (item) => {
    const vibeInfo = getVibeInfo(item?.vibe)
    const vibeLabel = vibeInfo?.label ? escapeHtml(vibeInfo.label) : ''
    const placeName = escapeHtml(item?.placeName || '')
    const timeStr = (item?.metadata?.capturedAt || item?.timestamp) ? formatCapturedTimeWithRecency(item.metadata?.capturedAt || item.timestamp) : ''
    const imgUrl = item?.image || item?.images?.[0] || ''
    const img = imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${placeName}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;flex-shrink:0;" />` : ''
    return `<div style="color:white;font-size:14px;background:#111827;border:2px solid #ADFF2F;border-radius:8px;padding:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);min-width:200px;max-width:min(280px,calc(100vw - 32px));box-sizing:border-box;"><div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">${img}<div style="flex:1;min-width:0;"><h3 style="font-weight:700;font-size:14px;margin-bottom:4px;word-break:break-word;">${placeName}</h3><div style="margin-bottom:8px;"><span style="font-size:12px;color:#ADFF2F;">${vibeLabel}</span></div>${timeStr ? `<div style="font-size:12px;color:#9ca3af;">${escapeHtml(timeStr)}</div>` : ''}</div></div><button type="button" class="naver-popup-view-detail" style="width:100%;background:#ADFF2F;color:#000;font-weight:600;padding:8px 12px;border-radius:6px;font-size:12px;border:none;cursor:pointer;">View Detail →</button></div>`
  }

  // Map View
  if (currentView === 'map') {
    // 지도에는 기본적으로 진행 중인 팝업만 노출, 옵션 해제 시에는 예정/무제한도 함께 노출
    let activeHotSpotsForMap = hotSpots.filter((spot) => {
      if (showRunningOnly) {
        return spot.displayStatus === 'active'
      }
      return (
        spot.displayStatus === 'active' ||
        spot.displayStatus === 'scheduled' ||
        spot.displayStatus === 'unlimited'
      )
    })

    // 픽한 장소만 보기 필터: 로그인 사용자가 켜면 픽한 장소만 노출
    if (showPickedOnlyOnMap && user?.id && pickedPlaceIds.length > 0) {
      activeHotSpotsForMap = activeHotSpotsForMap.filter((spot) =>
        pickedPlaceIds.includes(spot.id)
      )
    }

    // 관리자 장소를 항상 피드와 동일한 클러스터/커스텀 이미지 마커(빨간 테두리)로 표시하기 위한 fake post 목록
    const placeFakePosts = activeHotSpotsForMap
      .filter((spot) => spot.lat && spot.lng)
      .filter((spot) => (selectedHotSpotCategory ? spot.type === selectedHotSpotCategory : true))
      .map((spot) => ({
        id: `place-${spot.id}`,
        metadata: { lat: spot.lat, lng: spot.lng },
        image: spot.thumbnail_url,
        images: spot.thumbnail_url ? [spot.thumbnail_url] : [],
        source: 'place',
        spotData: spot,
      }))

    const mapItems = clusterPosts(placeFakePosts, mapZoom, leafletZoom)
    // 선택한 지역이 있으면 해당 지역 중심, 없으면 성수동 기본값
    const mapCenter = selectedRegion 
      ? (selectedRegion.id === 'Seongsu' ? [37.5446, 127.0559] : [37.5446, 127.0559]) // 다른 지역 좌표는 나중에 추가
      : [37.5446, 127.0559] // 기본값: 성수동

    return (
      <div
        className="fixed inset-0 w-full bg-black text-white overflow-hidden flex flex-col"
        style={{ paddingBottom: `calc(${BOTTOM_NAV_CONTENT_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}
      >
        {/* Header - 고정 */}
        <div className="flex-shrink-0 min-h-[96px] flex flex-col justify-center bg-black/80 backdrop-blur-sm z-[1000] border-b border-[#ADFF2F]/30">
          <div className="max-w-[430px] mx-auto px-4 py-3 w-full">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">
                {I18N.mapTitle[lang]}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRunningOnly((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    showRunningOnly
                      ? 'bg-[#ADFF2F]/20 text-[#ADFF2F] border-[#ADFF2F]'
                      : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-[#ADFF2F]/60'
                  }`}
                >
                  {lang === 'ko' ? '진행중' : 'Running only'}
                </button>
                <button
                  type="button"
                  onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
                  className="px-2 py-1 rounded-full border border-gray-700 text-xs text-gray-300 hover:border-[#ADFF2F]/60 hover:text-[#ADFF2F] transition-colors"
                >
                  {lang === 'ko' ? 'EN' : 'KO'}
                </button>
              </div>
            </div>
            {/* 카테고리 필터 - 디스커버 정렬 탭과 동일한 버튼 스타일 (rounded-full, border) */}
            {categories.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((category) => {
                  const isSelected = selectedHotSpotCategory === category.code_value
                  return (
                    <button
                      key={category.code_value}
                      onClick={() => {
                        setSelectedHotSpotCategory(category.code_value)
                        setMapZoom(1)
                        setSelectedCluster(null)
                        setSelectedPin(null)
                      }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-[#ADFF2F] text-black border-[#ADFF2F]'
                          : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {getCategoryLabel(category, lang)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Naver Map - 하단 패딩으로 네이버 로고·축척이 메뉴와 붙지 않고 그 위에 노출 */}
        <div className="flex-1 min-h-0 relative overflow-hidden pb-4">
          <LiveRadarNaverMap
            center={mapCenter}
            mapItems={mapItems}
            sdkReady={isNaverMapSdkReady}
            mapFocusSpot={mapFocusSpot}
            onFocusDone={() => setMapFocusSpot(null)}
            userLocation={userLocation}
            onMapReady={(map) => { naverMapInstanceRef.current = map }}
            onZoomChange={(z) => {
              setLeafletZoom(z)
              if (z < 17) {
                setMapZoom(1)
                setSelectedCluster(null)
                setSelectedPin(null)
              }
            }}
            onMapClick={() => {
              setMapZoom(1)
              setSelectedCluster(null)
              setSelectedPin(null)
            }}
            onClusterClick={(item) => {
              setSelectedCluster(item)
              setMapZoom(2)
            }}
            onSpotClick={(spot) => {
              setSelectedDiscoverSpot(spot)
              setDiscoverDetailFrom('home')
              setCurrentView('discover-detail')
            }}
            onPostClick={(item) => {
              const originalPost = vibePosts.find((p) => p.id === item.id)
              if (originalPost) handlePostClick(originalPost)
              else handlePostClick(item)
              setSelectedPin(null)
            }}
            getSpotPopupHtml={getSpotPopupHtml}
            getPostPopupHtml={getPostPopupHtml}
          />
          <MapControls
            naverMapRef={naverMapInstanceRef}
            userLocation={userLocation}
            showPickedOnlyOnMap={showPickedOnlyOnMap}
            onTogglePickedOnly={() => setShowPickedOnlyOnMap((prev) => !prev)}
            pickedPlaceIds={pickedPlaceIds}
            lang={lang}
          />
          {!isLoadingPlaces && isNaverMapSdkReady && mapItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10 pointer-events-none">
              <p>{I18N.mapNoLocation[lang]}</p>
            </div>
          )}
        </div>

        {/* Bottom Navigation - 고정 */}
        <BottomNav currentView={currentView} onNavClick={handleNavClick} lang={lang} />
      </div>
    )
  }

  // Post Detail View
  if (currentView === 'post-detail') {
    if (!selectedPost) {
      // selectedPost가 없으면 Feed로 리다이렉트
      console.warn('No post selected, redirecting to feed')
      // 조건부 return 안에서 Hook 호출 불가 - 대신 즉시 렌더링하고 useEffect에서 처리
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400">Redirecting...</p>
          </div>
        </div>
      )
    }

  return (
    <>
        <PostDetailView
          post={selectedPost}
          onClose={handleClosePostDetail}
          formatCapturedTime={formatCapturedTime}
          formatDate={formatDate}
          getVibeInfo={getVibeInfo}
          postLikes={postLikes}
          onToggleLike={handleToggleLike}
          user={user}
          onDeletePost={handleOpenDeleteConfirm}
        />
        {/* Delete Confirm Modal - PostDetailView와 함께 렌더링 */}
        {showDeleteConfirmModal && postToDelete && (
          <DeleteConfirmModal
            onClose={handleCloseDeleteConfirm}
            onConfirm={() => handleDeletePost(postToDelete)}
          />
        )}
      </>
    )
  }

  // Quest View - 모바일 430px 통일
  if (currentView === 'quest') {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 min-h-[96px] flex flex-col justify-center bg-black/95 backdrop-blur-sm z-20 border-b border-gray-800">
          <div className="max-w-[430px] mx-auto px-4 py-3 w-full">
            <h1 className="text-2xl font-bold">
              Quest
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Complete challenges and earn rewards
            </p>
          </div>
        </div>

        <div className="max-w-[430px] mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <p className="text-gray-400">Coming Soon</p>
          </div>
        </div>

        <BottomNav currentView={currentView} onNavClick={handleNavClick} lang={lang} />
      </div>
    )
  }

  // My View - 모바일 430px 통일
  if (currentView === 'my') {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 min-h-[96px] flex flex-col justify-center bg-black/95 backdrop-blur-sm z-20 border-b border-gray-800">
          <div className="max-w-[430px] mx-auto px-4 py-3 w-full">
            <h1 className="text-2xl font-bold">
              My Profile
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Your activity and settings
            </p>
          </div>
        </div>

        <div className="max-w-[430px] mx-auto px-4 py-6">
          {user ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-16 h-16 rounded-full border-2 border-[#ADFF2F]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#ADFF2F]/20 border-2 border-[#ADFF2F] flex items-center justify-center text-2xl">
                      {user.name?.charAt(0).toUpperCase() || '👤'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{user.name}</h2>
                    <p className="text-sm text-gray-400">{user.email}</p>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg border border-gray-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>

              {/* 픽한 장소 모아보기 */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">
                  {lang === 'ko' ? '픽한 장소' : 'Picked Places'}
                </h3>
                {pickedPlaceIds.length > 0 ? (
                  <div className="space-y-3">
                    {hotSpots
                      .filter((s) => pickedPlaceIds.includes(s.id))
                      .map((spot) => (
                        <div
                          key={spot.id}
                          onClick={() => {
                            setSelectedDiscoverSpot({ ...spot, name_en: spot.nameEn })
                            setDiscoverDetailFrom('my')
                            setCurrentView('discover-detail')
                          }}
                          className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-[#ADFF2F]/50 transition-colors"
                        >
                          {spot.thumbnail_url ? (
                            <img
                              src={spot.thumbnail_url}
                              alt={spot.name}
                              className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center text-gray-500 text-xs flex-shrink-0">
                              No image
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {lang === 'en' && spot.nameEn ? spot.nameEn : spot.name}
                            </p>
                          </div>
                          <span className="text-[#ADFF2F]">★</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4 text-sm">
                    {lang === 'ko' ? '디스커버에서 장소를 픽해 보세요.' : 'Pick places from Discover.'}
                  </p>
                )}
              </div>

              {/* 댓글 단 장소 모아보기 */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">
                  {lang === 'ko' ? '댓글 단 장소' : 'Places I Commented'}
                </h3>
                {placeIdsCommentedByUser.length > 0 ? (
                  <div className="space-y-3">
                    {hotSpots
                      .filter((s) => placeIdsCommentedByUser.includes(s.id))
                      .map((spot) => (
                        <div
                          key={spot.id}
                          onClick={() => {
                            setSelectedDiscoverSpot({ ...spot, name_en: spot.nameEn })
                            setDiscoverDetailFrom('my')
                            setCurrentView('discover-detail')
                          }}
                          className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-[#ADFF2F]/50 transition-colors"
                        >
                          {spot.thumbnail_url ? (
                            <img
                              src={spot.thumbnail_url}
                              alt={spot.name}
                              className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center text-gray-500 text-xs flex-shrink-0">
                              No image
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {lang === 'en' && spot.nameEn ? spot.nameEn : spot.name}
                            </p>
                          </div>
                          <img
                              src="/image/common/ico_comment.png"
                              alt="comment icon"
                              className="w-3.5 h-3.5 object-contain"
                          />
                        </div>
                      ))}
                  </div>
                ) : (
                    <p className="text-gray-400 text-center py-4 text-sm">
                    {lang === 'ko' ? '장소 상세에서 댓글을 남긴 곳이 여기 모입니다.' : 'Places you commented on will appear here.'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👤</div>
              <p className="text-gray-400 mb-6">Please sign in to view your profile</p>
              <button
                onClick={handleGoogleLogin}
                className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2 mx-auto"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          )}
        </div>

        <BottomNav currentView={currentView} onNavClick={handleNavClick} lang={lang} />
      </div>
    )
  }

  // Default fallback - should not reach here, but just in case
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Loading...</p>
        <button
          onClick={() => setCurrentView('discover')}
          className="px-4 py-2 bg-[#ADFF2F] text-black font-semibold rounded-lg hover:bg-[#ADFF2F]/90"
        >
          Go to Discover
        </button>
      </div>
    </div>
  )
}

// Post Detail View Component (전체 화면)
function PostDetailView({ post, onClose, formatCapturedTime, formatDate, getVibeInfo, postLikes, onToggleLike, user, onDeletePost }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(null)
  const [touchStartY, setTouchStartY] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [isSwiping, setIsSwiping] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  
  // 모든 Hook을 먼저 호출 (Hook 규칙 준수)
  // 페이지 로드 시 스크롤을 최상단으로 강제 이동
  // useLayoutEffect 사용: DOM 업데이트 직후, 화면 페인트 전에 실행
  useLayoutEffect(() => {
    // 강제 스크롤 함수 - 모든 방법을 시도
    const forceScrollToTop = () => {
      // 방법 1: window.scrollTo
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      
      // 방법 2: documentElement와 body 직접 설정
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
        document.documentElement.scrollIntoView({ behavior: 'instant', block: 'start' })
      }
      if (document.body) {
        document.body.scrollTop = 0
      }
      
      // 방법 3: 모든 스크롤 가능한 요소 초기화
      const scrollableElements = document.querySelectorAll('[style*="overflow"], [class*="overflow"]')
      scrollableElements.forEach(el => {
        if (el.scrollTop > 0) {
          el.scrollTop = 0
        }
      })
      
      // 방법 4: 헤더 요소로 스크롤
      const headerElement = document.getElementById('post-detail-header')
      if (headerElement) {
        headerElement.scrollIntoView({ behavior: 'instant', block: 'start' })
      }
      
      // 방법 5: 최상위 요소로 스크롤
      const viewElement = document.getElementById('post-detail-view')
      if (viewElement) {
        viewElement.scrollIntoView({ behavior: 'instant', block: 'start' })
      }
    }
    
    // 즉시 실행 (여러 번)
    forceScrollToTop()
    forceScrollToTop()
    forceScrollToTop()
    
    // DOM이 완전히 렌더링된 후 스크롤 이동
    requestAnimationFrame(() => {
      forceScrollToTop()
      requestAnimationFrame(() => {
        forceScrollToTop()
        // 추가 보장을 위해 여러 번 실행
        setTimeout(() => {
          forceScrollToTop()
          setTimeout(() => {
            forceScrollToTop()
            setTimeout(() => {
              forceScrollToTop()
            }, 10)
          }, 10)
        }, 0)
      })
    })
    
    // 이미지 로드 후에도 스크롤 위치 재조정
    const images = document.querySelectorAll('#post-detail-view img')
    let loadedCount = 0
    const totalImages = images.length
    
    if (totalImages > 0) {
      const checkScroll = () => {
        loadedCount++
        if (loadedCount === totalImages) {
          // 모든 이미지 로드 완료 후 스크롤 재조정
          setTimeout(() => {
            forceScrollToTop()
            setTimeout(() => {
              forceScrollToTop()
            }, 50)
          }, 100)
        }
      }
      
      images.forEach(img => {
        if (img.complete) {
          checkScroll()
        } else {
          img.addEventListener('load', checkScroll, { once: true })
          img.addEventListener('error', checkScroll, { once: true })
        }
      })
    }
    
    // 추가 안전장치: 주기적으로 스크롤 위치 확인 및 조정 (더 오래 실행)
    const scrollCheckInterval = setInterval(() => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
      if (scrollTop > 10) {
        forceScrollToTop()
      }
    }, 50)
    
    // 2초 후 인터벌 제거 (더 오래 실행)
    setTimeout(() => {
      clearInterval(scrollCheckInterval)
    }, 2000)
  }, [post]) // post가 변경될 때마다 실행
  
  // 추가로 useEffect도 사용하여 브라우저 스크롤 복원 방지
  useEffect(() => {
    // 브라우저 스크롤 복원 방지
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    
    // 컴포넌트 마운트 시 스크롤 초기화
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) {
      document.documentElement.scrollTop = 0
    }
    if (document.body) {
      document.body.scrollTop = 0
    }
  }, [post])

  // 사용자 프로필 정보 로드
  useEffect(() => {
    if (!post) return
    
    const loadUserProfile = async () => {
      if (post.userId || post.user) {
        const profile = await db.getUserProfile(post.userId || post.user)
        setUserProfile(profile)
      }
    }
    loadUserProfile()
  }, [post?.userId, post?.user])
  
  // 포스트 이미지 목록 (메인 + 추가 이미지)
  const allImages = post
    ? (post.images || (post.image ? [post.image] : []))
    : []
  
  // Get all capture times
  const getCaptureTime = (index) => {
    if (index === 0) {
      return post.metadata?.capturedAt
    }
    return post.metadata?.additionalMetadata?.[index - 1]?.capturedAt || post.metadata?.capturedAt
  }
  
  // Get time range
  const getTimeRange = () => {
    const times = allImages.map((_, index) => getCaptureTime(index)).filter(Boolean)
    if (times.length === 0) return null
    
    const sortedTimes = times.sort((a, b) => new Date(a) - new Date(b))
    const start = formatCapturedTime(sortedTimes[0])
    const end = formatCapturedTime(sortedTimes[sortedTimes.length - 1])
    
    return start === end ? start : `${start} - ${end}`
  }
  
  const timeRange = getTimeRange()
  
  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1))
  }
  
  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0))
  }

  // 터치 제스처 처리
  const minSwipeDistance = 50

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
    setTouchStartY(e.targetTouches[0].clientY)
    setIsSwiping(false)
  }

  const onTouchMove = (e) => {
    const currentX = e.targetTouches[0].clientX
    const currentY = e.targetTouches[0].clientY
    
    // 수평 스와이프 감지 시 수직 스크롤 방지
    if (touchStart !== null && touchStartY !== null) {
      const deltaX = Math.abs(currentX - touchStart)
      const deltaY = Math.abs(currentY - touchStartY)
      
      // 수평 이동이 수직 이동보다 크고, 최소 거리 이상이면 스와이프로 판단
      if (deltaX > deltaY && deltaX > 15) {
        setIsSwiping(true)
        e.preventDefault() // 수직 스크롤 방지
      } else if (deltaY > deltaX && deltaY > 15) {
        // 수직 스크롤이 더 크면 스와이프 아님
        setIsSwiping(false)
      }
    }
    
    setTouchEnd(currentX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsSwiping(false)
      return
    }
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      handleNextImage()
    }
    if (isRightSwipe) {
      handlePrevImage()
    }
    
    setIsSwiping(false)
  }

  return (
    <div id="post-detail-view" className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div id="post-detail-header" className="flex items-center gap-3 p-4 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {/* 사용자 정보 */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt={userProfile.full_name || 'User'}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#ADFF2F]/20 border border-[#ADFF2F] flex items-center justify-center text-[#ADFF2F] font-semibold flex-shrink-0">
              {(userProfile?.full_name || post.user || 'U')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {userProfile?.full_name || userProfile?.email || post.user || 'Anonymous'}
            </div>
            <div className="text-xs text-gray-400">
              {post.timestamp ? (formatDate(post.timestamp) === 'Today' || formatDate(post.timestamp) === 'Yesterday' 
                ? `${formatDate(post.timestamp)} ${formatCapturedTime(post.timestamp)}`
                : formatDate(post.timestamp)) : 'Unknown time'}
            </div>
          </div>
        </div>
        
        {/* 삭제 버튼 (본인 포스팅만) */}
        {user?.id && (post.userId === user.id || post.user === user.id) && (
          <button
            onClick={(e) => {
              console.log('Delete button clicked, postId:', post.id)
              e.stopPropagation()
              e.preventDefault()
              console.log('onDeletePost prop:', onDeletePost)
              if (onDeletePost) {
                console.log('Calling onDeletePost with postId:', post.id)
                onDeletePost(post.id)
              } else {
                console.error('onDeletePost is not defined!')
              }
            }}
            className="p-2 hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0 text-red-400"
            title="Delete post"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Image Carousel */}
      <div 
        className="relative overflow-hidden"
        style={{ 
          touchAction: isSwiping ? 'pan-x' : 'pan-y pan-x',
          height: '60vh',
          minHeight: '400px',
          maxHeight: '600px'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
          {allImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-300 ${
                index === currentImageIndex ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <img
                src={image}
                alt={`${post.placeName} - Photo ${index + 1}`}
                className="w-full h-full object-contain"
              />
              
              {/* Capture Time Label */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 inline-block">
                  <span className="text-xs text-gray-300">
                    {formatCapturedTime(getCaptureTime(index))}
                    {index === 0 && ' (Main)'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {/* Navigation Arrows */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/90 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
        </button>
              <button
                onClick={handleNextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/90 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Image Indicators */}
          {allImages.length > 1 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
              {allImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentImageIndex ? 'bg-[#ADFF2F] w-6' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          )}
      </div>
      
      {/* Description Section */}
      {post.description && (
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
            {post.description}
          </p>
        </div>
      )}
      
      {/* Footer Info */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {timeRange && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-gray-300">{timeRange}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <svg className="w-3 h-3 text-[#ADFF2F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-xs font-semibold text-[#ADFF2F]">GPS Verified</span>
              </div>
            </div>
            
            {/* Like Button */}
            <button
              onClick={(e) => onToggleLike(post.id, e)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                postLikes[post.id]?.liked
                  ? 'bg-red-500/20 text-red-500 border border-red-500'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-red-500/50'
              }`}
            >
              <svg 
                className={`w-5 h-5 ${postLikes[post.id]?.liked ? 'fill-red-500' : 'fill-none'}`} 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-sm font-semibold">
                {postLikes[post.id]?.count || 0}
              </span>
            </button>
          </div>
      </div>
    </div>
  )
}

// 댓글 섹션 컴포넌트 (Discover 상세 하단)
function PlaceCommentsSection({ spot, user, formatCapturedTimeWithRecency, lang }) {
  const [comments, setComments] = useState([])
  const formatTime = formatCapturedTimeWithRecency ?? ((date) => (date ? new Date(date).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : ''))
  const [isLoading, setIsLoading] = useState(false)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([]) // File[]
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewIndex, setPreviewIndex] = useState(null) // 이미지 팝업용 {commentIdx, imageIdx}

  const [profileMap, setProfileMap] = useState({}) // userId -> { full_name, avatar_url }

  useEffect(() => {
    const load = async () => {
      if (!spot?.id) return
      setIsLoading(true)
      try {
        const data = await db.getPlaceComments(spot.id)
        setComments(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load comments:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [spot?.id])

  // 댓글 작성자 프로필 로드
  useEffect(() => {
    const userIds = [...new Set((comments || []).map((c) => c.user_id).filter(Boolean))]
    if (!userIds.length) return
    let cancelled = false
    const load = async () => {
      const map = {}
      await Promise.all(
        userIds.map(async (uid) => {
          const profile = await db.getUserProfile(uid)
          if (!cancelled && profile) map[uid] = { full_name: profile.full_name, avatar_url: profile.avatar_url }
        })
      )
      if (!cancelled) setProfileMap((prev) => ({ ...prev, ...map }))
    }
    load()
    return () => { cancelled = true }
  }, [comments])

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    const remaining = Math.max(0, 5 - files.length)
    const toAdd = selected.slice(0, remaining)
    setFiles((prev) => [...prev, ...toAdd])
    e.target.value = ''
  }

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!spot?.id) return
    if (!user) {
      setError(I18N.commentLoginRequired[lang])
      return
    }
    if (!content.trim() && files.length === 0) {
      setError(I18N.commentErrorNeedContent[lang])
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      // 이미지 업로드
      const imageUrls = []
      for (const file of files) {
        const timestamp = Date.now()
        const ext = file.name.split('.').pop() || 'jpg'
        const safeName = (spot.name || 'place').replace(/\s+/g, '_')
        const path = `comments/${spot.id}/${timestamp}_${safeName}.${ext}`
        const { data: uploadData } = await db.uploadImage(file, path)
        imageUrls.push(uploadData.publicUrl)
      }

      // Supabase에 댓글 저장
      const comment = await db.createPlaceComment({
        placeId: spot.id,
        userId: user.id,
        content,
        imageUrls,
      })

      // 목록 갱신 (위에 추가)
      setComments((prev) => [comment, ...prev])
      setContent('')
      setFiles([])
    } catch (err) {
      console.error('Failed to submit comment:', err)
      setError(err.message || I18N.commentErrorGeneric[lang])
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderCommentImages = (comment, cIdx) => {
    const imgs = Array.isArray(comment.images) ? comment.images : []
    if (!imgs.length) return null
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {imgs.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPreviewIndex({ commentIndex: cIdx, imageIndex: i })}
            className="w-16 h-16 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 flex items-center justify-center"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    )
  }

  const renderImageModal = () => {
    if (!previewIndex) return null
    const { commentIndex, imageIndex } = previewIndex
    const comment = comments[commentIndex]
    if (!comment) return null
    const imgs = Array.isArray(comment.images) ? comment.images : []
    if (!imgs.length) return null

    const current = imgs[imageIndex] || imgs[0]

    const go = (delta) => {
      const n = imgs.length
      const next = ((imageIndex + delta) % n + n) % n
      setPreviewIndex({ commentIndex, imageIndex: next })
    }

    return (
      <div className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center">
        <button
          type="button"
          className="absolute top-4 right-4 text-gray-300 hover:text-white"
          onClick={() => setPreviewIndex(null)}
        >
          ✕
        </button>
        <div className="relative max-w-full max-h-full px-8 flex items-center justify-center">
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-300 hover:text-white px-2 py-1"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <img src={current} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-300 hover:text-white px-2 py-1"
            onClick={() => go(1)}
          >
            ›
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[430px] mx-auto px-4 pb-6 pt-4">
      <h2 className="text-sm font-semibold text-gray-200 mb-2">
        {I18N.commentTitle[lang]}
      </h2>

      {/* 작성 폼 */}
      <div className="mb-4">
        {!user ? (
          <p className="text-xs text-gray-400">
            {I18N.commentLoginRequired[lang]}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-[#ADFF2F] text-sm text-white"
              placeholder={I18N.commentPlaceholder[lang]}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900 border border-gray-700 text-xs text-gray-300 cursor-pointer hover:border-[#ADFF2F]/60 hover:text-[#ADFF2F]">
                  <img
                      src="/image/common/ico_camera.png"
                      alt="comment icon"
                      className="w-5 h-5 object-contain"
                  />
                  <span>{I18N.commentAddPhoto[lang]} ({files.length}/5)</span>
                  <input
                      type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-full bg-[#ADFF2F] text-black text-xs font-semibold hover:bg-[#ADFF2F]/90 disabled:opacity-50"
              >
                {isSubmitting ? I18N.commentSubmitting[lang] : I18N.commentSubmit[lang]}
              </button>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {files.map((file, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 flex items-center justify-center">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(i)}
                      className="absolute -top-1 -right-1 bg-black/80 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </form>
        )}
      </div>

      {/* 댓글 리스트 */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-gray-400">{I18N.commentLoading[lang]}</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-gray-500">{I18N.commentEmpty[lang]}</p>
        ) : (
          comments.map((c, idx) => {
            const profile = profileMap[c.user_id]
            const fallbackName = I18N.commentAnonymous[lang]
            const displayName =
              profile?.full_name
              ?? (c.user_id === user?.id ? (user.user_metadata?.full_name || user.email?.split('@')[0]) : null)
              ?? fallbackName
            const avatarUrl = profile?.avatar_url ?? (c.user_id === user?.id ? user.user_metadata?.avatar_url : null)
            return (
            <div key={c.id} className="border border-gray-800 rounded-lg bg-gray-900/60 px-3 py-2 text-xs text-gray-200">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-[10px] text-gray-300 flex-shrink-0">
                      {displayName.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="font-semibold text-[11px] text-gray-300 truncate">
                    {displayName}
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                  {c.created_at ? formatTime(c.created_at) : ''}
                </span>
              </div>
              <p className="whitespace-pre-line">{c.content}</p>
              {renderCommentImages(c, idx)}
            </div>
            )
          })
        )}
      </div>

      {renderImageModal()}
    </div>
  )
}

// Post Vibe Modal Component
function PostVibeModal({
  categories,
  places,
  customPlaceNames = [],
  selectedCategory,
  selectedPlace,
  selectedCustomPlace,
  vibeOptions,
  selectedVibe,
  selectedDescription,
  mainImage,
  additionalImages,
  metadata,
  userLocation,
  lang = 'ko',
  getCategoryLabel = (cat) => (cat?.code_label_ko ?? cat?.code_label ?? ''),
  onCategoryChange,
  onPlaceChange,
  onCustomPlaceChange,
  onVibeChange,
  onDescriptionChange,
  onMainImageSelect,
  onAdditionalImagesSelect,
  onRemoveAdditionalImage,
  onPost,
  onClose,
  formatCapturedTime,
  formatDate,
  formatDistance,
  isPosting = false,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [customPlaceSuggestions, setCustomPlaceSuggestions] = useState([])
  const [showCustomSuggestions, setShowCustomSuggestions] = useState(false)
  const customPlaceInputRef = useRef(null)

  const handlePlaceSelect = (placeName) => {
    onPlaceChange(placeName)
    setIsDropdownOpen(false)
  }

  const selectedPlaceLabel = selectedPlace || 'Select a place'

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
      if (customPlaceInputRef.current && !customPlaceInputRef.current.contains(event.target)) {
        setShowCustomSuggestions(false)
      }
    }

    if (isDropdownOpen || showCustomSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, showCustomSuggestions])

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      <div className="fixed left-4 right-4 top-4 bottom-4 md:left-1/2 md:right-auto md:transform md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl z-50 flex flex-col max-h-[90vh] md:max-h-[85vh]">
        {/* 고정 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-2xl font-bold">Post Vibe</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        
        {/* 스크롤 가능한 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-400">
              Category
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {categories.map((category) => (
                <button
                  key={category.code_value}
                  type="button"
                  onClick={() => {
                    onCategoryChange(category.code_value)
                    onPlaceChange('') // 카테고리 변경 시 장소 초기화
                    onCustomPlaceChange('') // 커스텀 장소도 초기화
                  }}
                  className={`py-3 px-2 rounded-lg border-2 transition-all duration-200 ${
                    selectedCategory === category.code_value
                      ? 'border-[#ADFF2F] bg-[#ADFF2F]/20 text-[#ADFF2F]'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="text-xs font-semibold">
                    {getCategoryLabel(category, lang)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Place Selection */}
          {selectedCategory && selectedCategory !== 'other' && (
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="text-sm font-semibold text-gray-400">
                Where are you?
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-3 text-left text-white focus:outline-none focus:border-[#ADFF2F] transition-colors flex items-center justify-between"
                >
                  <span className={selectedPlace ? '' : 'text-gray-500'}>
                    {selectedPlace || 'Select a place'}
                  </span>
                  <svg
                    className={`w-5 h-5 text-[#ADFF2F] transition-transform flex-shrink-0 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    {places.length > 0 ? (
                      places.map((place) => (
                        <button
                          key={place.id || place.name}
                          type="button"
                          onClick={() => handlePlaceSelect(place.name)}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                            selectedPlace === place.name
                              ? 'bg-gray-700 text-[#ADFF2F]'
                              : 'text-white hover:bg-gray-700'
                          }`}
                        >
                          <span>{place.name}</span>
                          {userLocation && place.distance !== undefined && (
                            <span className="text-xs text-gray-400 ml-2">
                              {formatDistance(place.distance)}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-400 text-center">
                        No places available in this category
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Place Input (for "other" category) */}
          {selectedCategory === 'other' && (
            <div className="space-y-2 relative" ref={customPlaceInputRef}>
              <label className="text-sm font-semibold text-gray-400">
                Place Name
              </label>
              <input
                type="text"
                value={selectedCustomPlace}
                onChange={(e) => {
                  const value = e.target.value
                  onCustomPlaceChange(value)
                  
                  // Autocomplete suggestions 필터링
                  if (value.trim().length > 0) {
                    const filtered = customPlaceNames
                      .filter(item => 
                        item.place_name.toLowerCase().includes(value.toLowerCase()) &&
                        (!item.category_type || item.category_type === 'other')
                      )
                      .slice(0, 5) // 최대 5개만 표시
                    setCustomPlaceSuggestions(filtered)
                    setShowCustomSuggestions(filtered.length > 0)
                  } else {
                    setCustomPlaceSuggestions([])
                    setShowCustomSuggestions(false)
                  }
                }}
                onFocus={() => {
                  if (selectedCustomPlace.trim().length > 0 && customPlaceSuggestions.length > 0) {
                    setShowCustomSuggestions(true)
                  }
                }}
                placeholder="Enter place name..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#ADFF2F] transition-colors"
                maxLength={100}
              />
              
              {/* Autocomplete Suggestions */}
              {showCustomSuggestions && customPlaceSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {customPlaceSuggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onCustomPlaceChange(item.place_name)
                        setShowCustomSuggestions(false)
                        setCustomPlaceSuggestions([])
                      }}
                      className="w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between text-white hover:bg-gray-700"
                    >
                      <span>{item.place_name}</span>
                      {item.usage_count > 1 && (
                        <span className="text-xs text-gray-400 ml-2">
                          ({item.usage_count} times)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-400">
              How's the Vibe?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {vibeOptions.map((vibe) => (
                <button
                  key={vibe.id}
                  onClick={() => onVibeChange(vibe.id)}
                  className={`
                    py-3 px-2 rounded-lg border-2 transition-all duration-200
                    ${selectedVibe === vibe.id
                      ? 'border-[#ADFF2F] bg-[#ADFF2F]/20 text-[#ADFF2F] scale-105'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }
                  `}
                >
                  <div className="text-lg mb-1">{vibe.emoji}</div>
                  <div className="text-xs font-semibold leading-tight">
                    {vibe.label.split(' ').slice(1).join(' ')}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {vibe.description}
                  </div>
        </button>
              ))}
            </div>
          </div>

          {/* Main Photo Section */}
          <div className="space-y-2">
      <div>
              <label className="text-sm font-semibold text-gray-400">
                Main Photo
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Set as cover. Location & time will be based on this photo. 📍
        </p>
      </div>
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={onMainImageSelect}
                className="hidden"
              />
              <div className="w-full bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-[#ADFF2F] transition-colors">
                {mainImage ? (
                  <div className="space-y-3">
                    <div className="relative mx-auto w-48 h-48 rounded-lg overflow-hidden border-2 border-[#ADFF2F]">
                      <img
                        src={URL.createObjectURL(mainImage)}
                        alt="Main photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-[#ADFF2F]">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-semibold">Main Photo Selected</span>
                    </div>
                    <div className="text-xs text-gray-400">{mainImage.name}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg
                      className="w-8 h-8 mx-auto text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <div className="text-sm text-gray-400">Select Main Photo</div>
                    <div className="text-xs text-gray-500">GPS-enabled photos required</div>
                  </div>
                )}
              </div>
            </label>

            {/* Metadata Display */}
            {metadata && (
              <div className="bg-gray-800/50 rounded-lg p-4 border border-[#ADFF2F]/30">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[#ADFF2F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs font-semibold text-[#ADFF2F]">Metadata Verified</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-gray-500">📍</span>
                    <span>{metadata.locationName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-gray-500">🕒</span>
                    <span>{formatDate(metadata.capturedAt)} {formatCapturedTime(metadata.capturedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300 text-xs">
                    <span className="text-gray-500">📐</span>
                    <span>{metadata.lat.toFixed(6)}, {metadata.lng.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <div>
              <label className="text-sm font-semibold text-gray-400">
                Description (Optional)
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Share your experience. Max 500 characters.
              </p>
            </div>
            <textarea
              value={selectedDescription || ''}
              onChange={(e) => {
                const value = e.target.value
                if (value.length <= 500) {
                  onDescriptionChange(value)
                }
              }}
              placeholder="Tell us about your experience..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#ADFF2F] transition-colors resize-none"
              rows={4}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 text-right">
              {(selectedDescription || '').length}/500
            </div>
          </div>

          {/* Additional Photos Section */}
          <div className="space-y-2">
            <div>
              <label className="text-sm font-semibold text-gray-400">
                Add More
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Max 4 photos. Share different angles of the vibe.
              </p>
            </div>
            
            {/* Additional Photos Grid */}
            {additionalImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {additionalImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-700">
                      <img
                        src={URL.createObjectURL(img)}
                        alt={`Additional ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={() => onRemoveAdditionalImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 transition-colors"
                    >
                      ✕
        </button>
                  </div>
                ))}
              </div>
            )}

            {additionalImages.length < 4 && (
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onAdditionalImagesSelect}
                  className="hidden"
                />
                <div className="w-full bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-[#ADFF2F] transition-colors">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm">Add Photos ({additionalImages.length}/4)</span>
                  </div>
                </div>
              </label>
            )}
          </div>

          <button
            onClick={onPost}
            disabled={!mainImage || !metadata || isPosting}
            className={`w-full font-bold py-4 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center gap-2 ${
              mainImage && metadata && !isPosting
                ? 'bg-[#ADFF2F] text-black hover:bg-[#ADFF2F]/90'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isPosting ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Posting...</span>
              </>
            ) : (
              'Post Now'
            )}
          </button>
          </div>
        </div>
      </div>
    </>
  )
}

// Bottom Navigation Component
function BottomNav({ currentView, onNavClick, lang = 'ko' }) {
  const navItems = [
    { id: 'discover', labelKey: 'navDiscover', icon: '/image/common/ico_discover.png' },
    { id: 'map', labelKey: 'navMap', icon: '/image/common/ico_map.png' },
    { id: 'my', labelKey: 'navMy', icon: '/image/common/ico_setting.png' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-gray-800 z-20 pb-[env(safe-area-inset-bottom,0)] flex flex-col justify-center" style={{ minHeight: BOTTOM_NAV_CONTENT_HEIGHT }}>
      <div className="max-w-[430px] mx-auto w-full">
        <div className="grid grid-cols-3 gap-1 px-2 py-3 items-center" style={{ minHeight: BOTTOM_NAV_CONTENT_HEIGHT }}>
          {navItems.map((item) => (
              <button
                  key={item.id}
                  onClick={() => onNavClick(item.id)}
                  className={`
                flex flex-col items-center gap-1 p-2 rounded-lg transition-all
                ${currentView === item.id
                      ? 'text-[#ADFF2F]'
                      : 'text-gray-500 hover:text-gray-300'
                  }
              `}
              >
                <img
                    src={item.icon}
                    alt={item.id}
                    className={`w-7 h-7 object-contain ${currentView === item.id ? '' : 'opacity-50'}`}
                />
                <span className="text-xs font-medium">{I18N[item.labelKey][lang]}</span>
              </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Delete Confirm Modal Component
function DeleteConfirmModal({onClose, onConfirm}) {
  return (
      <>
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999]"
        onClick={onClose}
      />
      
      <div className="fixed left-4 right-4 bottom-4 md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl z-[10000] p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Delete Post</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-300 mb-2">
            Are you sure you want to delete this post?
          </p>
          <p className="text-sm text-gray-400">
            This action cannot be undone.
        </p>
      </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors border border-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors border border-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </>
  )
}

// Login Modal Component
function LoginModal({ onClose, onLogin }) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      <div className="fixed left-4 right-4 bottom-4 md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl z-50 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Sign In Required</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-400">
            Please sign in to share the vibe with the community.
          </p>

          <button
            onClick={onLogin}
            className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            By signing in, you agree to share your vibe posts with the community.
          </p>
        </div>
      </div>
    </>
  )
}

export default App
