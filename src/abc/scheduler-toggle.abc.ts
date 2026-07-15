import type { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";

import {
  Privilege,
  PrivilegeCheck,
} from "../middleware/privilege.middleware";
import type { SlashCommandCheck } from "./check.abc";
import { SlashCommandHandler } from "./command.abc";
import type {
  WeeklyScheduledService,
  WeeklyScheduleState,
} from "./weekly-scheduler.abc";

/**
 * Base for the paired `/<x>start` and `/<x>pause` commands that toggle a
 * weekly scheduler on and off. Subclasses supply their command definition, the
 * scheduler to toggle, the state to write, and the embed to reply with.
 */
export abstract class SchedulerToggleCommand<
  State extends WeeklyScheduleState,
> extends SlashCommandHandler {
  /** Scheduler this command toggles. */
  protected abstract readonly service: WeeklyScheduledService<State>;
  /** Paused state to write. */
  protected abstract readonly paused: boolean;
  /** Embed to reply with once the toggle lands. */
  protected abstract readonly embed: EmbedBuilder;

  public override readonly checks: SlashCommandCheck[] = [
    new PrivilegeCheck(this).atLeast(Privilege.Developer),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    // Ensure the state document exists before updating it.
    await this.service.getOrCreate();
    await this.service.setPaused(this.paused);
    await interaction.reply({ embeds: [this.embed] });
  }
}
