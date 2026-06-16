import {
  bold,
  channelMention,
  Colors,
  EmbedBuilder,
  SlashCommandBuilder,
  time,
  TimestampStyles,
  userMention,
  type ChatInputCommandInteraction,
  type GuildMember,
  type GuildTextBasedChannel,
} from "discord.js";
import { DateTime } from "luxon";

import type { SlashCommandCheck } from "../../abc/check.abc";
import { SlashCommandHandler } from "../../abc/command.abc";
import {
  Privilege,
  PrivilegeCheck,
} from "../../middleware/privilege.middleware";
import keyPickupReminderService
  from "../../services/key-pickup-reminder.service";
import type { ChannelId, UnixSeconds, UserId } from "../../types/branded.types";
import { UCLA_TIMEZONE } from "../../utils/date.utils";
import { normalizeChannelName } from "../../utils/formatting.utils";
import { EXEC_ROLE_ID } from "../../utils/snowflakes.utils";
import { Committee, COMMITTEE_ROLE_MAP } from "../../utils/upe.utils";

const COMMITTEE_ENTRIES: readonly Committee[] = [
  Committee.FinanceAndFacilities,
  Committee.Advocacy,
  Committee.Alumni,
  Committee.DesignAndPublicity,
  Committee.Mentorship,
  Committee.Tutoring,
  Committee.Social,
  Committee.Web,
  Committee.Corporate,
  Committee.InductionAndMembership,
];

const ONE_HOUR_SECONDS = 3600;

class KeyPickupReminderCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("keypickupreminder")
    .setDescription("Schedule a reminder to pick up the key for an event.")
    .addStringOption(input => input
      .setName("datetime")
      .setDescription("Event date & time (mm/dd/yyyy hh:mm)")
      .setRequired(true)
    )
    .addUserOption(input => input
      .setName("user")
      .setDescription("User to remind (defaults to you)")
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Officer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const datetimeStr = interaction.options.getString("datetime", true);
    const targetMember = (
      interaction.options.getMember("user") ?? interaction.member
    ) as GuildMember;

    const eventDateTime = DateTime.fromFormat(
      datetimeStr.trim(),
      "MM/dd/yyyy HH:mm",
      { zone: UCLA_TIMEZONE },
    );
    if (!eventDateTime.isValid) {
      await this.replyError(
        interaction,
        "Invalid datetime format: `" + datetimeStr +
        "`. Expected `mm/dd/yyyy hh:mm`.",
      );
      return;
    }

    const eventTime = Math.round(eventDateTime.toSeconds()) as UnixSeconds;
    const now = Math.round(Date.now() / 1000) as UnixSeconds;

    if (eventTime <= now) {
      await this.replyError(
        interaction,
        "The event time must be in the future.",
      );
      return;
    }

    const channel = this.resolveCommitteeChannel(targetMember);
    if (!channel) {
      await this.replyError(
        interaction,
        `${userMention(targetMember.id)} does not appear to be on any ` +
        "committee.",
      );
      return;
    }

    const reminderTime = Math.max(
      eventTime - ONE_HOUR_SECONDS,
      now,
    ) as UnixSeconds;

    await keyPickupReminderService.create(
      targetMember.id as UserId,
      channel.id as ChannelId,
      eventTime,
      reminderTime,
    );

    const eventTimestamp = time(eventTime, TimestampStyles.ShortDateTime);
    const reminderTimestamp = time(reminderTime, TimestampStyles.RelativeTime);

    const embed = new EmbedBuilder()
      .setTitle("Key Pickup Reminder Scheduled")
      .setDescription(
        `${bold("User:")} ${userMention(targetMember.id)}\n` +
        `${bold("Event:")} ${eventTimestamp}\n` +
        `${bold("Reminder:")} ${reminderTimestamp}\n` +
        `${bold("Channel:")} ${channelMention(channel.id)}`,
      )
      .setColor(Colors.Green);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private resolveCommitteeChannel(
    member: GuildMember,
  ): GuildTextBasedChannel | null {
    for (const committee of COMMITTEE_ENTRIES) {
      const roleId = COMMITTEE_ROLE_MAP.get(committee);
      if (roleId && member.roles.cache.has(roleId)) {
        const channelName = normalizeChannelName(committee);
        const channel = member.guild.channels.cache.find(
          ch => ch.name === channelName && ch.isTextBased(),
        );
        if (channel) {
          return channel as GuildTextBasedChannel;
        }
      }
    }

    if (member.roles.cache.has(EXEC_ROLE_ID)) {
      const channel = member.guild.channels.cache.find(
        ch => ch.name === "exec" && ch.isTextBased(),
      );
      if (channel) {
        return channel as GuildTextBasedChannel;
      }
    }

    return null;
  }
}

export default new KeyPickupReminderCommand();
