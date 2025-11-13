// src/store/memberAuthSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Member } from "@/app/lib/types";

const AUTH_LOGIN_PATH = "/api/auth/login";
const AUTH_LOGOUT_PATH = "/api/auth/logout";
const AUTH_ME_PATH = "/api/auth/me";

export interface AuthState {
  member: Member | null;
  loading: boolean;
  error: string | null;
  token?: string | null;
}

const initialState: AuthState = {
  member: null,
  loading: false,
  error: null,
  token: null,
};

/** Small safe helpers **/
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function safeJsonParse<T = unknown>(input: unknown): T | null {
  try {
    if (input === null || input === undefined) return null;
    return input as T;
  } catch {
    return null;
  }
}

function getStringProp(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null;
  const v = obj[key];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function getBooleanProp(obj: unknown, key: string): boolean | null {
  if (!isRecord(obj)) return null;
  const v = obj[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() === "false") return false;
  }
  return null;
}

function getUnknownProp(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  return obj[key];
}

function extractTokenFromResponse(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const tokenRoot = getStringProp(data, "token");
  if (tokenRoot) return tokenRoot;

  // maybe token nested in member/user
  const memberCandidate = getUnknownProp(data, "member") ?? getUnknownProp(data, "user");
  if (isRecord(memberCandidate)) {
    const tokenMember = getStringProp(memberCandidate, "token");
    if (tokenMember) return tokenMember;
  }
  return null;
}

function extractMemberCandidate(data: Record<string, unknown> | null): unknown | null {
  if (!data) return null;
  return getUnknownProp(data, "member") ?? getUnknownProp(data, "user") ?? null;
}

function normalizeMemberForStorage(memberRaw: unknown, token?: string | null) {
  // create minimal member object to put in localStorage (id, name, email, token, role, avatarUrl)
  const id = isRecord(memberRaw) ? (getStringProp(memberRaw, "id") ?? getStringProp(memberRaw, "_id") ?? "") : "";
  const name = isRecord(memberRaw) ? (getStringProp(memberRaw, "name") ?? "") : "";
  const email = isRecord(memberRaw) ? (getStringProp(memberRaw, "email") ?? "") : "";

  // role: try role or roles[0]
  let role: unknown = undefined;
  if (isRecord(memberRaw)) {
    role = memberRaw.role ?? (memberRaw.roles ?? undefined);
  }
  let roleStr = "user";
  if (typeof role === "string") roleStr = role;
  else if (Array.isArray(role) && role.length > 0 && typeof role[0] === "string") roleStr = role[0];

  const avatarUrl =
    isRecord(memberRaw) ? (getStringProp(memberRaw, "avatarUrl") ?? getStringProp(memberRaw, "photo") ?? undefined) : undefined;

  return {
    id,
    name,
    email,
    token: token ?? undefined,
    role: roleStr,
    avatarUrl,
  } as Record<string, unknown>;
}

/** Thunks **/

export const loginMember = createAsyncThunk<
  { member: Member; token?: string | null },
  { email: string; password: string },
  { rejectValue: string }
>("auth/loginMember", async (creds, { rejectWithValue }) => {
  try {
    const res = await fetch(AUTH_LOGIN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(creds),
    });

    const raw = await res.json().catch(() => ({} as unknown));
    const data = safeJsonParse<Record<string, unknown>>(raw) ?? {};

    // compute success flag if provided, otherwise default to true for ok responses
    const successFlag = getBooleanProp(data, "success");
    const success = successFlag === null ? res.ok : successFlag === true;

    const memberPresent =
      getUnknownProp(data, "member") !== undefined && getUnknownProp(data, "member") !== null;

    if (!res.ok || (!success && !memberPresent)) {
      const msg = (getStringProp(data, "message") ?? getStringProp(data, "error")) ?? `Login failed (${res.status})`;
      return rejectWithValue(String(msg));
    }

    const token = extractTokenFromResponse(data);
    const memberCandidate = extractMemberCandidate(data);
    const member = (memberCandidate as unknown as Member) ?? ({} as Member);

    try {
      if (token) localStorage.setItem("memberToken", token);
      if (member && Object.keys(member as Record<string, unknown>).length > 0) {
        const storeObj = normalizeMemberForStorage(member, token);
        localStorage.setItem("member", JSON.stringify(storeObj));
      }
    } catch {
      // ignore storage errors
    }

    return { member, token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return rejectWithValue(msg);
  }
});

export const logoutMember = createAsyncThunk<void, void, { rejectValue: string }>(
  "auth/logoutMember",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(AUTH_LOGOUT_PATH, {
        method: "POST",
        credentials: "include",
      });
      const raw = await res.json().catch(() => ({} as unknown));
      const data = safeJsonParse<Record<string, unknown>>(raw) ?? {};

      const successFlag = getBooleanProp(data, "success");
      const hasError = getUnknownProp(data, "error") !== undefined && getUnknownProp(data, "error") !== null;

      if (!res.ok || (successFlag === false || hasError)) {
        const msg = (getStringProp(data, "message") ?? getStringProp(data, "error")) ?? `Logout failed (${res.status})`;
        return rejectWithValue(String(msg));
      }

      try {
        localStorage.removeItem("member");
        localStorage.removeItem("memberToken");
      } catch {
        // ignore
      }

      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      return rejectWithValue(msg);
    }
  }
);

export const fetchCurrentMember = createAsyncThunk<
  { member: Member; token?: string | null },
  void,
  { rejectValue: string }
>("auth/fetchCurrentMember", async (_, { rejectWithValue }) => {
  try {
    const res = await fetch(AUTH_ME_PATH, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });
    const raw = await res.json().catch(() => ({} as unknown));
    const data = safeJsonParse<Record<string, unknown>>(raw) ?? {};

    if (!res.ok) {
      const msg = (getStringProp(data, "message") ?? getStringProp(data, "error")) ?? `Failed to fetch member (${res.status})`;
      return rejectWithValue(String(msg));
    }

    const token = extractTokenFromResponse(data);
    const memberCandidate = extractMemberCandidate(data);
    const member = (memberCandidate as unknown as Member) ?? ({} as Member);

    try {
      if (token) localStorage.setItem("memberToken", token);
      if (member && Object.keys(member as Record<string, unknown>).length > 0) localStorage.setItem("member", JSON.stringify(member));
    } catch {
      // ignore
    }

    return { member, token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return rejectWithValue(msg);
  }
});

/** Slice **/

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateMember(state, action: PayloadAction<Member | null>) {
      state.member = action.payload;
      state.error = null;
      state.loading = false;
    },
    clearAuthError(state) {
      state.error = null;
    },
    setClientToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
    clearAuth(state) {
      state.member = null;
      state.token = null;
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(loginMember.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginMember.fulfilled, (state, action: PayloadAction<{ member: Member; token?: string | null }>) => {
        state.loading = false;
        state.member = action.payload.member;
        state.token = action.payload.token ?? null;
        state.error = null;
      })
      .addCase(loginMember.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error?.message ?? "Login failed";
        state.member = null;
        state.token = null;
      })

      // logout
      .addCase(logoutMember.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutMember.fulfilled, (state) => {
        state.loading = false;
        state.member = null;
        state.token = null;
      })
      .addCase(logoutMember.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error?.message ?? "Logout failed";
        state.member = null;
        state.token = null;
      })

      // fetchCurrentMember
      .addCase(fetchCurrentMember.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentMember.fulfilled, (state, action: PayloadAction<{ member: Member; token?: string | null }>) => {
        state.loading = false;
        state.member = action.payload.member;
        state.token = action.payload.token ?? null;
        state.error = null;
      })
      .addCase(fetchCurrentMember.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) ?? action.error?.message ?? "Failed to fetch member";
        state.member = null;
        state.token = null;
      });
  },
});

export const { hydrateMember, clearAuthError, setClientToken, clearAuth } = authSlice.actions;
export default authSlice.reducer;

/**
 * Utility to check membership in common shapes returned by various backends.
 */
export function memberHasJoined(member: Member | null, groupId: string): boolean {
  if (!member) return false;

  const asRec = member as unknown as Record<string, unknown>;

  const arraysToCheck = [
    getUnknownProp(asRec, "joinedGroupIds"),
    getUnknownProp(asRec, "joinedGroups"),
    getUnknownProp(asRec, "groups"),
    getUnknownProp(asRec, "groupIds"),
    getUnknownProp(asRec, "memberOf"),
  ] as unknown[];

  for (const arr of arraysToCheck) {
    if (Array.isArray(arr)) {
      if (
        arr.some((entry) => {
          if (typeof entry === "string") return String(entry) === String(groupId);
          if (isRecord(entry)) {
            const id = getStringProp(entry, "_id") ?? getStringProp(entry, "id") ?? "";
            return String(id) === String(groupId);
          }
          return false;
        })
      ) {
        return true;
      }
    }
  }

  return false;
}
