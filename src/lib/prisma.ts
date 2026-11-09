import { PrismaClient } from "@prisma/client";
import { accountTokenEncryptionExtension } from "@/lib/accountTokenEncryption";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ["error", "warn"],
  }).$extends(accountTokenEncryptionExtension);
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type ClienteTransacao = Omit<PrismaClientSingleton, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
