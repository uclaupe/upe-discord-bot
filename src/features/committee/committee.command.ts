import fs from "node:fs";

import {
  ChatInputCommandInteraction,
  Collection,
  Colors,
  EmbedBuilder,
  GuildMember,
  Role,
  bold,
} from "discord.js";
import { z } from "zod";

import { SlashCommandHandler } from "../../abc/command.abc";
import type { RoleId } from "../../types/branded.types";
import { assertNonEmptyArray } from "../../types/generic.types";
import {
  EMOJI_ANNOUNCEMENT,
  EMOJI_GRADUATION,
  EMOJI_MEDAL,
  EMOJI_SALUTE,
} from "../../utils/emojis.utils";
import { toBulletedList } from "../../utils/formatting.utils";
import { ExtendedSlashCommandBuilder } from "../../utils/options.utils";
import { PROJECT_ASSETS_ROOT, resolvePath } from "../../utils/paths.utils";
import {
  DIRECTORS_ROLE_ID,
  EMERITUS_ROLE_ID,
  EXEC_ROLE_ID,
} from "../../utils/snowflakes.utils";
import {
  COMMITTEE_NAMES,
  COMMITTEE_ROLE_MAP,
  Committee,
  TEAM_TYPE_NAMES,
  getCommitteeFromName,
} from "../../utils/upe.utils";

const COMMITTEE_DATA_PATH
  = resolvePath(PROJECT_ASSETS_ROOT, "committees.json");

assertNonEmptyArray(COMMITTEE_NAMES);
assertNonEmptyArray(TEAM_TYPE_NAMES);

const committeeDataSchema = z.object({
  name: z.enum(COMMITTEE_NAMES),
  team: z.enum(TEAM_TYPE_NAMES),
  /** Ref: https://docs.google.com/document/d/1ghSoLwE6TPzKOU97Rz8VP4X7HQyoqIKegilFTPp_w6A/edit?usp=sharing */
  description: z.array(z.string()),
});

const committeeDataListSchema = z.array(committeeDataSchema);

type CommitteeData = z.infer<typeof committeeDataSchema>;

class CommitteeCommand extends SlashCommandHandler {
  public override readonly definition = new ExtendedSlashCommandBuilder()
    .setName("committee")
    .setDescription("List details about a committee within UPE!")
    .addRoleOption(input => input
      .setName("committee_mention")
      .setDescription("Role of the committee to view.")
      .setRequired(true),
    )
    .addBroadcastOption()
    .toJSON();

  private readonly committees
    = new Collection<Committee, CommitteeData>();

  public constructor() {
    super();
    this.loadCommitteeData();
  }

  public override async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const role = interaction.options.getRole("committee_mention", true) as Role;
    const broadcast = !!interaction.options.getBoolean("broadcast");

    const committeeData = this.getCommitteeDataFromRole(role);

    if (!committeeData) {
      const errorEmbed = new EmbedBuilder()
        .setDescription(`${role} does not correspond to a committee!`)
        .setColor(Colors.Red);
      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
      return;
    }

    const embed = this.prepareCommitteeEmbed(role, committeeData);
    await interaction.reply({
      embeds: [embed],
      ephemeral: !broadcast,
    });
  }

  private loadCommitteeData(): void {
    const content = fs.readFileSync(COMMITTEE_DATA_PATH).toString();
    const rawJson = JSON.parse(content);
    const processedJson = committeeDataListSchema.parse(rawJson);
    for (const committeeData of processedJson) {
      const committee = getCommitteeFromName(committeeData.name);
      this.committees.set(committee, committeeData);
    }
  }

  /**
   * Example embed format:
   *
   * || Tutoring Committee (Internal Team)
   * ||
   * || * Bullet point 1 about the committee's duty/description.
   * || * Bullet point 2 about the committee's duty/description.
   * || * Bullet point 3 about the committee's duty/description.
   * ||
   * || Directors:
   * || <mention1>, <mention2>
   * ||
   * || Chairs:
   * || <mention1>, <mention2>, <mention3>
   * ||
   * || Honorary:
   * || <mention1>
   * ||
   * || Emeriti:
   * || <mention1>
   */
  private prepareCommitteeEmbed(
    role: Role,
    data: CommitteeData,
  ): EmbedBuilder {
    const committeeDescriptionBulletList = toBulletedList(data.description);

    const [emeriti, directors, chairs, honorary]
      = this.partitionCommittee(role);

    function formatMentions(prefix: string, members: GuildMember[]): string {
      const commaSeparatedMentions = members.join(", ");
      // Return a falsy string to get filtered out when building the embed body.
      // This way, titles that have no members are omitted entirely instead of
      // having a bunch of awkward "(none)"s or similar.
      if (!commaSeparatedMentions) return "";
      return `${bold(prefix)}\n${commaSeparatedMentions}`;
    }

    const embedBody = [
      committeeDescriptionBulletList || "No description provided...",
      formatMentions(`${EMOJI_ANNOUNCEMENT} Directors:`, directors),
      formatMentions(`${EMOJI_SALUTE} Chairs:`, chairs),
      formatMentions(`${EMOJI_MEDAL} Honorary:`, honorary),
      formatMentions(`${EMOJI_GRADUATION} Emeriti:`, emeriti),
    ].filter(Boolean).join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle(`${data.name} Committee (${data.team} Team)`)
      .setDescription(embedBody)
      .setColor(role.color);

    return embed;
  }

  /**
   * Extract the members of a committee role and partition them based on title.
   */
  private partitionCommittee(role: Role): [
    emeriti: GuildMember[],
    directors: GuildMember[],
    chairs: GuildMember[],
    honorary: GuildMember[],
  ] {
    const emeriti: GuildMember[] = [];
    const directors: GuildMember[] = [];
    const chairs: GuildMember[] = [];
    const honorary: GuildMember[] = [];

    for (const member of role.members.values()) {
      if (member.roles.cache.has(EMERITUS_ROLE_ID)) {
        emeriti.push(member);
      }
      // Sometimes new exec choose to continue repping their home committee.
      else if (member.roles.cache.has(EXEC_ROLE_ID)) {
        honorary.push(member);
      }
      else if (member.roles.cache.has(DIRECTORS_ROLE_ID)) {
        directors.push(member);
      }
      else {
        chairs.push(member);
      }
    }

    return [emeriti, directors, chairs, honorary];
  }

  /** Return undefined if the role does not map to a known committee. */
  private getCommitteeDataFromRole(
    role: Role,
  ): CommitteeData | undefined {
    const committee = COMMITTEE_ROLE_MAP.getKey(role.id as RoleId);
    if (committee === undefined) {
      return undefined;
    }
    return this.committees.get(committee);
  }
}

export default new CommitteeCommand();
