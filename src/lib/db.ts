import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import path from 'path'

const TENANT_SCOPED_MODELS = new Set([
  'Branch',
  'User',
  'ClinicSettings',
  'AuditLog',
  'Patient',
  'Appointment',
  'OpdQueue',
  'VitalSign',
  'Prescription',
  'LabOrder',
  'BedCategory',
  'Bed',
  'IpdAdmission',
  'BedTransfer',
  'IpdRoundNote',
  'IpdMedicationOrder',
  'IpdChargeItem',
  'PatientDeposit',
  'Invoice',
  'Payment',
  'DoctorMedicineDefault',
])

const WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
])

function hasOrgFilter(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false
  const w = where as Record<string, unknown>
  if ('organizationId' in w) return true
  if (Array.isArray(w.AND)) return w.AND.some(hasOrgFilter)
  if (Array.isArray(w.OR)) return w.OR.every(hasOrgFilter)
  return false
}

function createBaseClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL || 'file:./hmsaas.db'
  if (rawUrl.startsWith('file:')) {
    const rel = rawUrl.replace(/^file:/, '')
    const resolved = path.isAbsolute(rel)
      ? rel
      : path.resolve(process.cwd(), 'prisma', rel.replace(/^\.\//, ''))
    const adapter = new PrismaLibSQL({ url: `file:${resolved}` })
    return new PrismaClient({ adapter: adapter as unknown as ConstructorParameters<typeof PrismaClient>[0] extends { adapter?: infer A } ? A : never })
  }
  return new PrismaClient()
}

const globalForPrisma = globalThis as unknown as {
  prismaBase?: PrismaClient
}

export const dbUnscoped: PrismaClient =
  globalForPrisma.prismaBase ?? createBaseClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = dbUnscoped
}

const tenantGuardExtension = Prisma.defineExtension({
  name: 'hms-tenant-guard',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (model && TENANT_SCOPED_MODELS.has(model)) {
          if (WHERE_OPS.has(operation)) {
            const where = (args as { where?: unknown })?.where
            if (!hasOrgFilter(where)) {
              throw new Error(
                `[TenantIsolationGuard] ${model}.${operation} requires organizationId in where clause.`
              )
            }
          }
        }
        return query(args)
      },
    },
  },
})

export const db = dbUnscoped.$extends(tenantGuardExtension)
