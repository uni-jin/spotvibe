/**
 * Admin authentication and API functions
 */

import { supabase } from './supabase'
import bcrypt from 'bcryptjs'
import * as jose from 'jose'

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
 * @returns {Promise<Array>}
 */
export const getCommonCodes = async (codeType = null) => {
  try {
    let query = supabase
      .from('common_codes')
      .select('*')
      .eq('is_active', true)
      .order('code_type')
      .order('display_order')

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
 * Get places (for admin) with recent post stats
 * @returns {Promise<Array>}
 */
export const getAdminPlaces = async () => {
  try {
    // Get all places
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

    // Get recent posts for each place
    const placeIds = places.map(p => p.id)
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, place_id, place_name, vibe, created_at, user_id')
      .in('place_id', placeIds)
      .order('created_at', { ascending: false })

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

    // Combine places with post stats
    return places.map(place => {
      const placePosts = postsByPlace[place.id] || []
      const latestPost = placePosts[0] || null
      
      return {
        ...place,
        recentVibe: latestPost?.vibe || null,
        recentPostTime: latestPost?.created_at || null,
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

    const placePayload = {
      name: placeData.name,
      name_en: placeData.name_en || null,
      type: placeData.type,
      thumbnail_url: placeData.thumbnail_url || null,
      description: placeData.description || null,
      lat: placeData.lat ? parseFloat(placeData.lat) : null,
      lng: placeData.lng ? parseFloat(placeData.lng) : null,
      is_active: placeData.is_active !== undefined ? placeData.is_active : true,
      updated_at: new Date().toISOString()
    }

    let result
    if (placeId) {
      // Update existing place
      const { data, error } = await supabase
        .from('places')
        .update(placePayload)
        .eq('id', placeId)
        .select()
        .single()

      if (error) {
        console.error('Error updating place:', error)
        return { success: false, error: error.message }
      }

      result = data
    } else {
      // Create new place
      const { data, error } = await supabase
        .from('places')
        .insert(placePayload)
        .select()
        .single()

      if (error) {
        console.error('Error creating place:', error)
        return { success: false, error: error.message }
      }

      result = data
    }

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

    const { error } = await supabase
      .from('places')
      .delete()
      .eq('id', placeId)

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
