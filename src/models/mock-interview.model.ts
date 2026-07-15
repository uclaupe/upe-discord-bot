import mongoose from "mongoose";

import type { WeeklyScheduleState } from "../abc/weekly-scheduler.abc";

/**
 * Scheduler state for weekly mock interview pairings. Participants are not
 * stored here: membership is derived on demand from the mock interviewer and
 * interviewee roles, so this only tracks the cadence.
 */
export type MockInterviewState = WeeklyScheduleState;

const mockInterviewStateSchema = new mongoose.Schema<MockInterviewState>({
  guildId: { type: String, required: true, unique: true },
  nextChatIsoTime: { type: String, default: null },
  paused: { type: Boolean, default: false },
});

export const MockInterviewStateModel = mongoose.model(
  "MockInterviewState",
  mockInterviewStateSchema,
);
