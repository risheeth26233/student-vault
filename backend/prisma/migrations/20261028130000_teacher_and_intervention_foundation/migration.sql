-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'teacher');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('pending', 'active', 'declined');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('proposed', 'approved', 'in_progress', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(40),
    "joinCode" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_enrollments" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classroom_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "topicId" TEXT,
    "need" VARCHAR(1000) NOT NULL,
    "action" VARCHAR(1000) NOT NULL,
    "status" "InterventionStatus" NOT NULL DEFAULT 'proposed',
    "evidenceSummary" VARCHAR(2000),
    "outcomeNote" VARCHAR(2000),
    "teacherFeedback" VARCHAR(2000),
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "baselineScore" INTEGER,
    "baselineMaxScore" INTEGER,
    "followUpScore" INTEGER,
    "followUpMaxScore" INTEGER,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_events" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "InterventionStatus",
    "toStatus" "InterventionStatus" NOT NULL,
    "note" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intervention_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_joinCode_key" ON "classrooms"("joinCode");

-- CreateIndex
CREATE INDEX "classrooms_teacherId_idx" ON "classrooms"("teacherId");

-- CreateIndex
CREATE INDEX "classroom_enrollments_studentId_status_idx" ON "classroom_enrollments"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_enrollments_classroomId_studentId_key" ON "classroom_enrollments"("classroomId", "studentId");

-- CreateIndex
CREATE INDEX "interventions_classroomId_studentId_status_idx" ON "interventions"("classroomId", "studentId", "status");

-- CreateIndex
CREATE INDEX "interventions_authorId_idx" ON "interventions"("authorId");

-- CreateIndex
CREATE INDEX "intervention_events_interventionId_createdAt_idx" ON "intervention_events"("interventionId", "createdAt");

-- CreateIndex
CREATE INDEX "intervention_events_actorId_idx" ON "intervention_events"("actorId");

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_enrollments" ADD CONSTRAINT "classroom_enrollments_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_enrollments" ADD CONSTRAINT "classroom_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_events" ADD CONSTRAINT "intervention_events_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intervention_events" ADD CONSTRAINT "intervention_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
