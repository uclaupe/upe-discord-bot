import mongoose from "mongoose";

import type { ChannelId, UnixSeconds, UserId } from "../types/branded.types";

export type KeyPickupReminder = {
  userId: UserId;
  channelId: ChannelId;
  eventTime: UnixSeconds;
  reminderTime: UnixSeconds;
};

const keyPickupReminderSchema = new mongoose.Schema<KeyPickupReminder>({
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  eventTime: { type: Number, required: true },
  reminderTime: { type: Number, required: true },
});

export const KeyPickupReminderModel = mongoose.model(
  "KeyPickupReminder",
  keyPickupReminderSchema,
);
