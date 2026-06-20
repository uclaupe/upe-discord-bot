import {
  EmbedBuilder,
  inlineCode,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  userMention,
  type ChatInputCommandInteraction,
  type Guild,
  type Role,
} from "discord.js";

import { SlashCommandHandler } from "../../abc/command.abc";
import { makeErrorEmbed } from "../../utils/errors.utils";

const MEMBER_LIMIT = 20;

class AssignRolesCommand extends SlashCommandHandler {
  public override readonly definition = new SlashCommandBuilder()
    .setName("assignroles")
    .setDescription("Assign a role to multiple members at once.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(input => input
      .setName("role")
      .setDescription("The role to assign to members.")
      .setRequired(true),
    )
    .addStringOption(input => input
      .setName("members")
      .setDescription(
        "Space-separated list of usernames or user IDs " +
        "(e.g. 'user1 12345 user2')",
      )
      .setRequired(true),
    )
    .toJSON();

  public override readonly checks = [];

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const targetRole = interaction.options.getRole("role", true) as Role;
    const membersInput = interaction.options.getString("members", true);
    const guild = interaction.guild as Guild;

    const memberIdentifiers = membersInput
      .split(/\s+/)
      .filter(m => m.length > 0);

    if (memberIdentifiers.length === 0) {
      await interaction.reply({
        embeds: [makeErrorEmbed("Please provide at least one member.")],
        ephemeral: true,
      });
      return;
    }

    // Discord imposes a 1024-char limit on embed bodies; see EMBED_FIELD_VALUE_LIMIT.
    if (memberIdentifiers.length > MEMBER_LIMIT) {
      await interaction.reply({
        embeds: [makeErrorEmbed(
          `Too many members (${memberIdentifiers.length}). ` +
          `The limit is ${MEMBER_LIMIT} per command.`,
        )],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply(
      `Resolving ${memberIdentifiers.length} member(s)...`,
    );

    const results = {
      success: [] as string[],
      failed: [] as string[],
    };

    for (const identifier of memberIdentifiers) {
      try {
        // Try to fetch as user ID first
        let member = null;
        if (/^\d+$/.test(identifier)) {
          member = await guild.members.fetch(identifier);
        } else {
          // Try to resolve by username
          const members = await guild.members.search({ query: identifier, limit: 1 });
          member = members.first() ?? null;
        }

        if (member === null) {
          results.failed.push(`${identifier} (not found)`);
          continue;
        }

        await member.roles.add(
          targetRole,
          `Assigned via ${this.id}`,
        );
        results.success.push(
          `${userMention(member.id)} (${inlineCode(member.id)})`,
        );
      }
      catch (error) {
        results.failed.push(
          `${inlineCode(identifier)} (error: ` +
          `${error instanceof Error ? inlineCode(error.message) : "unknown"})`,
        );
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("Batch Role Assignment")
      .addFields(
        {
          name: "Role",
          value: roleMention(targetRole.id),
          inline: true,
        },
        {
          name: "Successful",
          value: results.success.length > 0
            ? results.success.join("\n")
            : "None",
          inline: false,
        },
        {
          name: "Failed",
          value: results.failed.length > 0
            ? results.failed.join("\n")
            : "None",
          inline: false,
        },
      );

    await interaction.editReply({ content: "", embeds: [embed] });
  }
}

export default new AssignRolesCommand();
