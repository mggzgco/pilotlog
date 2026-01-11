import { prisma } from "@/app/lib/db";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordAuditEvent(input: AuditInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? (input.metadata as any) : undefined
      }
    });
  } catch (error) {
    console.warn("Failed to record audit event", error);
  }
}
