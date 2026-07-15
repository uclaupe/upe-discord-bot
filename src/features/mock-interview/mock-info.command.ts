import {
  channelMention,
  Colors,
  EmbedBuilder,
  roleMention,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { SlashCommandHandler } from "../../abc/command.abc";
import { UCLA_TIMEZONE } from "../../utils/date.utils";
import {
  MOCK_INTERVIEW_CHANNEL_ID,
  MOCK_INTERVIEWEE_ROLE_ID,
  MOCK_INTERVIEWER_ROLE_ID,
} from "../../utils/snowflakes.utils";
import { describeNextOccurrence } from "../../utils/weekly-schedule.utils";
import mockInterviewService from "./mock-interview.service";

class MockInfoCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("mockinfo")
    .setDescription("Get information about mock interview configuration.")
    .toJSON();

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const state = await mockInterviewService.getOrCreate();
    const nextRoundValue = describeNextOccurrence(state.nextChatIsoTime);

    const guild = interaction.guild;
    let participantsValue = "Unavailable outside the server.";
    if (guild !== null) {
      await guild.members.fetch();
      const interviewers =
        guild.roles.cache.get(MOCK_INTERVIEWER_ROLE_ID)?.members.size ?? 0;
      const interviewees =
        guild.roles.cache.get(MOCK_INTERVIEWEE_ROLE_ID)?.members.size ?? 0;
      participantsValue =
        `${interviewers} interviewer(s), ${interviewees} interviewee(s)`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Mock interview config for ${interaction.guild?.name}`)
      .addFields(
        {
          name: "Channel",
          value: channelMention(MOCK_INTERVIEW_CHANNEL_ID),
          inline: true,
        },
        {
          name: "Roles",
          value:
            `${roleMention(MOCK_INTERVIEWER_ROLE_ID)} / ` +
            `${roleMention(MOCK_INTERVIEWEE_ROLE_ID)}`,
          inline: true,
        },
        {
          name: "Signed Up",
          value: participantsValue,
        },
        {
          name: "Time zone",
          value: UCLA_TIMEZONE,
        },
        {
          name: "Next Scheduled Round",
          value: nextRoundValue,
        },
        {
          name: "Paused",
          value: state.paused ? "Yes" : "No",
          inline: true,
        },
      )
      .setFooter({
        text:
          "Give yourself a role to sign up. Only developers can access " +
          "/mockpause and /mockstart.",
      })
      .setColor(Colors.Blue);

    await interaction.reply({ embeds: [embed] });
  }
}

export default new MockInfoCommand();
