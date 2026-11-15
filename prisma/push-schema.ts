import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'prisma/hmsaas.db')
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma')

const SCALAR_TYPES = new Set(['String', 'Int', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'BigInt'])

function mapSqlType(prismaType: string): string {
  switch (prismaType) {
    case 'Int':
    case 'BigInt':
    case 'Boolean':
      return 'INTEGER'
    case 'Float':
    case 'Decimal':
      return 'REAL'
    case 'DateTime':
      return 'DATETIME'
    default:
      return 'TEXT'
  }
}

function parseDefault(attrs: string, prismaType: string): string {
  const m = attrs.match(/@default\(([^)]*(?:\([^)]*\)[^)]*)*)\)/)
  if (!m) return ''
  const raw = m[1].trim()
  if (raw === 'now()') return ' DEFAULT CURRENT_TIMESTAMP'
  if (raw === 'cuid()' || raw === 'uuid()' || raw === 'autoincrement()') return ''
  if (prismaType === 'Boolean') {
    return raw === 'true' ? ' DEFAULT 1' : ' DEFAULT 0'
  }
  if (prismaType === 'Int' || prismaType === 'Float' || prismaType === 'Decimal') {
    return ` DEFAULT ${raw}`
  }
  if (raw.startsWith('"') && raw.endsWith('"')) {
    const inner = raw.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "''")
    return ` DEFAULT '${inner}'`
  }
  return ''
}

async function main() {
  const client = createClient({ url: `file:${dbPath}` })
  await client.execute('PRAGMA journal_mode = WAL;')
  await client.execute('PRAGMA synchronous = NORMAL;')
  await client.execute('PRAGMA foreign_keys = ON;')

  const rawSchema = fs.readFileSync(schemaPath, 'utf8')
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g

  let count = 0
  let match: RegExpExecArray | null
  while ((match = modelRegex.exec(rawSchema)) !== null) {
    count++
    const modelName = match[1]
    const body = match[2]
    const lines = body
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter(Boolean)

    const colDefs: string[] = []
    const fkDefs: string[] = []
    const singleUniques: string[] = []
    const compoundUniques: string[][] = []
    const indexes: string[][] = []

    for (const line of lines) {
      if (line.startsWith('@@unique')) {
        const um = line.match(/@@unique\(\[([^\]]+)\]\)/)
        if (um) compoundUniques.push(um[1].split(',').map((s) => s.trim()))
        continue
      }
      if (line.startsWith('@@index')) {
        const im = line.match(/@@index\(\[([^\]]+)\]\)/)
        if (im) indexes.push(im[1].split(',').map((s) => s.trim()))
        continue
      }
      if (line.startsWith('@@')) continue

      const parts = line.match(/^(\w+)\s+(\w+)(\?|\[\])?(.*)$/)
      if (!parts) continue
      const [, fieldName, rawType, modifier, restAttrs] = parts

      if (modifier === '[]') continue // array relation

      if (!SCALAR_TYPES.has(rawType)) {
        // Object relation — check if it carries @relation(fields: [...], references: [...])
        const relMatch = restAttrs.match(
          /@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\](?:[^)]*onDelete:\s*(\w+))?/
        )
        if (relMatch) {
          const fromCol = relMatch[1].trim()
          const refCol = relMatch[2].trim()
          const onDelRaw = relMatch[3]?.trim()
          const onDelete =
            onDelRaw === 'Cascade'
              ? 'CASCADE'
              : onDelRaw === 'SetNull'
              ? 'SET NULL'
              : 'RESTRICT'
          fkDefs.push(
            `FOREIGN KEY ("${fromCol}") REFERENCES "${rawType}" ("${refCol}") ON DELETE ${onDelete} ON UPDATE CASCADE`
          )
        }
        continue
      }

      const isOptional = modifier === '?'
      const isId = /@id\b/.test(restAttrs)
      const isUnique = /@unique\b/.test(restAttrs)
      const sqlType = mapSqlType(rawType)
      const pk = isId ? ' PRIMARY KEY NOT NULL' : isOptional ? '' : ' NOT NULL'
      const dflt = parseDefault(restAttrs, rawType)

      colDefs.push(`"${fieldName}" ${sqlType}${pk}${dflt}`)
      if (isUnique && !isId) {
        singleUniques.push(fieldName)
      }
    }

    const allDefs = [...colDefs, ...fkDefs]
    await client.execute(`CREATE TABLE IF NOT EXISTS "${modelName}" (\n  ${allDefs.join(',\n  ')}\n);`)

    // CREATE TABLE IF NOT EXISTS does not add columns to existing databases.
    if (modelName === 'ClinicSettings') {
      const columns = await client.execute('PRAGMA table_info("ClinicSettings")')
      if (!columns.rows.some((row) => row.name === 'moduleVisibility')) {
        await client.execute('ALTER TABLE "ClinicSettings" ADD COLUMN "moduleVisibility" TEXT')
      }
    }

    for (const col of singleUniques) {
      await client.execute(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${modelName}_${col}_key" ON "${modelName}"("${col}");`
      )
    }
    for (const cols of compoundUniques) {
      await client.execute(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${modelName}_${cols.join('_')}_key" ON "${modelName}"(${cols.map((c) => `"${c}"`).join(', ')});`
      )
    }
    for (const cols of indexes) {
      await client.execute(
        `CREATE INDEX IF NOT EXISTS "${modelName}_${cols.join('_')}_idx" ON "${modelName}"(${cols.map((c) => `"${c}"`).join(', ')});`
      )
    }
  }

  console.log(`[Prisma Schema Sync] Synced ${count} models + unique constraints + indexes cleanly (WAL mode).`)
  client.close()
}

main().catch((err) => {
  console.error('[Prisma Schema Sync] Failed:', err)
  process.exit(1)
})
