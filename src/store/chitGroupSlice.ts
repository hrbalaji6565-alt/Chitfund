// src/store/chitGroupSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { ChitGroup, Status } from "@/app/lib/types";
import { addJoinedGroup } from "@/store/userChitSlice";

type FetchAllResponse = { success: boolean; groups: ChitGroup[] };
type SingleResponse = { success: boolean; group?: ChitGroup; message?: string };

const API_BASE = "/api/chitgroups";

async function handleFetch<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data && (data.error || data.message)) || response.statusText;
    throw new Error(msg);
  }
  return data as T;
}

/** Small runtime helpers (avoid unsafe casts) */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function getCanonicalIdFromUnknown(group: unknown): string | undefined {
  if (!isRecord(group)) return undefined;
  const idRaw = group._id ?? group.id;
  if (typeof idRaw === "string") return idRaw;
  if (typeof idRaw === "number") return String(idRaw);
  return undefined;
}

/** Thunks */

// Fetch all groups (include credentials for cookie-based sessions)
export const fetchGroups = createAsyncThunk<ChitGroup[], void, { rejectValue: string }>(
  "chitGroups/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(API_BASE, { credentials: "include" });
      const data = await handleFetch<FetchAllResponse>(res);
      return data.groups;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// Create
export const createGroup = createAsyncThunk<ChitGroup, Partial<ChitGroup>, { rejectValue: string }>(
  "chitGroups/create",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await handleFetch<SingleResponse>(res);
      if (!data.group) throw new Error(data.message || "No group returned");
      return data.group;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// Update
export const updateGroup = createAsyncThunk<
  ChitGroup,
  { id: string; updates: Partial<ChitGroup> },
  { rejectValue: string }
>("chitGroups/update", async ({ id, updates }, { rejectWithValue }) => {
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
    const data = await handleFetch<SingleResponse>(res);
    if (!data.group) throw new Error(data.message || "No group returned");
    return data.group;
  } catch (err) {
    return rejectWithValue((err as Error).message);
  }
});

// Delete
export const deleteGroup = createAsyncThunk<string, string, { rejectValue: string }>(
  "chitGroups/delete",
  async (id, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE", credentials: "include" });
      await handleFetch<{ success: boolean; message?: string }>(res);
      return id;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// Join (user join) — dispatches addJoinedGroup on success to keep userChit in sync
export const joinGroup = createAsyncThunk<
  ChitGroup,
  { id: string; userId: string },
  { rejectValue: string }
>("chitGroups/join", async ({ id, userId }, { rejectWithValue, dispatch }) => {
  try {
    const res = await fetch(`${API_BASE}/${id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    const data = await handleFetch<SingleResponse>(res);
    if (!data.group) throw new Error(data.message || "No group returned");

    // try to compute canonical id and add to userChit slice (non-fatal)
    try {
      const gid = getCanonicalIdFromUnknown(data.group) ?? id;
      dispatch(addJoinedGroup(String(gid)));
    } catch {
      // ignore if dispatch fails for any reason
    }

    return data.group;
  } catch (err) {
    return rejectWithValue((err as Error).message);
  }
});

/** Slice state */
interface ChitGroupState {
  groups: ChitGroup[];
  status: Status;
  error: string | null;
  createStatus: Status;
  updateStatus: Status;
  deleteStatus: Status;
  joinStatus: Status;
}

const initialState: ChitGroupState = {
  groups: [],
  status: "idle",
  error: null,
  createStatus: "idle",
  updateStatus: "idle",
  deleteStatus: "idle",
  joinStatus: "idle",
};

/** find index helper that relies on _id or id (both optional) */
const findIndexById = (arr: ChitGroup[], target: ChitGroup) => {
  return arr.findIndex((g) => {
    if (g._id && target._id) return g._id === target._id;
    if (g._id && target.id) return g._id === String(target.id);
    if (g.id && target._id) return String(g.id) === target._id;
    if (g.id && target.id) return String(g.id) === String(target.id);
    return false;
  });
};

const chitGroupSlice = createSlice({
  name: "chitGroups",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setGroups(state, action: PayloadAction<ChitGroup[]>) {
      state.groups = action.payload;
    },
  },
  extraReducers: (builder) => {
    // FETCH
    builder.addCase(fetchGroups.pending, (state) => {
      state.status = "loading";
      state.error = null;
    });
    builder.addCase(fetchGroups.fulfilled, (state, action: PayloadAction<ChitGroup[]>) => {
      state.status = "succeeded";
      state.groups = action.payload;
    });
    builder.addCase(fetchGroups.rejected, (state, action) => {
      state.status = "failed";
      state.error = (action.payload as string) ?? action.error?.message ?? "Failed to fetch groups";
    });

    // CREATE
    builder.addCase(createGroup.pending, (state) => {
      state.createStatus = "loading";
      state.error = null;
    });
    builder.addCase(createGroup.fulfilled, (state, action: PayloadAction<ChitGroup>) => {
      state.createStatus = "succeeded";
      state.groups.push(action.payload);
    });
    builder.addCase(createGroup.rejected, (state, action) => {
      state.createStatus = "failed";
      state.error = (action.payload as string) ?? action.error?.message ?? "Failed to create group";
    });

    // UPDATE
    builder.addCase(updateGroup.pending, (state) => {
      state.updateStatus = "loading";
      state.error = null;
    });
    builder.addCase(updateGroup.fulfilled, (state, action: PayloadAction<ChitGroup>) => {
      state.updateStatus = "succeeded";
      const updated = action.payload;
      const idx = findIndexById(state.groups, updated);
      if (idx !== -1) state.groups[idx] = { ...state.groups[idx], ...updated };
      else state.groups.push(updated);
    });
    builder.addCase(updateGroup.rejected, (state, action) => {
      state.updateStatus = "failed";
      state.error = (action.payload as string) ?? action.error?.message ?? "Failed to update group";
    });

    // DELETE
    builder.addCase(deleteGroup.pending, (state) => {
      state.deleteStatus = "loading";
      state.error = null;
    });
    builder.addCase(deleteGroup.fulfilled, (state, action: PayloadAction<string>) => {
      state.deleteStatus = "succeeded";
      state.groups = state.groups.filter((g) => (g._id ? g._id !== action.payload : String(g.id) !== action.payload));
    });
    builder.addCase(deleteGroup.rejected, (state, action) => {
      state.deleteStatus = "failed";
      state.error = (action.payload as string) ?? action.error?.message ?? "Failed to delete group";
    });

    // JOIN
    builder.addCase(joinGroup.pending, (state) => {
      state.joinStatus = "loading";
      state.error = null;
    });
    builder.addCase(joinGroup.fulfilled, (state, action: PayloadAction<ChitGroup>) => {
      state.joinStatus = "succeeded";
      const updated = action.payload;
      const idx = findIndexById(state.groups, updated);
      if (idx !== -1) state.groups[idx] = { ...state.groups[idx], ...updated };
      else state.groups.push(updated);
    });
    builder.addCase(joinGroup.rejected, (state, action) => {
      state.joinStatus = "failed";
      state.error = (action.payload as string) ?? action.error?.message ?? "Failed to join group";
    });
  },
});

export const { clearError, setGroups } = chitGroupSlice.actions;
export default chitGroupSlice.reducer;
