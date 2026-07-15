import {
  ChannelType,
  Colors,
  EmbedBuilder,
  ThreadAutoArchiveDuration,
  roleMention,
  userMention,
  type Guild,
} from "discord.js";
import { DateTime } from "luxon";
import type { Model } from "mongoose";

import { WeeklyScheduledService } from "../../abc/weekly-scheduler.abc";
import {
  MockInterviewStateModel,
  type MockInterviewState,
} from "../../models/mock-interview.model";
import channelsService from "../../services/channels.service";
import type { UserId } from "../../types/branded.types";
import { SystemDateClient, UCLA_TIMEZONE } from "../../utils/date.utils";
import {
  MOCK_INTERVIEW_CHANNEL_ID,
  MOCK_INTERVIEWEE_ROLE_ID,
  MOCK_INTERVIEWER_ROLE_ID,
} from "../../utils/snowflakes.utils";

// Cap on how many times a single member of the smaller pool may be reused when
// the two pools are imbalanced, so nobody is asked to interview (or be
// interviewed) an unreasonable number of times in one week.
const MAX_APPEARANCES = 3;

export type MockPairing = {
  interviewer: UserId;
  interviewee: UserId;
};

export class MockInterviewService
  extends WeeklyScheduledService<MockInterviewState> {

  protected override readonly model: Model<MockInterviewState>
    = MockInterviewStateModel;
  protected override readonly logPrefix = "[MOCK]";

  protected override async runScheduledEvent(
    state: MockInterviewState,
  ): Promise<void> {
    await this.startMockInterviews(state);
  }

  /**
   * Pair up the current mock interviewers and interviewees and spin up a
   * private thread for each pairing. Safe to call on boot to catch up on
   * missed cycles.
   */
  public async startMockInterviews(state: MockInterviewState): Promise<void> {
    const bot = this.getBot();
    const channel = await bot.channels.fetch(MOCK_INTERVIEW_CHANNEL_ID);
    if (channel === null || channel.type !== ChannelType.GuildText) {
      console.error(
        `[MOCK] configured channel ${MOCK_INTERVIEW_CHANNEL_ID} ` +
        "is not a text channel",
      );
      return;
    }

    await this.advanceSchedule(state);

    const { guild } = channel;
    // Populate the member cache so role.members reflects everyone.
    await guild.members.fetch();
    const interviewers = this.membersWithRole(guild, MOCK_INTERVIEWER_ROLE_ID);
    const interviewees = this.membersWithRole(guild, MOCK_INTERVIEWEE_ROLE_ID);

    const { pairings, leftOut } = MockInterviewService.pairParticipants(
      interviewers,
      interviewees,
    );

    if (pairings.length === 0) {
      const notEnoughEmbed = new EmbedBuilder()
        .setTitle("A mock interview round was scheduled but couldn't run.")
        .setDescription(
          `There needs to be at least one ${roleMention(MOCK_INTERVIEWER_ROLE_ID)} ` +
          `and one ${roleMention(MOCK_INTERVIEWEE_ROLE_ID)} to pair up!`,
        )
        .setColor(Colors.Red);
      await channel.send({ embeds: [notEnoughEmbed] });
      return;
    }

    const announcementEmbed = new EmbedBuilder()
      .setTitle("Mock interviews have been paired!")
      .setDescription(
        "If you signed up, check for a ping in a thread in this channel! " +
        ":briefcase:",
      )
      .addFields({
        name: "I wasn't paired!",
        value:
          `Make sure you've given yourself the ${roleMention(MOCK_INTERVIEWER_ROLE_ID)} ` +
          `and/or ${roleMention(MOCK_INTERVIEWEE_ROLE_ID)} role.`,
      })
      .setColor(Colors.Green);
    if (leftOut.length > 0) {
      announcementEmbed.addFields({
        name: "Not everyone could be matched",
        value:
          `${leftOut.length} member(s) couldn't be paired this round due to ` +
          "a large imbalance between interviewers and interviewees.",
      });
    }
    await channel.send({ embeds: [announcementEmbed] });

    const nowDate = this.dates.getDateTime(this.dates.getNow(), UCLA_TIMEZONE);
    const threadNameDate = nowDate.toLocaleString(DateTime.DATE_MED);

    for (const { interviewer, interviewee } of pairings) {
      const thread = await channel.threads.create({
        name: `Mock Interview - ${threadNameDate}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        type: ChannelType.PrivateThread,
      });

      for (const userId of [interviewer, interviewee]) {
        try {
          await thread.members.add(userId);
        } catch (error) {
          console.error(
            `[MOCK] failed to add user ${userId} to thread ${thread.id}:`,
            error,
          );
          if (error instanceof Error) {
            await channelsService.sendDevError(error);
          }
        }
      }
      await thread.join();

      const introductionEmbed = new EmbedBuilder()
        .setTitle("Time for a mock interview!")
        .setDescription(
          `${userMention(interviewer)} will be **interviewing** ` +
          `${userMention(interviewee)}. :briefcase:`,
        )
        .addFields({
          name: "How does this work?",
          value:
            "Introduce yourselves and set up a time for the interviewer to " +
            "run a practice interview for the interviewee sometime this week!",
        })
        .setFooter({
          text: "Please note that this thread is private but may still be visible to server moderators. Take any private conversations into DMs!",
        })
        .setColor(Colors.Blue);
      await thread.send({ embeds: [introductionEmbed] });
    }
  }

  private membersWithRole(guild: Guild, roleId: string): UserId[] {
    const role = guild.roles.cache.get(roleId);
    if (role === undefined) {
      return [];
    }
    return [...role.members.keys()] as UserId[];
  }

  /**
   * Randomly pair interviewers with interviewees. Everyone in the larger pool
   * is matched once; members of the smaller pool are reused (up to
   * `MAX_APPEARANCES` times each) to cover them. When the imbalance exceeds
   * that cap, the overflow of the larger pool is reported via `leftOut`.
   *
   * A member holding both roles appears in both pools and can thus be paired
   * twice; degenerate self-pairings (same person on both sides) are avoided.
   */
  public static pairParticipants(
    interviewers: UserId[],
    interviewees: UserId[],
  ): { pairings: MockPairing[]; leftOut: UserId[] } {
    const shuffledInterviewers = MockInterviewService.shuffle(interviewers);
    const shuffledInterviewees = MockInterviewService.shuffle(interviewees);

    if (shuffledInterviewers.length === 0 || shuffledInterviewees.length === 0) {
      return { pairings: [], leftOut: [] };
    }

    const interviewersSmaller =
      shuffledInterviewers.length <= shuffledInterviewees.length;
    const small = interviewersSmaller
      ? shuffledInterviewers
      : shuffledInterviewees;
    const large = interviewersSmaller
      ? shuffledInterviewees
      : shuffledInterviewers;

    const numPairs = Math.min(large.length, small.length * MAX_APPEARANCES);

    const pairings: MockPairing[] = [];
    for (let i = 0; i < numPairs; i++) {
      const smallMember = small[i % small.length];
      const largeMember = large[i];
      const interviewer = interviewersSmaller ? smallMember : largeMember;
      const interviewee = interviewersSmaller ? largeMember : smallMember;
      pairings.push({ interviewer, interviewee });
    }

    MockInterviewService.resolveSelfPairings(pairings);

    // Drop any self-pairing that couldn't be swapped away (only possible in
    // degenerate cases, e.g. a lone both-role member).
    const cleaned = pairings.filter(
      (pair) => pair.interviewer !== pair.interviewee,
    );

    const leftOut = large.slice(numPairs);
    return { pairings: cleaned, leftOut };
  }

  /**
   * Swap interviewees between pairings in place to eliminate any pairing that
   * matched a both-role member against themselves.
   */
  private static resolveSelfPairings(pairings: MockPairing[]): void {
    for (let i = 0; i < pairings.length; i++) {
      if (pairings[i].interviewer !== pairings[i].interviewee) {
        continue;
      }
      for (let k = 1; k < pairings.length; k++) {
        const j = (i + k) % pairings.length;
        const swapValid =
          pairings[i].interviewer !== pairings[j].interviewee &&
          pairings[j].interviewer !== pairings[i].interviewee;
        if (swapValid) {
          const temp = pairings[i].interviewee;
          pairings[i].interviewee = pairings[j].interviewee;
          pairings[j].interviewee = temp;
          break;
        }
      }
    }
  }

  private static shuffle(users: UserId[]): UserId[] {
    return [...users].sort(() => Math.random() - 0.5);
  }
}

export default new MockInterviewService(new SystemDateClient());
