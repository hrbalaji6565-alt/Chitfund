// src/store/memberSlice.ts
import { AsyncStatus, Member } from "@/app/lib/types";
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

const API_BASE = "/api/members";

/** Small fetch helper */
async function handleFetch<T>(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || res.statusText || "Request failed";
    throw new Error(message);
  }
  return data as T;
}

/** Thunks */

// fetch all members
export const fetchMembers = createAsyncThunk<Member[], void, { rejectValue: string }>(
  "members/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(API_BASE);
      const data = await handleFetch<{ success: boolean; members: Member[] }>(res);
      return data.members || [];
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// create member (payload will be Form-like object, including base64 images)
export const createMember = createAsyncThunk<Member, Partial<Member>, { rejectValue: string }>(
  "members/create",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await handleFetch<{ success: boolean; member: Member }>(res);
      return data.member;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// update member by id
export const updateMember = createAsyncThunk<Member, { id: string; updates: Partial<Member> }, { rejectValue: string }>(
  "members/update",
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await handleFetch<{ success: boolean; member: Member }>(res);
      return data.member;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// delete member
export const deleteMember = createAsyncThunk<string, string, { rejectValue: string }>(
  "members/delete",
  async (id, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      await handleFetch<{ success: boolean; message?: string }>(res);
      return id;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

/** Slice state */
interface MemberState {
  members: Member[];
  status: AsyncStatus;
  error: string | null;
  createStatus: AsyncStatus;
  updateStatus: AsyncStatus;
  deleteStatus: AsyncStatus;
}

const initialState: MemberState = {
  members: [],
  status: "idle",
  error: null,
  createStatus: "idle",
  updateStatus: "idle",
  deleteStatus: "idle",
};

const memberSlice = createSlice({
  name: "members",
  initialState,
  reducers: {
    setMembers(state, action: PayloadAction<Member[]>) {
      state.members = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers(builder) {
    // FETCH
    builder.addCase(fetchMembers.pending, (state) => {
      state.status = "loading";
      state.error = null;
    });
    builder.addCase(fetchMembers.fulfilled, (state, action: PayloadAction<Member[]>) => {
      state.status = "succeeded";
      state.members = action.payload;
    });
    builder.addCase(fetchMembers.rejected, (state, action) => {
      state.status = "failed";
      state.error = action.payload ?? action.error.message ?? "Failed to fetch members";
    });

    // CREATE
    builder.addCase(createMember.pending, (state) => {
      state.createStatus = "loading";
      state.error = null;
    });
    builder.addCase(createMember.fulfilled, (state, action: PayloadAction<Member>) => {
      state.createStatus = "succeeded";
      // Add to top
      state.members.unshift(action.payload);
    });
    builder.addCase(createMember.rejected, (state, action) => {
      state.createStatus = "failed";
      state.error = action.payload ?? action.error.message ?? "Failed to create member";
    });

    // UPDATE
    builder.addCase(updateMember.pending, (state) => {
      state.updateStatus = "loading";
      state.error = null;
    });
    builder.addCase(updateMember.fulfilled, (state, action: PayloadAction<Member>) => {
      state.updateStatus = "succeeded";
      const updated = action.payload;
      const idx = state.members.findIndex((m) => m._id === updated._id || m.id === updated.id);
      if (idx !== -1) state.members[idx] = updated;
      else state.members.unshift(updated);
    });
    builder.addCase(updateMember.rejected, (state, action) => {
      state.updateStatus = "failed";
      state.error = action.payload ?? action.error.message ?? "Failed to update member";
    });

    // DELETE
    builder.addCase(deleteMember.pending, (state) => {
      state.deleteStatus = "loading";
      state.error = null;
    });
    builder.addCase(deleteMember.fulfilled, (state, action: PayloadAction<string>) => {
      state.deleteStatus = "succeeded";
      state.members = state.members.filter((m) => m._id !== action.payload && String(m.id) !== action.payload);
    });
    builder.addCase(deleteMember.rejected, (state, action) => {
      state.deleteStatus = "failed";
      state.error = action.payload ?? action.error.message ?? "Failed to delete member";
    });
  },
});

export const { setMembers, clearError } = memberSlice.actions;
export default memberSlice.reducer;
