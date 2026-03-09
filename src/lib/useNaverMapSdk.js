import { useEffect, useState } from 'react'

let sdkLoadPromise = null

function loadNaverMapSdk() {
  if (window.naver?.maps) {
    return Promise.resolve(true)
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise
  }

  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
  if (!clientId) {
    console.warn('VITE_NAVER_MAP_CLIENT_ID is not set. Naver Maps SDK will not load.')
    return Promise.resolve(false)
  }

  sdkLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.warn('Naver Maps SDK failed to load.')
      sdkLoadPromise = null
      resolve(false)
    }
    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

/**
 * Naver Maps SDK를 비동기 로드하고, 로드 완료 시 true를 반환합니다.
 * 반환값을 지도 생성 useEffect 의존 배열에 넣어, SDK 준비 후에만 지도를 생성하세요.
 */
export function useNaverMapSdk() {
  const [isReady, setIsReady] = useState(() => !!window.naver?.maps)

  useEffect(() => {
    let isMounted = true

    loadNaverMapSdk().then((ready) => {
      if (isMounted && ready) {
        setIsReady(true)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  return isReady
}

