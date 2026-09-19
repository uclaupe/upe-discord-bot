import { Colors, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { SchedulerToggleCommand } from "../../abc/scheduler-toggle.abc";
import type { DonutState } from "../../models/donut.model";
import donutService from "./donut.service";

class DonutPauseCommand extends SchedulerToggleCommand<DonutState> {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutpause")
    .setDescription("Pause automatic donut chats.")
    .toJSON();

  protected override readonly service = donutService;
  protected override readonly paused = true;
  protected override readonly embed = new EmbedBuilder()
    .setTitle("Donut chats have been paused.")
    .setDescription("Run /donutstart to start them again!")
    .setColor(Colors.Blue);
}

export default new DonutPauseCommand();
