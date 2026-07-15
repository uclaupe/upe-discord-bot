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
import { MODERATION_CHANNEL_ID } from "../../utils/snowflakes.utils";
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
    if (!this.hasEveryonePing(message.content)) {
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

    // (Fail-safe) Author has any role, meaning they're likely not someone who
    // joined the server just to send spam messages. This isn't a perfect
    // heuristic but this final check should seldom be hit anyway. It's just
    // here for the niche edge cases where maybe a channel has a permission
    // overwrite to suppress @everyone-pinging even for legitimate users, thus
    // bypassing the check above.
    if (author.roles.cache.size > 0) {
      return false;
    }

    return true;
  }

  /**
   * Return whether the `content` contains a raw `@everyone` substring, not
   * wrapped by code markup (which would disable the ping even if the author had
   * ping permissions).
   *
   * Courtesy of Claude Code.
   */
  private hasEveryonePing(content: string): boolean {
    let stripped = content;

    // Remove fenced code blocks (```...```), which are allowed to span multiple
    // lines.
    stripped = stripped.replace(/```[\s\S]*?```/g, '');

    // Remove double-backtick inline code spans (``...``), used so the span's
    // content can itself contain a literal backtick. Restricted to a single
    // line, since Discord doesn't let inline code cross lines.
    stripped = stripped.replace(/``[^\n]*?``/g, '');

    // Remove single-backtick inline code spans (`...`), also single-line only,
    // and not allowed to contain a backtick itself (that's what the
    // double-backtick form above is for).
    stripped = stripped.replace(/`[^`\n]*?`/g, '');

    return stripped.includes("@everyone");
  }
}

export default new SpamListener();
