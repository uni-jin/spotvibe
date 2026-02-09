/**
 * Geolocation utility functions for calculating distances and getting user location
 */

/**
 * Get user's current location using Geolocation API
 * @returns {Promise<{lat: number, lng: number} | null>} User location or null if unavailable
 */
export const getUserLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by this browser')
      resolve(null)
      return
    }

    const options = {
      enableHighAccuracy: false, // 배터리 절약을 위해 false
      timeout: 10000, // 10초 타임아웃
      maximumAge: 300000, // 5분 캐싱
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        console.log('User location obtained:', location)
        resolve(location)
      },
      (error) => {
        // 에러를 조용히 처리 (사용자에게 강제하지 않음)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            console.log('User denied the request for Geolocation')
            break
          case error.POSITION_UNAVAILABLE:
            console.log('Location information is unavailable')
            break
          case error.TIMEOUT:
            console.log('The request to get user location timed out')
            break
          default:
            console.log('An unknown error occurred while getting location')
            break
        }
        resolve(null)
      },
      options
    )
  })
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
const toRad = (degrees) => {
  return (degrees * Math.PI) / 180
}

/**
 * Format distance for display
 * @param {number} distance - Distance in kilometers
 * @returns {string} Formatted distance string (e.g., "500m away" or "1.2km away")
 */
export const formatDistance = (distance) => {
  if (distance < 1) {
    // 1km 미만: 미터 단위로 표시 (소수점 없이)
    const meters = Math.round(distance * 1000)
    return `${meters}m away`
  } else {
    // 1km 이상: 킬로미터 단위로 표시 (소수점 1자리)
    return `${distance.toFixed(1)}km away`
  }
}
