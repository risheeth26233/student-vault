import type { InterventionStatus } from "@prisma/client";

export function canTeacherTransition(current: InterventionStatus, next: "approved" | "cancelled"): boolean {
  if (next === "approved") return current === "proposed";
  return current !== "completed" && current !== "cancelled";
}

export function canStudentTransition(current: InterventionStatus, next: "in_progress" | "completed"): boolean {
  return (next === "in_progress" && current === "approved") || (next === "completed" && current === "in_progress");
}
