export type Status = "idle" | "loading" | "succeeded" | "failed";

export interface ChitGroup {
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

export interface Member {
  _id?: string;
  id?: number; // UI legacy id — server uses _id
  name: string;
  mobile: string;
  email: string;
  address?: string;
  joiningDate?: string; // ISO yyyy-mm-dd
  status: MemberStatus;
  totalPaid?: number;
  pendingAmount?: number;
  aadhaarImage?: string | null; // data URL if client-side until uploaded
  govIdImage?: string | null;
  avatarImage?: string | null;
  createdAt?: string;
  updatedAt?: string;
    group?: string | null;     // store ChitGroup _id as string, or null
  groupName?: string | null;
  // do not include password in store responses
}

export type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";
