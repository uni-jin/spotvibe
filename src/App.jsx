import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import exifr from 'exifr'
import imageCompression from 'browser-image-compression'
import Masonry from 'react-masonry-css'
import { auth, db } from './lib/supabase'

function App() {
  const [currentView, setCurrentView] = useState('home')
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [postPlace, setPostPlace] = useState('')
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
  const [spotFilter, setSpotFilter] = useState(null) // 장소 필터링 상태
  const [selectedPost, setSelectedPost] = useState(null) // 선택된 포스트 (Detail View)
  const [user, setUser] = useState(null) // 현재 로그인한 사용자
  const [showLoginModal, setShowLoginModal] = useState(false) // 로그인 모달 표시 여부
  const [hotSpots, setHotSpots] = useState([]) // 팝업스토어 목록 (Supabase에서 로드)
  const [isLoadingPosts, setIsLoadingPosts] = useState(true) // 포스트 로딩 상태
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true) // 장소 로딩 상태
  const [postsError, setPostsError] = useState(null) // 포스트 로드 에러
  const [placesError, setPlacesError] = useState(null) // 장소 로드 에러
  const [postLikes, setPostLikes] = useState({}) // { postId: { count: number, liked: boolean } }
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false) // 삭제 확인 모달 표시 여부
  const [postToDelete, setPostToDelete] = useState(null) // 삭제할 포스트 ID

  const regions = [
    { id: 'Seongsu', name: 'Seongsu', active: true },
    { id: 'Hongdae', name: 'Hongdae', active: false },
    { id: 'Hannam', name: 'Hannam', active: false },
    { id: 'Gangnam', name: 'Gangnam', active: false },
  ]

  // 지역 선택 상태 복원 (새로고침 시 유지)
  useEffect(() => {
    const savedRegionId = localStorage.getItem('selectedRegionId')
    if (savedRegionId) {
      const savedRegion = regions.find((r) => r.id === savedRegionId)
      if (savedRegion && savedRegion.active) {
        setSelectedRegion(savedRegion)
        setCurrentView('feed')
      }
    }
  }, [])

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
        } else if (view === 'feed' || view === 'map' || view === 'quest' || view === 'my') {
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

  // Supabase에서 팝업스토어 목록 로드
  useEffect(() => {
    const loadPlaces = async () => {
      try {
        setIsLoadingPlaces(true)
        setPlacesError(null)
        const places = await db.getPlaces()
        // places를 hotSpots 형식으로 변환
        // status는 places 테이블의 wait_time 필드를 사용하거나 기본값 사용
        const formattedPlaces = places.map((place) => ({
          id: place.id,
          name: place.name,
          nameEn: place.nameEn || place.name,
          status: place.status || '🟢 Quiet',
          wait: place.wait || 'Quiet',
        }))
        setHotSpots(formattedPlaces)
      } catch (error) {
        console.error('Error loading places:', error)
        setPlacesError('Failed to load places. Please try again later.')
      } finally {
        setIsLoadingPlaces(false)
      }
    }

    loadPlaces()
  }, [])

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

  // Post Vibe 모달에서 사용할 장소 목록 (hotSpots에서 가져오고 '기타' 옵션 추가)
  const places = [...hotSpots.map(spot => spot.name), '기타']
  const vibeOptions = [
    { id: 'verybusy', label: '🔥 Very Busy', emoji: '🔥', description: '40min+' },
    { id: 'busy', label: '⏱️ Busy', emoji: '⏱️', description: '10-20min' },
    { id: 'nowait', label: '✅ No Wait', emoji: '✅', description: 'No Wait' },
    { id: 'quiet', label: '🟢 Quiet', emoji: '🟢', description: 'Quiet' },
    { id: 'soldout', label: '⚠️ Sold Out / Closed', emoji: '⚠️', description: 'Closed' },
  ]

  // Leaflet 기본 아이콘 설정 (이미지 경로 문제 해결) - 모든 훅은 조건부 렌더링 이전에 위치해야 함
  useEffect(() => {
    // @ts-ignore - Leaflet 타입 정의 문제 해결
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
  }, [])

  const handleRegionClick = (region) => {
    if (region.active) {
      setSelectedRegion(region)
      setCurrentView('feed')
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
    
    // 원본 포스트 데이터 확인 (vibePosts에서 찾기)
    const originalPost = vibePosts.find(p => p.id === post.id) || post
    
    // 브라우저 히스토리에 추가
    window.history.pushState({ view: 'post-detail', postId: originalPost.id }, '', `#post-${originalPost.id}`)
    setSelectedPost(originalPost)
    setCurrentView('post-detail')
  }
  
  const handleClosePostDetail = () => {
    // 브라우저 히스토리에 이전 뷰 추가
    const previousView = currentView === 'post-detail' ? 'feed' : currentView
    window.history.pushState({ view: previousView }, '', previousView === 'feed' ? '#feed' : '#')
    setSelectedPost(null)
    setCurrentView(previousView)
  }
  
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
          }
        } else if (view === 'feed' || view === 'map' || view === 'quest' || view === 'my') {
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
    if (!user?.id) {
      setShowLoginModal(true)
      return
    }
    setPostToDelete(postId)
    setShowDeleteConfirmModal(true)
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
    if (!postPlace || !postVibe) {
      alert('Please select a place and vibe status')
      return
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
      const selectedPlace = hotSpots.find((p) => p.name === postPlace)
      const placeId = selectedPlace?.id || null

      // 3. Supabase에 포스트 저장
      const postData = {
        placeId: placeId,
        placeName: postPlace,
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
      }

      const savedPost = await db.createPost(postData)

      // 4. 로컬 state 업데이트 (새로 저장된 포스트 추가)
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

  const getVibeInfo = (vibeId) => {
    return vibeOptions.find((v) => v.id === vibeId) || vibeOptions[0]
  }

  const handleNavClick = (viewId) => {
    if (viewId === 'feed' && !selectedRegion) {
      // 지역 선택 화면으로
      setCurrentView('home')
    } else {
      setCurrentView(viewId)
    }
  }

  // Home View - Region Selector
  if (currentView === 'home') {
  return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-12 pb-24">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
            <span className="text-[#ADFF2F]">Spot</span>
            <span className="text-white">Vibe</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 font-light tracking-wide">
            Pick your Hotspot
          </p>
        </div>

        {/* Region Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {regions.map((region) => (
            <div
              key={region.id}
              onClick={() => handleRegionClick(region)}
              className={`
                relative group cursor-pointer transition-all duration-300
                ${region.active 
                  ? 'opacity-100 hover:scale-105' 
                  : 'opacity-60 grayscale hover:opacity-80'
                }
              `}
            >
              <div
                className={`
                  border-2 rounded-2xl p-8 md:p-12
                  transition-all duration-300
                  ${region.active
                    ? 'border-[#ADFF2F] bg-gradient-to-br from-[#ADFF2F]/10 to-transparent hover:border-[#ADFF2F] hover:shadow-[0_0_30px_rgba(173,255,47,0.3)]'
                    : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                  }
                `}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-2">
                  {region.name}
                </h2>
                
                {!region.active && (
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 text-xs font-semibold bg-gray-800 text-gray-400 rounded-full border border-gray-700">
                      Coming Soon
                    </span>
                  </div>
                )}

                {region.active && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#ADFF2F] animate-pulse"></div>
                    <span className="text-sm text-[#ADFF2F] font-medium">
                      Available Now
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Feed View
  if (currentView === 'feed') {
    const filteredPosts = getFilteredPosts()
    const filteredSpot = spotFilter ? hotSpots.find((s) => s.id === spotFilter) : null

    return (
      <div className="min-h-screen bg-black text-white pb-24">
        {/* Header */}
        <div className="sticky top-0 bg-black/95 backdrop-blur-sm z-10 border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">
                Live Vibe Stream <span className="text-[#ADFF2F]">🔥</span>
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
          <div className="sticky top-[73px] bg-[#ADFF2F]/10 border-b border-[#ADFF2F]/30 z-[9]">
            <div className="max-w-6xl mx-auto px-4 py-3">
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

        {/* Hot Spots Now Section */}
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h2 className="text-lg font-bold mb-3 text-gray-300">Hot Spots Now</h2>
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
          ) : hotSpots.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {hotSpots.map((spot) => (
                <div
                  key={spot.id}
                  onClick={() => handlePlaceClick(spot.id)}
                  className={`flex-shrink-0 bg-gray-900 border rounded-xl p-4 min-w-[200px] cursor-pointer transition-all ${
                    spotFilter === spot.id
                      ? 'border-[#ADFF2F] bg-[#ADFF2F]/10'
                      : 'border-gray-800 hover:border-[#ADFF2F]/50'
                  }`}
                >
                  <h3 className="font-bold text-sm mb-1">{spot.name}</h3>
                  <p className="text-xs text-gray-400 mb-2">{spot.nameEn}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#ADFF2F]">{spot.status}</span>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs text-gray-400">{spot.wait}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No pop-up stores available</p>
            </div>
          )}
        </div>


        {/* Live Vibe Stream Section - 2열 격자 */}
        <div className="max-w-6xl mx-auto px-4 py-4">
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
                    <div className={`relative w-full ${cardHeight} overflow-hidden flex-shrink-0`}>
                      <img
                        src={mainImage}
                        alt={post.placeName}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                      
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
                      {/* Place Name */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePlaceClick(post.placeId)
                        }}
                        className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${
                          spotFilter === post.placeId
                            ? 'bg-[#ADFF2F]/30 text-[#ADFF2F] border-[#ADFF2F]'
                            : 'bg-[#ADFF2F]/20 text-[#ADFF2F] border-[#ADFF2F]/50 hover:bg-[#ADFF2F]/30'
                        }`}
                      >
                        📍 {post.placeName}
                      </button>

                      {/* Captured Time */}
                      {post.metadata?.capturedAt && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Captured at {formatCapturedTime(post.metadata.capturedAt)}</span>
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

        {/* Delete Confirm Modal */}
        {showDeleteConfirmModal && postToDelete && (
          <DeleteConfirmModal
            onClose={handleCloseDeleteConfirm}
            onConfirm={() => handleDeletePost(postToDelete)}
          />
        )}

        {/* Post Vibe Modal */}
        {isModalOpen && (
          <PostVibeModal
            places={places}
            vibeOptions={vibeOptions}
            selectedPlace={postPlace}
            selectedVibe={postVibe}
            selectedDescription={postDescription}
            mainImage={postMainImage}
            additionalImages={postAdditionalImages}
            metadata={postMetadata}
            onPlaceChange={setPostPlace}
            onVibeChange={setPostVibe}
            onDescriptionChange={setPostDescription}
            onMainImageSelect={handleMainImageSelect}
            onAdditionalImagesSelect={handleAdditionalImagesSelect}
            onRemoveAdditionalImage={handleRemoveAdditionalImage}
            onPost={handlePostVibe}
            onClose={handleCloseModal}
            formatCapturedTime={formatCapturedTime}
            formatDate={formatDate}
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
        <BottomNav currentView={currentView} onNavClick={handleNavClick} />
      </div>
    )
  }

  // 클러스터링 함수
  const clusterPosts = (posts, zoomLevel) => {
    if (zoomLevel === 2 && selectedCluster) {
      // 확대된 상태: 선택된 클러스터의 개별 포스트만 반환
      return selectedCluster.posts.map((post) => {
        // 메인 이미지 추출 (images 배열의 첫 번째 또는 image 속성)
        const mainImage = post.images?.[0] || post.image
        return {
          ...post,
          image: mainImage,
          isCluster: false,
          clusterId: selectedCluster.id,
        }
      })
    }

    const postsWithCoords = posts.filter((post) => post.metadata)
    const clusters = []
    const processed = new Set()

    postsWithCoords.forEach((post, index) => {
      if (processed.has(index)) return

      const cluster = {
        id: `cluster-${index}`,
        posts: [post],
        centerLat: post.metadata.lat,
        centerLng: post.metadata.lng,
      }

      // 근처 포스트 찾기 (거리 기반)
      postsWithCoords.forEach((otherPost, otherIndex) => {
        if (otherIndex === index || processed.has(otherIndex)) return

        const distance = Math.sqrt(
          Math.pow(post.metadata.lat - otherPost.metadata.lat, 2) +
          Math.pow(post.metadata.lng - otherPost.metadata.lng, 2)
        )

        // 클러스터링 거리 임계값 (약 0.001도 = 약 100m)
        if (distance < 0.001) {
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
      
      return {
        ...cluster,
        image: mainImage, // 개별 포스트일 때도 이미지 포함
        isCluster: cluster.posts.length > 1,
        count: cluster.posts.length,
      }
    })
  }

  // 커스텀 마커 아이콘 생성 함수
  const createCustomIcon = (imageUrl, isRecent = false, timeAgo = '') => {
    // 이미지 URL이 없으면 기본 이미지 사용
    if (!imageUrl) {
      imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzMzMzMzIi8+CjxwYXRoIGQ9Ik0zMiAyMEMyNS4zNzI2IDIwIDIwIDI1LjM3MjYgMjAgMzJDMjAgMzguNjI3NCAyNS4zNzI2IDQ0IDMyIDQ0QzM4LjYyNzQgNDQgNDQgMzguNjI3NCA0NCAzMkM0NCAyNS4zNzI2IDM4LjYyNzQgMjAgMzIgMjBaIiBmaWxsPSIjQUREQ0YyRiIvPgo8L3N2Zz4K'
    }
    
    // HTML 이스케이프 처리
    const escapedImageUrl = imageUrl.replace(/"/g, '&quot;')
    const escapedTimeAgo = timeAgo && typeof timeAgo === 'string' 
      ? timeAgo.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      : ''
    
    // 시간 정보 배지 HTML
    const timeBadge = escapedTimeAgo 
      ? `<div style="position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: #ADFF2F; font-size: 9px; font-weight: bold; padding: 3px 6px; border-radius: 6px; white-space: nowrap; z-index: 10; border: 1px solid #ADFF2F; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">${escapedTimeAgo}</div>`
      : ''
    
    const recentPulse = isRecent 
      ? '<div style="position: absolute; inset: 0; border-radius: 50%; background: #ADFF2F; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.5;"></div>'
      : ''
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="position: relative; width: 64px; height: 80px;">
          ${recentPulse}
          <div style="position: relative; width: 64px; height: 64px; border-radius: 50%; overflow: hidden; border: 2px solid #ADFF2F; box-shadow: 0 10px 15px -3px rgba(173,255,47,0.5); background: #000;">
            <img src="${escapedImageUrl}" alt="pin" style="width: 100%; height: 100%; object-fit: cover;" />
            <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 30%, transparent 60%);"></div>
            ${timeBadge}
          </div>
          <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) translateY(100%);">
            <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 8px solid #ADFF2F;"></div>
          </div>
        </div>
      `,
      iconSize: [64, 80],
      iconAnchor: [32, 80],
      popupAnchor: [0, -80],
    })
  }

  // 클러스터 아이콘 생성 함수
  const createClusterIcon = (count) => {
    return L.divIcon({
      className: 'custom-cluster-marker',
      html: `
        <div style="position: relative; width: 48px; height: 48px; animation: radar-pulse 2s ease-in-out infinite;">
          <div style="position: absolute; inset: 0; border-radius: 50%; background: #ADFF2F; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.75;"></div>
          <div style="position: relative; width: 48px; height: 48px; border-radius: 50%; background: #ADFF2F; border: 2px solid #000; box-shadow: 0 10px 15px -3px rgba(173,255,47,0.5); display: flex; align-items: center; justify-content: center;">
            <span style="color: #000; font-weight: bold; font-size: 12px;">${count}+</span>
          </div>
          <div style="position: absolute; inset: 0; border-radius: 50%; border: 2px solid #ADFF2F; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    })
  }

  // Map View
  if (currentView === 'map') {
    const mapItems = clusterPosts(vibePosts, mapZoom)
    // 선택한 지역이 있으면 해당 지역 중심, 없으면 성수동 기본값
    const mapCenter = selectedRegion 
      ? (selectedRegion.id === 'Seongsu' ? [37.5446, 127.0559] : [37.5446, 127.0559]) // 다른 지역 좌표는 나중에 추가
      : [37.5446, 127.0559] // 기본값: 성수동

    return (
      <div className="min-h-screen bg-black text-white pb-24 relative overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-black/80 backdrop-blur-sm z-[1000] border-b border-[#ADFF2F]/30">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
      <div>
                <h1 className="text-xl font-bold">
                  Live Radar <span className="text-[#ADFF2F]">📡</span>
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {vibePosts.filter((p) => p.metadata).length} active signals
                </p>
      </div>
              {mapZoom === 2 && (
                <button
                  onClick={() => {
                    setMapZoom(1)
                    setSelectedCluster(null)
                    setSelectedPin(null)
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#ADFF2F]/20 text-[#ADFF2F] rounded-lg border border-[#ADFF2F]/50 hover:bg-[#ADFF2F]/30"
                >
                  ← Back
        </button>
              )}
            </div>
          </div>
        </div>

        {/* Leaflet Map */}
        <div className="absolute inset-0 pt-16" style={{ height: 'calc(100vh - 64px)' }}>
          <MapContainer
            center={mapCenter}
            zoom={16}
            style={{ height: '100%', width: '100%', zIndex: 1 }}
            className="dark-map"
            scrollWheelZoom={true}
          >
            {/* 다크 테마 타일 레이어 */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              className="dark-tiles"
            />

            {/* 마커 표시 */}
            {mapItems.length > 0 ? (
              mapItems.map((item) => {
                // 메타데이터가 없으면 건너뛰기
                if (!item.metadata && !item.centerLat) return null
                
                const position = [
                  item.centerLat || item.metadata.lat,
                  item.centerLng || item.metadata.lng,
                ]
                const isRecent = item.metadata
                  ? (Date.now() - new Date(item.metadata.capturedAt).getTime()) / 60000 < 5
                  : false

                if (item.isCluster) {
                  return (
                    <Marker
                      key={item.id}
                      position={position}
                      icon={createClusterIcon(item.count)}
                      eventHandlers={{
                        click: () => {
                          setSelectedCluster(item)
                          setMapZoom(2)
                        },
                      }}
                    />
                  )
                } else {
                  const vibeInfo = getVibeInfo(item.vibe)
                  // 시간 정보 계산 (촬영 시간 또는 포스팅 시간 사용)
                  const timeAgo = item.metadata?.capturedAt 
                    ? getTimeAgo(new Date(item.metadata.capturedAt))
                    : (item.timestamp ? getTimeAgo(new Date(item.timestamp)) : '')
                  
                  // 이미지 URL 확인
                  const markerImage = item.image || item.images?.[0] || null
                  
                  return (
                    <Marker
                      key={item.id}
                      position={position}
                      icon={createCustomIcon(markerImage, isRecent, timeAgo)}
                    >
                      <Popup className="custom-popup">
                        <div className="bg-gray-900 border-2 border-[#ADFF2F] rounded-lg p-4 shadow-2xl min-w-[200px]">
                          <div className="flex items-start gap-3 mb-3">
                            <img
                              src={markerImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMzMzMzMzIi8+Cjwvc3ZnPgo='}
                              alt={item.placeName}
                              className="w-16 h-16 rounded object-cover"
                            />
                            <div className="flex-1">
                              <h3 className="font-bold text-sm mb-1 text-white">{item.placeName}</h3>
                              <div className="mb-2">
                                <span className="text-xs text-[#ADFF2F]">{vibeInfo.label}</span>
                              </div>
                              {item.metadata?.capturedAt && (
                                <div className="text-xs text-gray-400">
                                  <div className="flex items-center gap-1.5">
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Captured at {formatCapturedTime(item.metadata.capturedAt)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              // 원본 포스트 데이터 찾기 (클러스터링된 데이터가 아닌 원본)
                              const originalPost = vibePosts.find(p => p.id === item.id) || item
                              handlePostClick(originalPost)
                              setSelectedPin(null)
                            }}
                            className="w-full bg-[#ADFF2F] text-black font-semibold py-2 rounded text-xs hover:bg-[#ADFF2F]/90 transition-colors"
                          >
                            View Detail →
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  )
                }
              })
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10">
                <p>No location data available</p>
              </div>
            )}
          </MapContainer>
        </div>

        {/* Bottom Navigation */}
        <BottomNav currentView={currentView} onNavClick={handleNavClick} />
      </div>
    )
  }

  // Post Detail View
  if (currentView === 'post-detail') {
    if (!selectedPost) {
      // selectedPost가 없으면 Feed로 리다이렉트
      console.warn('No post selected, redirecting to feed')
      setCurrentView('feed')
      return null
    }
    
    return (
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
    )
  }

  // Quest View
  if (currentView === 'quest') {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 bg-black/95 backdrop-blur-sm z-10 border-b border-gray-800">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">
              Quest <span className="text-[#ADFF2F]">🎯</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Complete challenges and earn rewards
        </p>
      </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <p className="text-gray-400">Coming Soon</p>
          </div>
        </div>

        <BottomNav currentView={currentView} onNavClick={handleNavClick} />
      </div>
    )
  }

  // My View
  if (currentView === 'my') {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 bg-black/95 backdrop-blur-sm z-10 border-b border-gray-800">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">
              My Profile <span className="text-[#ADFF2F]">👤</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Your activity and settings
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6">
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

              {/* Stats Section */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Your Activity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#ADFF2F]">
                      {vibePosts.filter((p) => p.userId === user.id || p.user === user.id).length}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Posts Shared</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#ADFF2F]">
                      {new Set(vibePosts.filter((p) => p.userId === user.id || p.user === user.id).map((p) => p.placeId)).size}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Places Visited</div>
                  </div>
                </div>
              </div>

              {/* Recent Posts Section */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4">Recent Posts</h3>
                {vibePosts.filter((p) => p.userId === user.id || p.user === user.id).length > 0 ? (
                  <div className="space-y-4">
                    {vibePosts
                      .filter((p) => p.userId === user.id || p.user === user.id)
                      .slice(0, 5)
                      .map((post) => {
                        const vibeInfo = getVibeInfo(post.vibe)
                        return (
                          <div
                            key={post.id}
                            onClick={() => handlePostClick(post)}
                            className="bg-gray-800 border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-[#ADFF2F]/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <img
                                src={post.image}
                                alt={post.placeName}
                                className="w-20 h-20 rounded-lg object-cover"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-sm">{post.placeName}</h4>
                                  <span className="text-xs">{vibeInfo.emoji}</span>
                                </div>
                                <p className="text-xs text-gray-400 mb-2">{vibeInfo.label}</p>
                                <p className="text-xs text-gray-500">
                                  {post.metadata?.capturedAt 
                                    ? `${formatDate(post.metadata.capturedAt)} ${formatCapturedTime(post.metadata.capturedAt)}`
                                    : getTimeAgo(post.timestamp)
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No posts yet</p>
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

        <BottomNav currentView={currentView} onNavClick={handleNavClick} />
      </div>
    )
  }

  return null
}

  // Post Detail View Component (전체 화면)
function PostDetailView({ post, onClose, formatCapturedTime, formatDate, getVibeInfo, postLikes, onToggleLike, user, onDeletePost }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(null)
  const [touchStartY, setTouchStartY] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [isSwiping, setIsSwiping] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  
  // Post 데이터 검증
  if (!post) {
    console.error('PostDetailView: post is null or undefined')
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Post not found</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }
  
  const allImages = post.images || (post.image ? [post.image] : [])
  const vibeInfo = getVibeInfo(post.vibe || 'quiet')
  
  // 사용자 프로필 정보 로드
  useEffect(() => {
    const loadUserProfile = async () => {
      if (post.userId || post.user) {
        const profile = await db.getUserProfile(post.userId || post.user)
        setUserProfile(profile)
      }
    }
    loadUserProfile()
  }, [post.userId, post.user])
  
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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={onClose}
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
            onClick={() => onDeletePost(post.id)}
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

// Post Vibe Modal Component
function PostVibeModal({
  places,
  vibeOptions,
  selectedPlace,
  selectedVibe,
  selectedDescription,
  mainImage,
  additionalImages,
  metadata,
  onPlaceChange,
  onVibeChange,
  onDescriptionChange,
  onMainImageSelect,
  onAdditionalImagesSelect,
  onRemoveAdditionalImage,
  onPost,
  onClose,
  formatCapturedTime,
  formatDate,
  isPosting = false,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const handlePlaceSelect = (place) => {
    onPlaceChange(place)
    setIsDropdownOpen(false)
  }

  const selectedPlaceLabel = selectedPlace || 'Select a place'

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

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
                  {selectedPlaceLabel}
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
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handlePlaceSelect('')}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                      !selectedPlace
                        ? 'bg-gray-700 text-[#ADFF2F]'
                        : 'text-white hover:bg-gray-700'
                    }`}
                  >
                    Select a place
                  </button>
                  {places.map((place) => (
                    <button
                      key={place}
                      type="button"
                      onClick={() => handlePlaceSelect(place)}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                        selectedPlace === place
                          ? 'bg-gray-700 text-[#ADFF2F]'
                          : 'text-white hover:bg-gray-700'
                      }`}
                    >
                      {place}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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
function BottomNav({ currentView, onNavClick }) {
  const navItems = [
    { id: 'feed', label: 'Feed', icon: '📱' },
    { id: 'map', label: 'Map', icon: '🗺️' },
    { id: 'quest', label: 'Quest', icon: '🎯' },
    { id: 'my', label: 'My', icon: '👤' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-gray-800 z-20">
      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-4 gap-1 px-2 py-3">
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
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Delete Confirm Modal Component
function DeleteConfirmModal({ onClose, onConfirm }) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      <div className="fixed left-4 right-4 bottom-4 md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl z-50 p-6 md:p-8">
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
