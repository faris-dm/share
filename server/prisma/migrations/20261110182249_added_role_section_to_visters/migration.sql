-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Admin', 'Teacher', 'Student');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'Student';
 git