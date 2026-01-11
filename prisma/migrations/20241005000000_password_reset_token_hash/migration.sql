ALTER TABLE "PasswordResetToken" RENAME COLUMN "token" TO "tokenHash";

DROP INDEX "PasswordResetToken_token_key";
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
