import { Colors, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { SchedulerToggleCommand } from "../../abc/scheduler-toggle.abc";
import type { MockInterviewState } from "../../models/mock-interview.model";
import mockInterviewService from "./mock-interview.service";

class MockPauseCommand extends SchedulerToggleCommand<MockInterviewState> {
  public override readonly definition = new SlashCommandBuilder()
    .setName("mockpause")
    .setDescription("Pause automatic mock interview rounds.")
    .toJSON();

  protected override readonly service = mockInterviewService;
  protected override readonly paused = true;
  protected override readonly embed = new EmbedBuilder()
    .setTitle("Mock interview rounds have been paused.")
    .setDescription("Run /mockstart to start them again!")
    .setColor(Colors.Blue);
}

export default new MockPauseCommand();
