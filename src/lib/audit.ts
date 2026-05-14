import { db } from '@/lib/db'

export async function createAuditLog({
  performedBy,
  performerName,
  performerRole,
  actionType,
  module,
  recordId,
  oldValue,
  newValue,
  remarks,
}: {
  performedBy?: string
  performerName?: string
  performerRole?: string
  actionType: string
  module: string
  recordId?: string
  oldValue?: unknown
  newValue?: unknown
  remarks?: string
}) {
  return db.auditLog.create({
    data: {
      performedBy,
      performerName,
      performerRole,
      actionType,
      module,
      recordId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      remarks,
    },
  })
}
