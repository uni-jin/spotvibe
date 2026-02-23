/**
 * Admin authentication and API functions
 */

import { supabase } from './supabase'
import bcrypt from 'bcryptjs'
import * as jose from 'jose'
import { kstDateTimeToDbString } from './kstDateUtils.js'

// JWT Secret - In production, this should be stored securely
// For now, using a default secret (should be changed in production)
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'spotvibe-admin-secret-key-change-in-production-2024'
const secretKey = new TextEncoder().encode(JWT_SECRET)

/**
 * Admin login
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export const adminLogin = async (username, password) => {
  try {
    // Get admin account from database
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id, username, password_hash')
      .eq('username', username)
      .single()

    if (error || !data) {
      return { success: false, error: 'Invalid username or password' }
    }

    // Verify password
    const isValid = await bcrypt.compare(password, data.password_hash)
    if (!isValid) {
      return { success: false, error: 'Invalid username or password' }
    }

    // Update last login time
    await supabase
      .from('admin_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.id)

    // Generate JWT token using jose (browser-compatible)
    const token = await new jose.SignJWT({
      id: data.id,
      username: data.username,
      type: 'admin'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secretKey)

    return { success: true, token }
  } catch (error) {
    console.error('Admin login error:', error)
    return { success: false, error: 'Login failed. Please try again.' }
  }
}

/**
 * Verify admin token
 * @param {string} token - JWT token
 * @returns {Promise<{valid: boolean, admin?: {id: number, username: string}}>}
 */
export const verifyAdminToken = async (token) => {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey)
    
    if (payload.type !== 'admin') {
      return { valid: false }
    }

    // Verify admin still exists in database
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id, username')
      .eq('id', payload.id)
      .single()

    if (error || !data) {
      return { valid: false }
    }

    return { valid: true, admin: { id: data.id, username: data.username } }
  } catch (error) {
    return { valid: false }
  }
}

/**
 * Change admin password
 * @param {string} token - Admin JWT token
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const changeAdminPassword = async (token, currentPassword, newPassword) => {
  try {
    // Verify token
    const { valid, admin } = await verifyAdminToken(token)
    if (!valid || !admin) {
      return { success: false, error: 'Invalid session' }
    }

    // Get current password hash
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('password_hash')
      .eq('id', admin.id)
      .single()

    if (error || !data) {
      return { success: false, error: 'Failed to verify current password' }
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, data.password_hash)
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' }
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Update password
    const { error: updateError } = await supabase
      .from('admin_accounts')
      .update({ 
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', admin.id)

    if (updateError) {
      return { success: false, error: 'Failed to update password' }
    }

    return { success: true }
  } catch (error) {
    console.error('Change password error:', error)
    return { success: false, error: 'Failed to change password' }
  }
}

/**
 * Get common codes
 * @param {string} codeType - Code type (optional, if not provided returns all)
 * @param {boolean} includeInactive - Include inactive codes (default: false)
 * @returns {Promise<Array>}
 */
export const getCommonCodes = async (codeType = null, includeInactive = false) => {
  try {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      // Public access: only active codes
      includeInactive = false
    }

    let query = supabase
      .from('common_codes')
      .select('*')
      .order('code_type')
      .order('display_order')

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    if (codeType) {
      query = query.eq('code_type', codeType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching common codes:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching common codes:', error)
    return []
  }
}

/**
 * Create or update a common code
 * @param {Object} codeData - Common code data
 * @param {number|null} codeId - Code ID (null for create, number for update)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const saveCommonCode = async (codeData, codeId = null) => {
  try {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }

    const { valid } = await verifyAdminToken(token)
    if (!valid) {
      return { success: false, error: 'Invalid session' }
    }

    const { data, error } = await supabase.rpc('admin_save_common_code', {
      p_code_type: codeData.code_type,
      p_code_value: codeData.code_value,
      p_code_label: codeData.code_label,
      p_display_order: codeData.display_order ?? 0,
      p_is_active: codeData.is_active !== undefined ? codeData.is_active : true,
      p_id: codeId || null
    })

    if (error) {
      console.error('Error saving common code:', error)
      return { success: false, error: error.message }
    }
    // RPC returns array (SETOF); we expect one row for both insert and update
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data
    if (result == null && codeId != null) {
      return { success: false, error: '해당 코드를 찾을 수 없습니다.' }
    }
    if (result == null) {
      return { success: false, error: '저장에 실패했습니다.' }
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('Error saving common code:', error)
    return { success: false, error: error.message || 'Failed to save common code' }
  }
}

/**
 * Delete a common code
 * @param {number} codeId - Code ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteCommonCode = async (codeId) => {
  try {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }

    const { valid } = await verifyAdminToken(token)
    if (!valid) {
      return { success: false, error: 'Invalid session' }
    }

    const { error } = await supabase.rpc('admin_delete_common_code', { p_id: codeId })

    if (error) {
      console.error('Error deleting common code:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting common code:', error)
    return { success: false, error: error.message || 'Failed to delete common code' }
  }
}

/**
 * Get places (for admin) with recent post stats
 * @returns {Promise<Array>}
 */
export const getAdminPlaces = async () => {
  try {
    // Get all places (등록일 최신순)
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('*')
      .order('created_at', { ascending: false })

    if (placesError) {
      console.error('Error fetching places:', placesError)
      return []
    }

    if (!places || places.length === 0) {
      return []
    }

    const placeIds = places.map((p) => p.id)
    const { data: periodsRows } = await supabase
      .from('place_display_periods')
      .select('place_id, display_start_date, display_end_date, display_order')
      .in('place_id', placeIds)
      .order('display_order', { ascending: true })

    const periodsByPlace = {}
    if (periodsRows && periodsRows.length > 0) {
      periodsRows.forEach((row) => {
        if (!periodsByPlace[row.place_id]) periodsByPlace[row.place_id] = []
        periodsByPlace[row.place_id].push({
          display_start_date: row.display_start_date,
          display_end_date: row.display_end_date,
        })
      })
    }

    // Get recent posts for each place (metadata 포함: 촬영 일시 기준 정렬용)
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, place_id, place_name, vibe, created_at, metadata, user_id')
      .in('place_id', placeIds)

    if (postsError) {
      console.error('Error fetching posts:', postsError)
      // Return places without post stats if posts query fails
      return places.map(place => ({
        ...place,
        recentVibe: null,
        recentPostTime: null,
        postCount: 0
      }))
    }

    // 촬영 일시: metadata.capturedAt (ISO 문자열) 또는 created_at 폴백
    const getCapturedAt = (post) => {
      const captured = post.metadata?.capturedAt
      return captured ? new Date(captured).getTime() : new Date(post.created_at).getTime()
    }

    // Group posts by place_id
    const postsByPlace = {}
    posts.forEach(post => {
      if (post.place_id) {
        if (!postsByPlace[post.place_id]) {
          postsByPlace[post.place_id] = []
        }
        postsByPlace[post.place_id].push(post)
      }
    })

    // Get admin usernames for created_by (if exists)
    const adminIds = [...new Set(places.map(p => p.created_by).filter(Boolean))]
    let adminMap = {}
    if (adminIds.length > 0) {
      const { data: admins } = await supabase
        .from('admin_accounts')
        .select('id, username')
        .in('id', adminIds)
      
      if (admins) {
        adminMap = admins.reduce((acc, admin) => {
          acc[admin.id] = admin.username
          return acc
        }, {})
      }
    }

    // Combine places with post stats (최근 상태 = 촬영 일시 기준 최신 포스트의 Vibe / 촬영 일시 표시)
    return places.map(place => {
      const placePosts = postsByPlace[place.id] || []
      // 촬영 일시(metadata.capturedAt) 기준 내림차순 정렬 후 최신 1건 사용
      const sortedByCaptured = [...placePosts].sort((a, b) => getCapturedAt(b) - getCapturedAt(a))
      const latestPost = sortedByCaptured[0] || null
      const capturedAt = latestPost?.metadata?.capturedAt || latestPost?.created_at || null

      return {
        ...place,
        display_periods: periodsByPlace[place.id] || null,
        recentVibe: latestPost?.vibe || null,
        recentPostTime: capturedAt,
        postCount: placePosts.length,
        createdByUsername: place.created_by ? adminMap[place.created_by] : null
      }
    })
  } catch (error) {
    console.error('Error fetching places:', error)
    return []
  }
}

/**
 * Get custom place names (for admin)
 * @returns {Promise<Array>}
 */
export const getCustomPlaceNames = async () => {
  try {
    const { data, error } = await supabase
      .from('custom_place_names')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('last_used_at', { ascending: false })

    if (error) {
      console.error('Error fetching custom place names:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching custom place names:', error)
    return []
  }
}

/**
 * Promote custom place name to official place
 * @param {number} customPlaceId - Custom place name ID
 * @param {Object} placeData - Additional place data (name, type, lat, lng, description, thumbnail_url)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const promoteCustomPlace = async (customPlaceId, placeData) => {
  try {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }

    const { valid } = await verifyAdminToken(token)
    if (!valid) {
      return { success: false, error: 'Invalid session' }
    }

    // Get custom place name
    const { data: customPlace, error: customPlaceError } = await supabase
      .from('custom_place_names')
      .select('*')
      .eq('id', customPlaceId)
      .single()

    if (customPlaceError || !customPlace) {
      return { success: false, error: 'Custom place not found' }
    }

    const displayStartDate = kstDateTimeToDbString(placeData.display_start_date) || null
    const displayEndDate = kstDateTimeToDbString(placeData.display_end_date) || null
    const p_display_periods =
      displayStartDate != null || displayEndDate != null
        ? [{ start: displayStartDate, end: displayEndDate }]
        : []

    // Create official place using admin function
    const { data: newPlaceData, error: placeError } = await supabase.rpc('admin_save_place', {
      p_name: placeData.name || customPlace.place_name,
      p_type: placeData.type || customPlace.category_type || 'other',
      p_id: null,
      p_name_en: placeData.name_en || null,
      p_thumbnail_url: placeData.thumbnail_url || null,
      p_description: placeData.description || null,
      p_lat: placeData.lat ? parseFloat(placeData.lat) : null,
      p_lng: placeData.lng ? parseFloat(placeData.lng) : null,
      p_is_active: true,
      p_region_id: null,
      p_display_start_date: displayStartDate,
      p_display_end_date: displayEndDate,
      p_display_periods,
    })

    const newPlace = Array.isArray(newPlaceData) && newPlaceData.length > 0 ? newPlaceData[0] : newPlaceData

    if (placeError) {
      console.error('Error creating place:', placeError)
      return { success: false, error: placeError.message }
    }

    // Update posts that use this custom place name to reference the new official place
    const { error: updatePostsError } = await supabase
      .from('posts')
      .update({ place_id: newPlace.id })
      .eq('place_name', customPlace.place_name)
      .is('place_id', null)

    if (updatePostsError) {
      console.warn('Warning: Failed to update posts:', updatePostsError)
      // Continue even if post update fails
    }

    // Delete custom place name (or mark as promoted)
    const { error: deleteError } = await supabase
      .from('custom_place_names')
      .delete()
      .eq('id', customPlaceId)

    if (deleteError) {
      console.error('Error deleting custom place name:', deleteError)
      // Place was created, but custom place name deletion failed
      // This is not critical, but should be logged
    }

    return { success: true, data: newPlace }
  } catch (error) {
    console.error('Error promoting custom place:', error)
    return { success: false, error: error.message || 'Failed to promote custom place' }
  }
}

/**
 * Create or update a place
 * @param {Object} placeData - Place data
 * @param {number|null} placeId - Place ID (null for create, number for update)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const savePlace = async (placeData, placeId = null) => {
  try {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }

    const { valid } = await verifyAdminToken(token)
    if (!valid) {
      return { success: false, error: 'Invalid session' }
    }

    // 복수 노출기간: display_periods 우선, 없으면 단일 display_start_date/display_end_date
    let p_display_periods = []
    if (Array.isArray(placeData.display_periods) && placeData.display_periods.length > 0) {
      p_display_periods = placeData.display_periods
        .map((p) => ({
          start: kstDateTimeToDbString(p.start) || null,
          end: kstDateTimeToDbString(p.end) || null,
        }))
        .filter((p) => p.start != null || p.end != null)
    }
    const displayStartDate = p_display_periods.length > 0
      ? p_display_periods[0].start
      : (kstDateTimeToDbString(placeData.display_start_date) || null)
    const displayEndDate = p_display_periods.length > 0
      ? p_display_periods[0].end
      : (kstDateTimeToDbString(placeData.display_end_date) || null)

    let p_hashtags = null
    if (placeData.hashtags) {
      if (Array.isArray(placeData.hashtags)) {
        p_hashtags = placeData.hashtags.length > 0 ? placeData.hashtags : null
      } else if (typeof placeData.hashtags === 'string') {
        const tags = placeData.hashtags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        p_hashtags = tags.length > 0 ? tags : null
      }
    }

    const { data, error } = await supabase.rpc('admin_save_place', {
      p_name: placeData.name,
      p_type: placeData.type,
      p_id: placeId,
      p_name_en: placeData.name_en || null,
      p_thumbnail_url: placeData.thumbnail_url || null,
      p_description: placeData.description || null,
      p_lat: placeData.lat ? parseFloat(placeData.lat) : null,
      p_lng: placeData.lng ? parseFloat(placeData.lng) : null,
      p_is_active: placeData.is_active !== undefined ? placeData.is_active : true,
      p_region_id: placeData.region_id || null,
      p_display_start_date: displayStartDate,
      p_display_end_date: displayEndDate,
      p_display_periods: p_display_periods,
      p_info_url: placeData.info_url || null,
      p_phone: placeData.phone || null,
      p_hashtags,
    })

    if (error) {
      console.error('Error saving place:', error)
      return { success: false, error: error.message }
    }

    const result = Array.isArray(data) && data.length > 0 ? data[0] : data
    return { success: true, data: result }
  } catch (error) {
    console.error('Error saving place:', error)
    return { success: false, error: error.message || 'Failed to save place' }
  }
}

/**
 * Delete a place
 * @param {number} placeId - Place ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deletePlace = async (placeId) => {
  try {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      return { success: false, error: 'Not authenticated' }
    }

    const { valid } = await verifyAdminToken(token)
    if (!valid) {
      return { success: false, error: 'Invalid session' }
    }

    // Use SECURITY DEFINER function to bypass RLS
    const { data, error } = await supabase.rpc('admin_delete_place', {
      p_id: placeId
    })

    if (error) {
      console.error('Error deleting place:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting place:', error)
    return { success: false, error: error.message || 'Failed to delete place' }
  }
}
