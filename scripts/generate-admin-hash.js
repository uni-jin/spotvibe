// Script to generate bcrypt hash for admin password
// Usage: node scripts/generate-admin-hash.js

import bcrypt from 'bcryptjs'

const password = 'wlsdn123'
const hash = await bcrypt.hash(password, 10)
console.log('Password:', password)
console.log('Hash:', hash)
console.log('\nCopy this hash to the migration file:')
console.log(hash)
