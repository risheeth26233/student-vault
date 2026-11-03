import assert from "node:assert/strict";
import { test } from "node:test";
import { canStudentTransition, canTeacherTransition } from "./interventionState.js";

test("teacher approves only a proposed intervention and can cancel unfinished work", () => {
  assert.equal(canTeacherTransition("proposed", "approved"), true);
  assert.equal(canTeacherTransition("approved", "approved"), false);
  assert.equal(canTeacherTransition("approved", "cancelled"), true);
  assert.equal(canTeacherTransition("completed", "cancelled"), false);
});

test("student follows the approved to in-progress to completed lifecycle", () => {
  assert.equal(canStudentTransition("proposed", "in_progress"), false);
  assert.equal(canStudentTransition("approved", "in_progress"), true);
  assert.equal(canStudentTransition("approved", "completed"), false);
  assert.equal(canStudentTransition("in_progress", "completed"), true);
  assert.equal(canStudentTransition("completed", "in_progress"), false);
});
