import {
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  inlineCode,
  roleMention,
  type ChatInputCommandInteraction,
  type Guild,
  type Role,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { UserId } from "../../types/branded.types";
import { makeErrorEmbed } from "../../utils/errors.utils";

enum Action {
  Assign = "assign",
  Remove = "remove",
}

const USER_MENTION_RE = /<@(\d+)>/g;
const ROLE_MENTION_RE = /<@&(\d+)>/g;
const RAW_ID_RE = /^\d+$/;

class ForEachCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("foreach")
    .setDescription("Assign or remove a role for a set of members.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(input => input
      .setName("source")
      .setDescription(
        "Space-separated user mentions, role mentions, @everyone, " +
        "or raw user IDs.",
      )
      .setRequired(true),
    )
    .addStringOption(input => input
      .setName("do")
      .setDescription("Whether to assign or remove the role.")
      .setRequired(true)
      .addChoices(
        { name: "Assign", value: Action.Assign },
        { name: "Remove", value: Action.Remove },
      ),
    )
    .addRoleOption(input => input
      .setName("role")
      .setDescription("The role to assign or remove.")
      .setRequired(true),
    )
    .toJSON();

  public override readonly checks: SlashCommandCheck[] = [
    new BotPermissionCheck(this).needsToHave(PermissionFlagsBits.ManageRoles),
  ];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const source = interaction.options.getString("source", true);
    const action = interaction.options.getString("do", true) as Action;
    const role = interaction.options.getRole("role", true) as Role;
    const guild = interaction.guild as Guild;

    const userIds = await this.resolveUserIds(source, guild);
    if (userIds === null) {
      await interaction.reply({
        embeds: [makeErrorEmbed(
          "Could not parse source. Provide user mentions, role mentions, " +
          inlineCode("@everyone") + ", or raw user IDs separated by spaces.",
        )],
        ephemeral: true,
      });
      return;
    }

    if (userIds.size === 0) {
      await interaction.reply({
        embeds: [makeErrorEmbed("No members matched the provided source.")],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const verb = action === Action.Assign ? "Assigned" : "Removed";
    const preposition = action === Action.Assign ? "to" : "from";
    let succeeded = 0;
    let failed = 0;

    const reason = `@${interaction.user.username}: ${this.id}`;
    for (const userId of userIds) {
      try {
        const member = await guild.members.fetch(userId);
        if (action === Action.Assign) {
          await member.roles.add(role, reason);
        } else {
          await member.roles.remove(role, reason);
        }
        succeeded++;
      } catch {
        failed++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(failed > 0 ? Colors.Yellow : Colors.Green)
      .setDescription(
        `${verb} ${roleMention(role.id)} ${preposition} ` +
        `**${succeeded}** member(s)` +
        (failed > 0 ? ` (${failed} failed)` : "") +
        ".",
      );

    await interaction.editReply({ embeds: [embed] });
  }

  private async resolveUserIds(
    source: string,
    guild: Guild,
  ): Promise<Set<UserId> | null> {
    const ids = new Set<UserId>();
    const tokens = source.trim().split(/\s+/);
    let matched = false;

    for (const token of tokens) {
      if (token === "@everyone") {
        matched = true;
        const members = await guild.members.fetch();
        for (const member of members.values()) {
          ids.add(member.id as UserId);
        }
        continue;
      }

      const userMatch = [...token.matchAll(USER_MENTION_RE)];
      if (userMatch.length > 0) {
        matched = true;
        for (const m of userMatch) {
          ids.add(m[1] as UserId);
        }
        continue;
      }

      const roleMatch = [...token.matchAll(ROLE_MENTION_RE)];
      if (roleMatch.length > 0) {
        matched = true;
        for (const m of roleMatch) {
          const role = guild.roles.cache.get(m[1]);
          if (role) {
            for (const member of role.members.values()) {
              ids.add(member.id as UserId);
            }
          }
        }
        continue;
      }

      if (RAW_ID_RE.test(token)) {
        matched = true;
        ids.add(token as UserId);
        continue;
      }
    }

    return matched ? ids : null;
  }
}

export default new ForEachCommand();
