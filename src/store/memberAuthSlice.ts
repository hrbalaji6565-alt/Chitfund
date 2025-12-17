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
  token: string | null;
}

const initialState: AuthState = {
  member: null,
  loading: false,
  error: null,
  token: null,
};

/* ---------------- LOGIN (USERID + PASSWORD) ---------------- */

export const loginMember = createAsyncThunk<
  { member: Member; token: string | null },
  { userId: string; password: string },
  { rejectValue: { message: string } }
>("auth/loginMember", async ({ userId, password }, { rejectWithValue }) => {
  try {
    const res = await fetch(AUTH_LOGIN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, password }),
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      return rejectWithValue({
        message: data?.message || "Login failed",
      });
    }

    const token: string | null = data.member?.token ?? null;
    const member: Member = data.member;

    try {
      if (token) localStorage.setItem("memberToken", token);
      localStorage.setItem("member", JSON.stringify(member));
    } catch { }

    return { member, token };


  } catch (err) {
    return rejectWithValue({
      message: err instanceof Error ? err.message : "Network error",
    });
  }
});

/* ---------------- LOGOUT ---------------- */

export const logoutMember = createAsyncThunk<
  void,
  void,
  { rejectValue: { message: string } }
>("auth/logoutMember", async (_, { rejectWithValue }) => {
  try {
    const res = await fetch(AUTH_LOGOUT_PATH, {
      method: "POST",
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      return rejectWithValue({
        message: data?.message || "Logout failed",
      });
    }

    try {
      localStorage.removeItem("member");
      localStorage.removeItem("memberToken");
    } catch { }
  } catch (err) {
    return rejectWithValue({
      message: err instanceof Error ? err.message : "Network error",
    });
  }
});

/* ---------------- FETCH CURRENT MEMBER ---------------- */

export const fetchCurrentMember = createAsyncThunk<
  { member: Member; token: string | null },
  void,
  { rejectValue: { message: string } }
>("auth/fetchCurrentMember", async (_, { rejectWithValue }) => {
  try {
    const res = await fetch(AUTH_ME_PATH, {
      method: "GET",
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      return rejectWithValue({
        message: data?.message || "Failed to fetch member",
      });
    }

    return {
      member: data.member,
      token: data.token ?? null,
    };
  } catch (err) {
    return rejectWithValue({
      message: err instanceof Error ? err.message : "Network error",
    });
  }
});

/* ---------------- SLICE ---------------- */

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateMember(state, action: PayloadAction<Member | null>) {
      state.member = action.payload;
      state.error = null;
      state.loading = false;
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
      .addCase(loginMember.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginMember.fulfilled, (state, action) => {
        state.loading = false;
        state.member = action.payload.member;
        state.token = action.payload.token;
      })
      .addCase(loginMember.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? "Login failed";
        state.member = null;
        state.token = null;
      })

      .addCase(logoutMember.fulfilled, (state) => {
        state.member = null;
        state.token = null;
      })

      .addCase(fetchCurrentMember.fulfilled, (state, action) => {
        state.member = action.payload.member;
        state.token = action.payload.token;
      });
  },
});

export const { hydrateMember, setClientToken ,clearAuth } = authSlice.actions;
export default authSlice.reducer;
