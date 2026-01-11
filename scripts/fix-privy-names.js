import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import 'dotenv/config'

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    let key = trimmed.slice(0, eq)
    let val = trimmed.slice(eq + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function getInitialsFromEmail(email) {
  if (!email || typeof email !== 'string') return null
  const local = email.split('@')[0] || ''
  const parts = local.split(/[^a-z0-9]+/i).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return null
}

(async function main() {
  try {
    const repoRoot = path.resolve(new URL(import.meta.url).pathname, '..', '..')
    const env = readEnvFile(path.resolve(repoRoot, '.env'))
    const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL

    if (!databaseUrl) {
      console.error('DATABASE_URL not found in environment or .env')
      process.exit(2)
    }

    const pool = new Pool({ connectionString: databaseUrl })
    const client = await pool.connect()
    try {
      // Find users with first_name like 'Privy' or null/empty first_name
      const selectSql = `select id, email, first_name from users where lower(first_name) like 'privy%' or first_name is null or trim(first_name) = ''`;
      const res = await client.query(selectSql)
      console.log(`Found ${res.rows.length} users to update`)

      for (const row of res.rows) {
        const { id, email, first_name } = row
        const initials = getInitialsFromEmail(email) || 'U'
        const updateSql = `update users set first_name = $1, updated_at = now() where id = $2 returning id, first_name`;
        const upd = await client.query(updateSql, [initials, id])
        console.log('Updated user:', upd.rows[0])
      }
    } finally {
      client.release()
      await pool.end()
    }
  } catch (err) {
    console.error('Error updating privy names:', err)
    process.exit(1)
  }
})()
