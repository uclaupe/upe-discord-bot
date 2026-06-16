import {
  Channel,
  ChannelType,
  time,
  TimestampStyles,
  userMention,
  type GuildTextBasedChannel,
} from "discord.js";

import { KeyPickupReminderModel } from "../models/key-pickup-reminder.model";
import type { ChannelId, UnixSeconds, UserId } from "../types/branded.types";
import channelsService from "./channels.service";

const MAX_TIMEOUT_MS = 2_147_483_647;

function isGuildTextChannel(channel: Channel): channel is GuildTextBasedChannel {
  return channel.type === ChannelType.GuildText;
}

class KeyPickupReminderService {
  private timers = new Map<string, NodeJS.Timeout>();

  public async initialize(): Promise<void> {
    const pending = await KeyPickupReminderModel.find();
    for (const reminder of pending) {
      this.scheduleTimeout(reminder._id.toString(), reminder.reminderTime);
    }
    console.log(
      `[INIT] Loaded ${pending.length} pending key pickup reminder(s).`,
    );
  }

  public async create(
    userId: UserId,
    channelId: ChannelId,
    eventTime: UnixSeconds,
    reminderTime: UnixSeconds,
  ): Promise<void> {
    const reminder = await KeyPickupReminderModel.create({
      userId,
      channelId,
      eventTime,
      reminderTime,
    });
    this.scheduleTimeout(reminder._id.toString(), reminderTime);
  }

  private scheduleTimeout(docId: string, reminderTime: UnixSeconds): void {
    const delayMs = Math.max(0, reminderTime * 1000 - Date.now());

    if (delayMs > MAX_TIMEOUT_MS) {
      const timer = setTimeout(() => {
        this.scheduleTimeout(docId, reminderTime);
      }, MAX_TIMEOUT_MS);
      this.timers.set(docId, timer);
      return;
    }

    const timer = setTimeout(() => this.fire(docId), delayMs);
    this.timers.set(docId, timer);
  }

  private async fire(docId: string): Promise<void> {
    this.timers.delete(docId);

    const reminder = await KeyPickupReminderModel.findByIdAndDelete(docId);
    if (!reminder) {
      return;
    }

    try {
      const guild = channelsService.getUpe();
      const channel = await guild.channels.fetch(reminder.channelId);
      if (channel === null || !isGuildTextChannel(channel)) {
        console.error(`[REMINDER] ${docId} has invalid channel ID ${reminder.channelId}`);
        return; // This error is more specific than the catch, so we return early
      } else {
        const eventTimestamp = time(
          reminder.eventTime,
          TimestampStyles.ShortDateTime,
        );
        await channel.send(
          `${userMention(reminder.userId)}, remember to pick up the key ` +
          `for the event at ${eventTimestamp}!`,
        );
      }
    }
    catch (error) {
      console.error(`[REMINDER] Failed to send key pickup reminder: ${error}`);
    }
  }
}

export default new KeyPickupReminderService();
