import util from "node:util";

import {
  BaseInteraction,
  bold,
  channelMention,
  codeBlock,
  inlineCode,
  PermissionFlagsBits,
  userMention,
  type Client,
  type DMChannel,
  type Guild,
  type GuildTextBasedChannel,
  type Message,
  type MessageCreateOptions,
  type MessagePayload,
} from "discord.js";

import { TextCommandHandler } from "../abc/text-command.abc";
import { MESSAGE_CHARACTER_LIMIT } from "../utils/limits.utils";
import {
  BOT_LOGS_CHANNEL_ID,
  DEVELOPER_ROLE_ID,
  UPE_GUILD_ID,
} from "../utils/snowflakes.utils";
import type { ChannelId } from "../types/branded.types";

class ChannelService {
  private client: Client<true> | null = null;
  private upe: Guild | null = null;

  private devDms: DMChannel[] = [];
  private logsChannel: GuildTextBasedChannel | null = null;

  public async initialize(client: Client<true>): Promise<void> {
    this.client = client;

    // TODO: Maybe implement some kind of "startup hook" system where services
    // can sanity check they can meet their requirements and reliably crash the
    // bot if not instead of waiting for an error to pop up deep in runtime.

    this.upe = await client.guilds.fetch(UPE_GUILD_ID);

    const developerRole = await this.upe.roles.fetch(DEVELOPER_ROLE_ID);
    if (developerRole === null) {
      return;
    }

    for (const developer of developerRole.members.values()) {
      const dmChannel = developer.dmChannel ?? await developer.createDM();
      this.devDms.push(dmChannel);
    }

    await this.initLogsChannel();
  }

  public getLogSink(): GuildTextBasedChannel | null {
    // Try to prevent a permissions error if we can help it.
    if (this.logsChannel !== null && !this.canSendMessages(this.logsChannel)) {
      console.error(
        `bot cannot send messages in logs channel: ${this.logsChannel}`,
      );
      return null;
    }
    return this.logsChannel;
  }

  public async sendToChannel(
    channelId: ChannelId,
    options: string | MessagePayload | MessageCreateOptions,
  ): Promise<Message | null> {
    const upe = this.getUpe();
    const channel = await upe.channels.fetch(channelId);
    if (channel === null) {
      console.error(`tried to send to unknown channel (ID: ${channelId}`);
      return null;
    }
    if (!channel.isTextBased()) {
      console.error(`tried to send to non-text channel (ID: ${channelId})`);
      return null;
    }
    try {
      return await channel.send(options);
    }
    catch (error) {
      console.error(
        `failed to send to channel (ID: ${channelId}), doing nothing`,
      );
      return null;
    }
  }

  public async sendDev(
    options: string | MessagePayload | MessageCreateOptions,
  ): Promise<void> {
    for (const dmChannel of this.devDms) {
      try {
        await dmChannel.send(options);
      }
      // Don't force the caller to add yet another layer to their error handling.
      catch (error) {
        console.error(
          `FAILED TO SEND DEV MESSAGE TO ${dmChannel.recipient}:`,
          error,
        );
      }
    }
  }

  public async sendDevError(
    error: Error | string | unknown,
    context?: BaseInteraction | Message,
  ): Promise<void> {
    try {
      await this.unsafeSendDevError(error, context);
    }
    // Don't force the caller to add yet another layer to their error handling.
    catch (error) {
      console.error("FAILED TO SEND DEV ERROR:", error);
    }
  }

  private async unsafeSendDevError(
    error: Error | string | unknown,
    context?: BaseInteraction | Message,
  ): Promise<void> {
    const contextLine
      = context !== undefined
        ? this.resolveContextLine(context)
        : "";

    let errorLine: string;
    let dumpLine = "";

    if (error instanceof Error) {
      errorLine = `${bold(error.name)}: ${error.message}`;
      dumpLine = codeBlock(util.format(error));
    }
    else if (typeof error === 'string') {
      errorLine = error;
    }
    else {
      errorLine = `${bold("Some non-Error thrown:")} ${error}`;
    }

    let content = [contextLine, errorLine, dumpLine].filter(Boolean).join("\n");
    if (content.length > MESSAGE_CHARACTER_LIMIT) {
      content = content.slice(0, MESSAGE_CHARACTER_LIMIT - 6) + "...```";
    }

    await this.sendDev(content);
  }

  private resolveContextLine(context: BaseInteraction | Message): string {
    if (context instanceof BaseInteraction) {
      const commandName = context.isCommand() ? context.commandName : "";
      const sourceMention = channelMention(context.channel!.id);
      const callerMention = userMention(context.user.id);

      let contextLine = `For ${callerMention} in ${sourceMention}`;
      if (commandName) {
        contextLine += ` (${bold(inlineCode("/" + commandName))})`;
      }
      return contextLine;
    }

    const commandToken
      = context.content.startsWith(TextCommandHandler.COMMAND_PREFIX)
        ? context.content.split(/\s+/)[0]
        : "";
    const sourceMention = channelMention(context.channelId);
    const callerMention = userMention(context.author.id);

    let contextLine = `For ${callerMention} in ${sourceMention}`;
    if (commandToken) {
      contextLine += ` (${bold(inlineCode("/" + commandToken))})`;
    }
    return contextLine;
  }

  private async initLogsChannel(): Promise<void> {
    const logsChannel = await this.getUpe().channels.fetch(BOT_LOGS_CHANNEL_ID);

    if (logsChannel === null) {
      const errorMessage = (
        `Logs channel (ID=${inlineCode(BOT_LOGS_CHANNEL_ID)}) not found!`
      );
      console.error(errorMessage);
      await this.sendDevError(errorMessage);
      return;
    }

    if (!logsChannel.isTextBased()) {
      const errorMessage = (
        `Logs channel ${channelMention(BOT_LOGS_CHANNEL_ID)} does not seem ` +
        "to be a valid text channel I can send messages to!"
      );
      console.error(errorMessage);
      await this.sendDevError(errorMessage);
      return;
    }

    this.logsChannel = logsChannel;
  }

  public getUpe(): Guild {
    if (this.upe === null) {
      throw new Error("UPE guild requested before initialized");
    }
    return this.upe;
  }

  private getClient(): Client<true> {
    if (this.client === null) {
      throw new Error("bot client requested before initialized");
    }
    return this.client;
  }

  private canSendMessages(channel: GuildTextBasedChannel): boolean {
    return !!channel
      .permissionsFor(this.getClient().user)
      ?.has(PermissionFlagsBits.SendMessages)
  }
}

export default new ChannelService();
