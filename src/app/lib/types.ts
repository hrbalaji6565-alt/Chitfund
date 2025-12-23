// src/app/lib/types.ts

// existing app async status type (unchanged)
export type Status = "idle" | "loading" | "succeeded" | "failed";

// Chit-specific status used for groups (UI / domain statuses)
export type ChitStatus = "Active" | "Completed" | "Pending" | "Closed" | "Inactive";

export interface ChitGroup {
  // id may be provided as _id or id (string/number) by different APIs
  _id?: string;
  id?: string | number;

  // core name fields (some APIs use `name`, some `groupName`)
  name?: string;
  groupName?: string;

  // original fields you already had (kept & made optional where appropriate)
  chitValue?: number;
  monthlyInstallment?: number;
  totalMonths?: number;
  totalMembers?: number;

  // financial fields used by the UI (make optional if server may omit)
  totalAmount?: number;
  collectedAmount?: number;
  pendingAmount?: number;

  // schedule / dates
  startDate?: string;     // ISO date string
  endDate?: string;       // your existing endDate
  maturityDate?: string;  // alias used in UI if present

  // installments tracking
  numberOfInstallments?: number;
  completedInstallments?: number;

  // other display / domain fields
  interestRate?: number;
  penaltyPercent?: number;
  remarks?: string;
  members?: string[]; // keep as previously
    winners?: string[];

  // timestamps
  createdAt?: string;
  updatedAt?: string;

  // domain status
  status?: ChitStatus;

  // allow extra backend fields without TS errors
  [k: string]: unknown;
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

export interface Contribution {
  _id?: string;
  chitId: string;
  memberId: string;
  amount: number;
  date: string; // ISO
  monthIndex: number; // 1..totalMonths (which month this contribution counts for)
}

export interface AuctionResult {
  _id?: string;
  chitId: string;
  monthIndex: number;
  totalPot: number; // e.g., chitValue
  winningMemberId: string;
  winningBidAmount: number; // discount (amount kept as discount)
  winningPayout: number; // amount the winner actually takes (totalPot - winningBidAmount)
  distributedToMembers: Array<{ memberId: string; amount: number }>;
  createdAt?: string;
}