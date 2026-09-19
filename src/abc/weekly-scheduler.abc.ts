import type { Client } from "discord.js";
import { DateTime } from "luxon";
import type { Model } from "mongoose";

import channelsService from "../services/channels.service";
import type { GuildId, Milliseconds } from "../types/branded.types";
import { UCLA_TIMEZONE, type IDateClient } from "../utils/date.utils";
import { UPE_GUILD_ID } from "../utils/snowflakes.utils";
import {
  matchesSchedule,
  nextScheduledOccurrence,
} from "../utils/weekly-schedule.utils";

const POLL_INTERVAL_MSEC = (60 * 1000) as Milliseconds;

/**
 * The scheduler state every weekly-cadence service needs to persist. Concrete
 * services may extend this with their own domain fields.
 */
export type WeeklyScheduleState = {
  guildId: GuildId;
  nextChatIsoTime: string | null;
  paused: boolean;
};

/**
 * Base class for services that fire once a week on the shared schedule anchor
 * (see `weekly-schedule.utils`). Handles persistence of the next firing time,
 * the rolling poll loop, catch-up after downtime, and pausing. Subclasses
 * supply their Mongoose model and implement `runScheduledEvent`.
 */
export abstract class WeeklyScheduledService<
  State extends WeeklyScheduleState,
> {
  /** Mongoose model persisting this service's scheduler state. */
  protected abstract readonly model: Model<State>;
  /** Tag prefixed to this service's console output, e.g. `[DONUT]`. */
  protected abstract readonly logPrefix: string;

  private bot: Client | null = null;

  public constructor(protected readonly dates: IDateClient) { }

  /**
   * Startup hook: attach the client and begin the rolling poll loop that
   * triggers scheduled events.
   */
  public async initialize(client: Client): Promise<void> {
    this.bot = client;
    await this.alignNextChatWithSchedule();
    // Catch up on anything overdue from downtime before scheduling.
    await this.pollOnce();
    this.schedulePoll();
    console.log(
      `${this.logPrefix} scheduler started, ` +
      `polling every ${POLL_INTERVAL_MSEC}ms`,
    );
  }

  public async getOrCreate(guildId: GuildId = UPE_GUILD_ID): Promise<State> {
    const existing = await this.model.findOne({ guildId });
    if (existing !== null) {
      return existing;
    }
    return await this.model.create({ guildId });
  }

  public async setPaused(
    paused: boolean,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<void> {
    await this.model.updateOne({ guildId }, { $set: { paused } });
  }

  protected getBot(): Client {
    if (this.bot === null) {
      throw new Error(`${this.logPrefix} service used before initialize()`);
    }
    return this.bot;
  }

  /**
   * Invoked when a scheduled firing comes due. Implementations should call
   * `advanceSchedule` once they've committed to running.
   */
  protected abstract runScheduledEvent(state: State): Promise<void>;

  protected async setNextChat(
    nextChatIsoTime: string,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<void> {
    await this.model.updateOne(
      { guildId },
      { $set: { nextChatIsoTime } },
    );
  }

  /**
   * Reconcile the persisted `nextChatIsoTime` with the hardcoded weekly
   * schedule. Recomputes when missing or when the persisted day/hour/minute
   * no longer matches, so cadence changes take effect on next boot.
   */
  private async alignNextChatWithSchedule(
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<void> {
    const state = await this.getOrCreate(guildId);
    const persisted =
      state.nextChatIsoTime === null
        ? null
        : DateTime.fromISO(state.nextChatIsoTime, { zone: UCLA_TIMEZONE });

    if (persisted !== null && matchesSchedule(persisted)) {
      return;
    }

    const now = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    const next = nextScheduledOccurrence(now);
    const iso = next.toISO();
    if (iso !== null) {
      await this.setNextChat(iso, guildId);
    }
  }

  /**
   * Roll the persisted firing time forward to the next weekly occurrence. No-op
   * if the scheduled firing hasn't happened yet, which preserves the regular
   * cadence when an event is forced early.
   */
  protected async advanceSchedule(state: State): Promise<void> {
    if (state.nextChatIsoTime === null) {
      return;
    }
    const scheduled = DateTime.fromISO(state.nextChatIsoTime, {
      zone: UCLA_TIMEZONE,
    });
    const now = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    if (!scheduled.isValid || scheduled >= now) {
      return;
    }
    // Step past today's firing before snapping to the schedule, so an event
    // that just fired doesn't immediately re-qualify as overdue.
    const next = nextScheduledOccurrence(now.plus({ days: 1 }));
    const iso = next.toISO();
    if (iso !== null) {
      await this.setNextChat(iso, state.guildId);
    }
  }

  private schedulePoll(): void {
    setTimeout(async () => {
      try {
        await this.pollOnce();
      } catch (error) {
        console.error(`${this.logPrefix} poll failed:`, error);
        if (error instanceof Error) {
          await channelsService.sendDevError(error);
        }
      }
      this.schedulePoll();
    }, POLL_INTERVAL_MSEC);
  }

  private async pollOnce(): Promise<void> {
    if (this.bot === null) {
      return;
    }
    await this.runDueEvents();
  }

  private async runDueEvents(): Promise<void> {
    const now = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    const candidates = await this.model.find({
      paused: false,
      nextChatIsoTime: { $ne: null },
    });
    for (const state of candidates) {
      if (state.nextChatIsoTime === null) {
        continue;
      }
      const scheduled = DateTime.fromISO(state.nextChatIsoTime, {
        zone: UCLA_TIMEZONE,
      });
      if (!scheduled.isValid || scheduled > now) {
        continue;
      }
      try {
        await this.runScheduledEvent(state);
      } catch (error) {
        console.error(
          `${this.logPrefix} failed to run scheduled event:`,
          error,
        );
        if (error instanceof Error) {
          await channelsService.sendDevError(error);
        }
      }
    }
  }
}
