import postgres from 'postgres'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { callerHasPermission } from '@/lib/serverAuth'

// Fallback: run simple ALTER TABLE via Supabase REST API (limited)
async function runViaServiceRole(statements) {
  const results = []
  // We can only do this via direct postgres connection
  // Return error if no DB URL
  return { ok: false, error: 'Need SUPABASE_DB_URL' }
}

export async function POST() {
  const auth = await callerHasPermission('manage_database')
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  // Try direct postgres connection first
  const dbUrl = process.env.SUPABASE_DB_URL
  if (dbUrl && !dbUrl.includes('[DB-PASSWORD]')) {
    let sql
    try {
      sql = postgres(dbUrl, { ssl: 'require', max: 1 })
      const schemaPath = join(process.cwd(), 'supabase', 'schema.sql')
      const schemaSql = readFileSync(schemaPath, 'utf-8')

      const statements = schemaSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      const results = []
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt)
          results.push({ ok: true, stmt: stmt.slice(0, 60) })
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('does not exist')) {
            results.push({ ok: true, skipped: true, stmt: stmt.slice(0, 60) })
          } else {
            results.push({ ok: false, error: err.message, stmt: stmt.slice(0, 60) })
          }
        }
      }

      await sql.end()
      const failed = results.filter(r => !r.ok)
      return Response.json({ success: true, total: results.length, failed: failed.length, errors: failed })
    } catch (err) {
      try { sql && await sql.end() } catch (_) {}
      // Fall through to alternative method
    }
  }

  // Alternative: run critical migrations via Supabase JS (limited to what's possible via API)
  // These specific ALTER TABLE commands can be done via a workaround
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return Response.json({ error: 'Missing Supabase credentials' }, { status: 500 })

  // Use postgres package with the correct connection string format
  // The project ref is extracted from the URL
  const projectRef = url.match(/https:\/\/([^.]+)/)?.[1]
  if (!projectRef) return Response.json({ error: 'Cannot determine project ref' }, { status: 500 })

  return Response.json({
    error: 'SUPABASE_DB_URL password is incorrect. Please update it in .env.local',
    hint: 'Go to Supabase → Settings → Database → Reset Database Password → copy new password → update SUPABASE_DB_URL in .env.local',
    projectRef,
    template: 'postgresql://postgres.' + projectRef + ':[NEW-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
    quickFix: {
      message: 'Or run these 3 lines in Supabase SQL Editor:',
      sql: [
        "alter table clients add column if not exists client_code text;",
        "alter table clients add column if not exists representative text;",
        "alter table clients add column if not exists other_debt numeric default 0;"
      ]
    }
  }, { status: 500 })
}
