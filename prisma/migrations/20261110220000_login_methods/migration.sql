-- AlterTable
ALTER TABLE "access_settings" ADD COLUMN     "emailCodeLogin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordLogin" BOOLEAN NOT NULL DEFAULT false;

