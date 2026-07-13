import {
  bold,
  channelMention,
  Colors,
  EmbedBuilder,
  Events,
  inlineCode,
  Message,
  PermissionFlagsBits,
  userMention,
} from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import {
  ADVISOR_ROLE_ID,
  EMERITUS_ROLE_ID,
  MODERATION_CHANNEL_ID,
  OFFICERS_ROLE_ID,
} from "../../utils/snowflakes.utils";
import channelsService from "../../services/channels.service";

class SpamListener extends DiscordEventListener<Events.MessageCreate> {
  public override readonly event = Events.MessageCreate;

  public override async execute(message: Message<true>): Promise<void> {
    await this.handleProhibitedAtEveryoneAttempt(message);
  }

  private async handleProhibitedAtEveryoneAttempt(
    message: Message<true>,
  ): Promise<void> {
    if (!this.isProhibitedAtEveryoneAttempt(message)) {
      return;
    }

    const author = message.member;
    if (!author) {
      return;
    }

    const overviewEmbed = new EmbedBuilder()
      .setTitle("Suspected Spammer")
      .setDescription(
        `${userMention(author.id)} tried to ${inlineCode("@everyone")} in ` +
        `${channelMention(message.channelId)}.`,
      )
      .setColor(Colors.Red);

    const echoEmbed = new EmbedBuilder()
      .setTitle("Suspected Spam Message")
      .setDescription(message.content)
      .setFooter({ text: `Included ${message.attachments.size} attachments` })
      .setColor(Colors.Red);

    if (author.kickable) {
      const channelName = message.channel.name;
      await author.kick(
        `Unauthorized @everyone attempt in #${channelName}, likely spam`,
      );
      overviewEmbed
        .setTitle("Kicked Suspected Spammer")
        .setDescription(
          `${overviewEmbed.data.description} They have been ${bold("kicked")}.`,
        )
        .setColor(Colors.Yellow);
    }

    if (message.deletable) {
      await message.delete();
      echoEmbed
        .setTitle("Deleted Suspected Spam Message")
        .setColor(Colors.Yellow);
    }

    await channelsService.sendToChannel(MODERATION_CHANNEL_ID, {
      embeds: [overviewEmbed, echoEmbed],
    });
  }

  private isProhibitedAtEveryoneAttempt(message: Message<true>): boolean {
    // Message doesn't even mention @everyone, not applicable.
    if (!message.mentions.everyone) {
      return false;
    }

    const author = message.member;
    // Author isn't a `GuildMember` somehow, not applicable.
    if (!author) {
      return false;
    }

    // Author is authorized to mention @everyone in this channel, allowed.
    const permissions = message.channel.permissionsFor(author);
    if (permissions.has(PermissionFlagsBits.MentionEveryone)) {
      return false;
    }

    // (Fail-safe) Author is an officer/emeritus/advisor, which shouldn't be
    // caught and punished by this filter ever. This ideally should be covered
    // by proper permissions setup (above check), but there could be niche edge
    // cases where maybe a channel has an overwrite to suppress
    // @everyone-pinging even for them.
    if (author.roles.cache.hasAny(
      OFFICERS_ROLE_ID,
      EMERITUS_ROLE_ID,
      ADVISOR_ROLE_ID,
    )) {
      return false;
    }

    return true;
  }
}

export default new SpamListener();
