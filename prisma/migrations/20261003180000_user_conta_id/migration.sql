ALTER TABLE "User" ADD COLUMN "contaId" TEXT;

CREATE INDEX "User_contaId_idx" ON "User"("contaId");

ALTER TABLE "User" ADD CONSTRAINT "User_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "User" u
SET "contaId" = i."invitedById"
FROM "invitations" i
WHERE i."email" = u."email"
  AND i."status" = 'ACCEPTED'
  AND u."contaId" IS NULL
  AND i."invitedById" <> u."id";
