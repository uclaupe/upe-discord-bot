import { Colors, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { SchedulerToggleCommand } from "../../abc/scheduler-toggle.abc";
import type { DonutState } from "../../models/donut.model";
import donutService from "./donut.service";

class DonutStartCommand extends SchedulerToggleCommand<DonutState> {
  public override readonly definition = new SlashCommandBuilder()
    .setName("donutstart")
    .setDescription("Resume automatic donut chats.")
    .toJSON();

  protected override readonly service = donutService;
  protected override readonly paused = false;
  protected override readonly embed = new EmbedBuilder()
    .setTitle("Donut chats will automatically start again!")
    .setColor(Colors.Green);
}

export default new DonutStartCommand();
