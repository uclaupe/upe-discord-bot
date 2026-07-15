import mongoose from "mongoose";

import type { WeeklyScheduleState } from "../abc/weekly-scheduler.abc";
import type { UserId } from "../types/branded.types";

export type DonutState = WeeklyScheduleState & {
  users: UserId[];
  history: UserId[][][];
};

const donutStateSchema = new mongoose.Schema<DonutState>({
  guildId: { type: String, required: true, unique: true },
  users: { type: [String], default: [] },
  nextChatIsoTime: { type: String, default: null },
  history: { type: mongoose.Schema.Types.Mixed, default: [] },
  paused: { type: Boolean, default: false },
});

export const DonutStateModel = mongoose.model(
  "DonutState",
  donutStateSchema,
);
