import { SlashCommandBuilder } from "discord.js";

export class ExtendedSlashCommandBuilder extends SlashCommandBuilder {
  public addBroadcastOption(required: boolean = false) {
    return this.addBooleanOption(input => input
      .setName("broadcast")
      .setDescription("Whether to respond publicly instead of ephemerally.")
      .setRequired(required),
    );
  }

  public addEphemeralOption(required: boolean = false) {
    return this.addBooleanOption(input => input
      .setName("ephemeral")
      .setDescription("Whether to respond ephemerally instead of publicly.")
      .setRequired(required),
    );
  }
}
