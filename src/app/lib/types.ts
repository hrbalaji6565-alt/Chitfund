export type Status = "idle" | "loading" | "succeeded" | "failed";

export interface ChitGroup {
  id: string | undefined;
  _id?: string;
  name: string;
  chitValue: number;
  monthlyInstallment: number;
  totalMonths: number;
  totalMembers: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Closed" | "Inactive";
  remarks?: string;
    members?: string[]; 
  penaltyPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

// src/store/types.ts
export type MemberStatus = "Active" | "Inactive";

/**
 * Member type made tolerant to different backend shapes:
 * - id may be number or string
 * - some backends use _id
 * - include optional role/roles and avatar fields used elsewhere in the app
 * - include several flexible join-related fields used by memberHasJoined etc.
 */
export interface Member {
  _id?: string;
  id?: string | number; // accept both string and number (resolves string|number -> number mismatch)

  // core profile
  name?: string;
  mobile?: string;
  email?: string;

  // optional profile fields
  address?: string;
  joiningDate?: string; // ISO yyyy-mm-dd
  status?: MemberStatus | string;
  totalPaid?: number;
  pendingAmount?: number;

  // avatar fields (different APIs use different keys)
  avatarImage?: string | null;
  avatarUrl?: string | null;
  photo?: string | null;

  // authentication / role related
  token?: string | null;
  role?: string;
  roles?: string[];

  // membership/group related (various backend shapes)
  group?: string | null; // primary group _id
  groupName?: string | null;
  joinedGroupIds?: Array<string | number>;
  joinedGroups?: unknown[];
  groups?: unknown[];
  groupIds?: Array<string | number>;
  memberOf?: unknown[];

  // timestamps
  createdAt?: string;
  updatedAt?: string;

  // do not include password here

  // flexible catch-all for unexpected backend fields
  [k: string]: unknown;
}

export type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";
