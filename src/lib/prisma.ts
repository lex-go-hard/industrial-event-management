import { PrismaClient } from "@prisma/client";
import { decryptString, encryptString } from "@/lib/crypto";

const globalForPrisma = globalThis as unknown as {
  prismaBase?: PrismaClient;
  auditPrisma?: PrismaClient;
  prisma?: PrismaClient;
};

const prismaBase =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Separate client for audit writes (avoid recursion via extensions).
const auditPrisma =
  globalForPrisma.auditPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });

type AuditContext = { actorUserId?: string };

type EncryptSpec = Record<string, string[]>;
const ENCRYPT_AT_REST: EncryptSpec = {
  User: ["firstName", "lastName", "middleName", "dateOfBirth"],
  RosterEntry: ["firstName", "lastName", "middleName", "dateOfBirth"],
};

function shouldEncrypt(model?: string, field?: string) {
  if (!model || !field) return false;
  return ENCRYPT_AT_REST[model]?.includes(field) ?? false;
}

function transformObject(
  model: string | undefined,
  obj: unknown,
  mode: "encrypt" | "decrypt",
): unknown {
  if (!model || obj == null) return obj;
  if (Array.isArray(obj)) return obj.map((v) => transformObject(model, v, mode));
  if (typeof obj !== "object") return obj;

  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  for (const [k, v] of Object.entries(out)) {
    if (shouldEncrypt(model, k) && typeof v === "string") {
      out[k] = mode === "encrypt" ? encryptString(v) : decryptString(v);
    }
  }
  return out;
}

function extractAuditContext(args: unknown): { ctx?: AuditContext; cleanArgs: unknown } {
  if (!args || typeof args !== "object") return { cleanArgs: args };
  const a = args as Record<string, unknown>;
  const ctx = a.__audit as AuditContext | undefined;
  if (!ctx) return { cleanArgs: args };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __audit, ...rest } = a;
  return { ctx, cleanArgs: rest };
}

function inferRecordId(operation: string, result: unknown, args: unknown): string | undefined {
  if (operation === "create" || operation === "upsert") {
    const id = (result as { id?: unknown } | null)?.id;
    return typeof id === "string" ? id : undefined;
  }
  if (operation === "update" || operation === "delete") {
    const whereId = (args as { where?: { id?: unknown } } | null)?.where?.id;
    if (typeof whereId === "string") return whereId;
    const id = (result as { id?: unknown } | null)?.id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

export const prisma =
  globalForPrisma.prisma ??
  (prismaBase.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const extracted = extractAuditContext(args);
          args = extracted.cleanArgs as typeof args;

          // Encrypt writes (selected models/fields only)
          if (
            model &&
            ["create", "createMany", "update", "updateMany", "upsert"].includes(
              operation,
            )
          ) {
            if ("data" in (args as object)) {
              const a = args as { data?: unknown };
              a.data = transformObject(model, a.data, "encrypt");
            }
          }

          const result = await query(args);

          // Decrypt reads
          if (
            model &&
            [
              "findUnique",
              "findUniqueOrThrow",
              "findFirst",
              "findFirstOrThrow",
              "findMany",
            ].includes(operation)
          ) {
            return transformObject(model, result, "decrypt");
          }

          // Audit writes (skip AuditLog itself)
          const writeOps = new Set([
            "create",
            "update",
            "upsert",
            "delete",
            "createMany",
            "updateMany",
            "deleteMany",
          ]);

          if (model && model !== "AuditLog" && writeOps.has(operation)) {
            const recordId = inferRecordId(operation, result, args);
            try {
              await auditPrisma.auditLog.create({
                data: {
                  actorUserId: extracted.ctx?.actorUserId,
                  action: operation,
                  table: model,
                  recordId,
                },
              });
            } catch (e) {
              if (process.env.NODE_ENV === "development") {
                // eslint-disable-next-line no-console
                console.warn("AuditLog write failed", e);
              }
            }
          }

          return result;
        },
      },
    },
  }) as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = prismaBase;
  globalForPrisma.auditPrisma = auditPrisma;
  globalForPrisma.prisma = prisma;
}

