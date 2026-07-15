import { Colors, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { SchedulerToggleCommand } from "../../abc/scheduler-toggle.abc";
import type { MockInterviewState } from "../../models/mock-interview.model";
import mockInterviewService from "./mock-interview.service";

class MockStartCommand extends SchedulerToggleCommand<MockInterviewState> {
  public override readonly definition = new SlashCommandBuilder()
    .setName("mockstart")
    .setDescription("Resume automatic mock interview rounds.")
    .toJSON();

  protected override readonly service = mockInterviewService;
  protected override readonly paused = false;
  protected override readonly embed = new EmbedBuilder()
    .setTitle("Mock interview rounds will automatically start again!")
    .setColor(Colors.Green);
}

export default new MockStartCommand();
