import {
  ChannelType,
  Colors,
  EmbedBuilder,
  ThreadAutoArchiveDuration,
  userMention,
} from "discord.js";
import { DateTime } from "luxon";
import type { Model } from "mongoose";

import { WeeklyScheduledService } from "../../abc/weekly-scheduler.abc";
import { DonutStateModel, type DonutState } from "../../models/donut.model";
import channelsService from "../../services/channels.service";
import type { GuildId, UserId } from "../../types/branded.types";
import { SystemDateClient, UCLA_TIMEZONE } from "../../utils/date.utils";
import { DONUT_CHANNEL_ID, UPE_GUILD_ID } from "../../utils/snowflakes.utils";

export class DonutService extends WeeklyScheduledService<DonutState> {
  protected override readonly model: Model<DonutState> = DonutStateModel;
  protected override readonly logPrefix = "[DONUT]";

  protected override async runScheduledEvent(state: DonutState): Promise<void> {
    await this.startDonutChat(state);
  }

  public async addUser(
    userId: UserId,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<boolean> {
    const result = await DonutStateModel.updateOne(
      { guildId, users: { $ne: userId } },
      { $push: { users: userId } },
    );
    return result.modifiedCount > 0;
  }

  public async removeUser(
    userId: UserId,
    guildId: GuildId = UPE_GUILD_ID,
  ): Promise<boolean> {
    const result = await DonutStateModel.updateOne(
      { guildId },
      { $pull: { users: userId } },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Kick off any donut chat whose scheduled start has passed. Safe to call
   * on boot to catch up on missed cycles.
   */
  public async startDonutChat(state: DonutState): Promise<void> {
    const bot = this.getBot();
    const channel = await bot.channels.fetch(DONUT_CHANNEL_ID);
    if (channel === null || channel.type !== ChannelType.GuildText) {
      console.error(
        `[DONUT] configured channel ${DONUT_CHANNEL_ID} is not a text channel`,
      );
      return;
    }

    await this.advanceSchedule(state);

    if (state.users.length < 2) {
      const notEnoughEmbed = new EmbedBuilder()
        .setTitle("A donut chat was scheduled but not enough people joined.")
        .setDescription(
          "There needs to be at least 2 people to chat with each other!",
        )
        .setColor(Colors.Red);
      await channel.send({ embeds: [notEnoughEmbed] });
      return;
    }

    const enoughEmbed = new EmbedBuilder()
      .setTitle("A donut chat was just started!")
      .setDescription(
        "If you're signed up, check for a ping in a thread in this channel! :doughnut:",
      )
      .addFields({
        name: "I wasn't pinged!",
        value:
          "Make sure you've joined already! You can do this with the /donutjoin slash command.",
      })
      .setFooter({
        text: "You can always opt-out with /donutleave, but we'll be sad to see you go!",
      })
      .setColor(Colors.Green);
    await channel.send({ embeds: [enoughEmbed] });

    const groups = DonutService.createHeuristicGrouping(
      state.users,
      state.history,
      100,
    );

    const nowDate = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    const threadNameDate = nowDate.toLocaleString(DateTime.DATE_MED);

    for (const group of groups) {
      const thread = await channel.threads.create({
        name: `Donut Chat - ${threadNameDate}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PrivateThread,
      });

      for (const userId of group) {
        try {
          await thread.members.add(userId);
        } catch (error) {
          console.error(
            `[DONUT] failed to add user ${userId} to thread ${thread.id}:`,
            error,
          );
          if (error instanceof Error) {
            await channelsService.sendDevError(error);
          }
        }
      }
      await thread.join();

      const pings = group.map((id) => userMention(id));
      const pingString =
        group.length === 1
          ? pings[0]
          : pings.slice(0, -1).join(", ") + " and " + pings[pings.length - 1];

      const introductionEmbed = new EmbedBuilder()
        .setTitle("Let's donut!")
        .setDescription(`Welcome, ${pingString}! :doughnut: :speaking_head:`)
        .addFields({
          name: "How does this work?",
          value:
            "Introduce yourselves and grab some coffee or food together sometime soon!",
        })
        .setFooter({
          text: "Please note that this thread is private but may still be visible to server moderators. Take any private conversations into DMs!",
        })
        .setColor(Colors.Blue);
      await thread.send({ embeds: [introductionEmbed] });
    }

    const newHistory = [...state.history, groups];
    await DonutStateModel.updateOne(
      { guildId: state.guildId },
      { $set: { history: newHistory } },
    );
  }

  private static createHeuristicGrouping(
    users: UserId[],
    prevMatching: UserId[][][],
    tries: number,
  ): UserId[][] {
    let score = Number.MAX_SAFE_INTEGER;
    let bestGroups: UserId[][] = [];

    for (let i = 0; i < tries; i++) {
      const groups = DonutService.createGrouping(users);
      const newScore = DonutService.calculateGroupingScore(
        prevMatching,
        groups,
      );
      if (newScore < score) {
        score = newScore;
        bestGroups = groups;
      }
      if (newScore === 0) {
        break;
      }
    }
    return bestGroups;
  }

  private static createGrouping(users: UserId[]): UserId[][] {
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    const groups: UserId[][] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      groups.push(shuffled.slice(i, i + 2));
    }
    if (shuffled.length % 2 !== 0 && groups.length > 0) {
      groups[groups.length - 1].push(shuffled[shuffled.length - 1]);
    }
    return groups;
  }

  private static calculateGroupingScore(
    prevMatching: UserId[][][],
    proposed: UserId[][],
  ): number {
    let score = 0;
    prevMatching.forEach((week, i) => {
      week.forEach((prevGroup) => {
        proposed.forEach((proposedGroup) => {
          if (proposedGroup.every((user) => prevGroup.includes(user))) {
            const weeksAgo = prevMatching.length - i;
            score += DonutService.getAgeWeighting(weeksAgo);
          }
        });
      });
    });
    return score;
  }

  private static getAgeWeighting(weeksAgo: number): number {
    return weeksAgo ** -1.3;
  }
}

export default new DonutService(new SystemDateClient());
