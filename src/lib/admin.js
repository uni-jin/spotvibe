/**
 * Admin authentication and API functions
 */

import { supabase } from './supabase'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// JWT Secret - In production, this should be stored securely
// For now, using a default secret (should be changed in production)
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'spotvibe-admin-secret-key-change-in-production-2024'

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

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: data.id, 
        username: data.username,
        type: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

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
    const decoded = jwt.verify(token, JWT_SECRET)
    
    if (decoded.type !== 'admin') {
      return { valid: false }
    }

    // Verify admin still exists in database
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id, username')
      .eq('id', decoded.id)
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
 * Get places (for admin)
 * @returns {Promise<Array>}
 */
export const getAdminPlaces = async () => {
  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching places:', error)
      return []
    }

    return data || []
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
