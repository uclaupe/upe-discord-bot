import childProcess from "node:child_process";
import util from "node:util";

import {
  ActivityType,
  codeBlock,
  Colors,
  EmbedBuilder,
  Events,
  inlineCode,
  type Client,
  type MessageCreateOptions,
} from "discord.js";

import { DiscordEventListener } from "../../abc/listener.abc";
import helpCommand from "../../features/convenience/help.command";
import donutService from "../../features/donuts/donut.service";
import reviewSheetsService from "../../features/tutoring/review-sheets.service";
import channelsService from "../../services/channels.service";
import keyPickupReminderService from "../../services/key-pickup-reminder.service";
import type { UnixSeconds, UrlString } from "../../types/branded.types";
import { SystemDateClient, type IDateClient } from "../../utils/date.utils";
import { quietHyperlink, timestampPair } from "../../utils/formatting.utils";

class ReadyListener extends DiscordEventListener<Events.ClientReady> {
  public override readonly event = Events.ClientReady;
  public override readonly once = true;

  public constructor(private readonly dateClient: IDateClient) { super(); }

  public override async execute(client: Client<true>): Promise<void> {
    const now = this.dateClient.getNow();

    console.log(
      `[READY] Client is ready! Logged in as ${client.user.username}.`,
    );

    // TODO: Maybe architect a cleaner/more organized way for "startup hooks" to
    // register themselves.
    await channelsService.initialize(client);
    await reviewSheetsService.initialize(channelsService.getUpe());
    await donutService.initialize(client);
    await keyPickupReminderService.initialize();

    const startupMessage = await this.makeStartupMessage(now);
    await channelsService.getLogSink()?.send(startupMessage);

    await client.user.setActivity({
      type: ActivityType.Listening,
      name: helpCommand.id,
    });
  }

  private async makeStartupMessage(
    loginTime: UnixSeconds,
  ): Promise<MessageCreateOptions> {
    const [timeMention, relativeMention] = timestampPair(loginTime);

    const gitContext = await this.getGitContext();

    return {
      content: `Bot has logged in at ${timeMention} (${relativeMention}).`,
      embeds: [gitContext],
    };
  }

  private async getGitContext(): Promise<EmbedBuilder> {
    const exec = util.promisify(childProcess.exec);

    const failedEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setDescription("Failed to retrieve Git context via shell command.");

    let { stdout: commitHash } = await exec("git rev-parse HEAD");
    commitHash = commitHash.trim();
    if (!commitHash) {
      return failedEmbed;
    }

    let { stdout: commitTitle } = await exec("git show -s --format=%s HEAD");
    commitTitle = commitTitle.trim();
    if (!commitTitle) {
      return failedEmbed;
    }

    // Ref: https://github.com/<USERNAME>/<REPOSITORY>/commit/<COMMIT_HASH>
    // TODO: I would've cheesed it with the homepage property from package.json
    // but tsconfig.json rootDir doesn't allow direct imports from it :/ so
    // unfortunately I shall hard-code this and leave it up to successors to
    // update this.
    const repoUrl = "https://github.com/vinlin24/upe-discord-bot" as UrlString;
    const gitHubCommitUrl = `${repoUrl}/commit/${commitHash}` as UrlString;
    const commitHyperlink = quietHyperlink(
      inlineCode(commitHash),
      gitHubCommitUrl,
    );

    const embed = new EmbedBuilder()
      .setColor(Colors.DarkButNotBlack)
      .setDescription(
        `Bot checked out at ${commitHyperlink}:\n` +
        codeBlock(commitTitle)
      );

    return embed;
  }
}

export default new ReadyListener(new SystemDateClient());
