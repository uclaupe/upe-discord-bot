import { Events, Message, PermissionFlagsBits } from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import {
  ADVISOR_ROLE_ID,
  EMERITUS_ROLE_ID,
  OFFICERS_ROLE_ID,
} from "../../utils/snowflakes.utils";

class SpamListener extends DiscordEventListener<Events.MessageCreate> {
  public override readonly event = Events.MessageCreate;

  public override async execute(message: Message<true>): Promise<void> {
    if (this.isProhibitedAtEveryoneAttempt(message)) {
      const author = message.member;
      const channelName = message.channel.name;
      await author?.kick(
        `Unauthorized @everyone attempt in #${channelName}, likely spam`,
      );
    }
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
