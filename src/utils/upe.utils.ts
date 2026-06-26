import { type ColorResolvable } from "discord.js";

import env from "../env";
import type { UrlString } from "../types/branded.types";
import { getEnumFromName } from "../types/generic.types";
import { BidirectionalMap } from "./data.utils";
import {
  ADVOCACY_ROLE_ID,
  ALUMNI_ROLE_ID,
  CORPORATE_ROLE_ID,
  DESIGN_AND_PUBLICITY_ROLE_ID,
  EVP_ROLE_ID,
  FINANCE_AND_FACILITIES_ROLE_ID,
  INDUCTION_AND_MEMBERSHIP_ROLE_ID,
  IVP_ROLE_ID,
  MENTORSHIP_ROLE_ID,
  PRESIDENT_ROLE_ID,
  SOCIAL_ROLE_ID,
  TUTORING_ROLE_ID,
  WEB_ROLE_ID,
} from "./snowflakes.utils";

export const UPE_BLUE: ColorResolvable = "#3067d3";

export enum Committee {
  Web = "Web",
  Advocacy = "Advocacy",
  DesignAndPublicity = "Design & Publicity",
  FinanceAndFacilities = "Finance & Facilities",
  InductionAndMembership = "Induction & Membership",
  Mentorship = "Mentorship",
  Social = "Social",
  Tutoring = "Tutoring",
  Corporate = "Corporate",
  Alumni = "Alumni",
  President = "President",
  InternalVicePresident = "Internal Vice President",
  ExternalVicePresident = "External Vice President",
}

export type CommitteeName = `${Committee}`;

export const COMMITTEE_NAMES: CommitteeName[] = Object.values(Committee);

export function getCommitteeFromName(
  name: CommitteeName,
): Committee {
  const committee = getEnumFromName(Committee, name);
  if (committee === undefined) {
    throw new Error(
      `${name} should have had a valid reverse mapping in committee enum.`,
    );
  }
  return committee;
}

export const COMMITTEE_ROLE_MAP = new BidirectionalMap([
  [Committee.FinanceAndFacilities, FINANCE_AND_FACILITIES_ROLE_ID],
  [Committee.Advocacy, ADVOCACY_ROLE_ID],
  [Committee.Alumni, ALUMNI_ROLE_ID],
  [Committee.DesignAndPublicity, DESIGN_AND_PUBLICITY_ROLE_ID],
  [Committee.Mentorship, MENTORSHIP_ROLE_ID],
  [Committee.Tutoring, TUTORING_ROLE_ID],
  [Committee.Social, SOCIAL_ROLE_ID],
  [Committee.Web, WEB_ROLE_ID],
  [Committee.Corporate, CORPORATE_ROLE_ID],
  [Committee.InductionAndMembership, INDUCTION_AND_MEMBERSHIP_ROLE_ID],
  [Committee.President, PRESIDENT_ROLE_ID],
  [Committee.InternalVicePresident, IVP_ROLE_ID],
  [Committee.ExternalVicePresident, EVP_ROLE_ID],
]);

export enum TeamType {
  Exec = "Exec",
  Core = "Core",
  Internal = "Internal",
  External = "External",
};

export type TeamTypeName = `${TeamType}`;

export const TEAM_TYPE_NAMES: TeamTypeName[] = Object.values(TeamType);

export enum Title {
  Exec = "Exec",
  Director = "Director",
  Chair = "Chair",
  // NOTE: There used to be officer "interns" as well, but that system has been
  // abandoned.
}

export type TitleName = `${Title}`;

export function getTitleFromName(
  name: TitleName,
): Title {
  const title = getEnumFromName(Title, name);
  if (title === undefined) {
    throw new Error(
      `${name} should have had a valid reverse mapping in title enum.`,
    );
  }
  return title;
}

export const INDUCTION_LINKTREE
  = "https://linktr.ee/upe_induction" as UrlString;
export const UPE_LINKTREE
  = "https://linktr.ee/upeucla" as UrlString;
export const UPE_WEBSITE
  = "https://upe.seas.ucla.edu" as UrlString;
export const TUTORING_SCHEDULE_WEBPAGE
  = "https://upe.seas.ucla.edu/tutoring/" as UrlString;

export const {
  INDUCTION_EMAIL,
  PUBLIC_REQUIREMENT_TRACKER_SPREADSHEET_URL,
  REQUIREMENTS_DOCUMENT_LINK,
  SEASON_ID,
} = env;
