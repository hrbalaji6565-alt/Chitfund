// src/store/adminSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import toast from "react-hot-toast";
import Cookies from "js-cookie";

/** ---- Types ---- */
interface AdminState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

interface LoginArgs {
  email: string;
  password: string;
}

interface RegisterArgs {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
}

/** Minimal expected shape from the auth endpoints */
interface AuthResponse {
  token: string;
  // add additional known fields if your API returns them
}

/** ---- Helpers ---- */
/** Narrow unknown errors into a readable string without using `any`. */
function getErrorMessage(err: unknown): string {
  // axios provides isAxiosError helper
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === "object" && "message" in data) {
      const maybeMessage = (data as Record<string, unknown>).message;
      if (typeof maybeMessage === "string") return maybeMessage;
    }
    // fallback to axios error message (string)
    return err.message ?? "Request failed";
  }

  if (err instanceof Error) return err.message;
  return String(err);
}

/** ---- Initial state ---- */
const initialState: AdminState = {
  token: null,
  loading: false,
  error: null,
};

/** ---- Thunks ---- */
export const loginAdmin = createAsyncThunk<
  AuthResponse,
  LoginArgs,
  { rejectValue: string }
>("admin/loginAdmin", async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await axios.post<AuthResponse>(
      "/api/admin/login",
      { email, password },
      { withCredentials: true }
    );

    // persist token for middleware / SSR checks
    Cookies.set("adminToken", res.data.token, {
      expires: 1,
      path: "/",
      sameSite: "strict",
    });

    toast.success("Login successful!");
    return res.data;
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    toast.error(message);
    return rejectWithValue(message);
  }
});

export const registerAdmin = createAsyncThunk<
  AuthResponse,
  RegisterArgs,
  { rejectValue: string }
>("admin/registerAdmin", async (payload, { rejectWithValue }) => {
  try {
    const res = await axios.post<AuthResponse>("/api/admin/register", payload);

    toast.success("Admin registered successfully!");
    return res.data;
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    toast.error(message);
    return rejectWithValue(message);
  }
});

/** Optional: async logout to call backend. Keeps side-effects out of reducers. */
export const logoutAdmin = createAsyncThunk<void, void, { rejectValue: string }>(
  "admin/logoutAdmin",
  async (_, { rejectWithValue }) => {
    try {
      // remove local cookie immediately (client-side)
      Cookies.remove("adminToken");

      // notify server (fire-and-forget from the perspective of UI; still awaited)
      await axios.post("/api/admin/logout");

      toast.success("Logged out");
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

/** ---- Slice ---- */
const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    /**
     * Synchronous local logout — clears local token and cookie.
     * Use this when you just want to clear client-state instantly.
     */
    logout: (state) => {
      state.token = null;
      Cookies.remove("adminToken");
      state.error = null;
      // Keep reducer pure: do NOT call axios here.
      toast.success("Logged out");
    },
  },
  extraReducers: (builder) => {
    builder
      // loginAdmin
      .addCase(loginAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        // logged in
      })
      .addCase(loginAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Login failed";
      })

      // registerAdmin
      .addCase(registerAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token ?? null;
      })
      .addCase(registerAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Registration failed";
      })

      // logoutAdmin (async backend logout)
      .addCase(logoutAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutAdmin.fulfilled, (state) => {
        state.loading = false;
        state.token = null;
      })
      .addCase(logoutAdmin.rejected, (state, action) => {
        state.loading = false;
        // keep token cleared client-side regardless, but show error if available
        state.token = null;
        state.error = action.payload ?? "Logout failed";
      });
  },
});

export const { logout } = adminSlice.actions;
export default adminSlice.reducer;
