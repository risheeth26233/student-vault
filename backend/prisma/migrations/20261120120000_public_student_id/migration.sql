ALTER TABLE "users" ADD COLUMN "publicId" TEXT;

CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");
