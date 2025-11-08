import { ChitGroup, Status } from "@/app/lib/types";
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

type FetchAllResponse = { success: boolean; groups: ChitGroup[] };
type SingleResponse = { success: boolean; group?: ChitGroup; message?: string };

const API_BASE = "/api/chitgroups";

/** Small helper to parse fetch responses */
async function handleFetch<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    // try to pick helpful message fields
    const msg = (data && (data.error || data.message)) || response.statusText;
    throw new Error(msg);
  }
  return data as T;
}

/** Thunks */
// Fetch all groups
export const fetchGroups = createAsyncThunk<ChitGroup[], void, { rejectValue: string }>(
  "chitGroups/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(API_BASE);
      const data = await handleFetch<FetchAllResponse>(res);
      return data.groups;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// Create a group
export const createGroup = createAsyncThunk<ChitGroup, Partial<ChitGroup>, { rejectValue: string }>(
  "chitGroups/create",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

// Update a group
export const updateGroup = createAsyncThunk<ChitGroup, { id: string; updates: Partial<ChitGroup> }, { rejectValue: string }>(
  "chitGroups/update",
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await handleFetch<SingleResponse>(res);
      if (!data.group) throw new Error(data.message || "No group returned");
      return data.group;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// Delete a group
export const deleteGroup = createAsyncThunk<string, string, { rejectValue: string }>(
  "chitGroups/delete",
  async (id, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      const data = await handleFetch<{ success: boolean; message?: string }>(res);
      return id;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

/** Slice state */
interface ChitGroupState {
  groups: ChitGroup[];
  status: Status;
  error: string | null;
  createStatus: Status;
  updateStatus: Status;
  deleteStatus: Status;
}

const initialState: ChitGroupState = {
  groups: [],
  status: "idle",
  error: null,
  createStatus: "idle",
  updateStatus: "idle",
  deleteStatus: "idle",
};

const chitGroupSlice = createSlice({
  name: "chitGroups",
  initialState,
  reducers: {
    // local-only reducer examples if you want optimistic UI or clearing errors
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
      state.error = action.payload ?? action.error.message ?? "Failed to fetch groups";
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
      state.error = action.payload ?? action.error.message ?? "Failed to create group";
    });

    // UPDATE
    builder.addCase(updateGroup.pending, (state) => {
      state.updateStatus = "loading";
      state.error = null;
    });
    builder.addCase(updateGroup.fulfilled, (state, action: PayloadAction<ChitGroup>) => {
      state.updateStatus = "succeeded";
      const updated = action.payload;
      const idx = state.groups.findIndex((g) => g._id === updated._id);
      if (idx !== -1) state.groups[idx] = updated;
      else state.groups.push(updated); // if not present, add
    });
    builder.addCase(updateGroup.rejected, (state, action) => {
      state.updateStatus = "failed";
      state.error = action.payload ?? action.error.message ?? "Failed to update group";
    });

    // DELETE
    builder.addCase(deleteGroup.pending, (state) => {
      state.deleteStatus = "loading";
      state.error = null;
    });
    builder.addCase(deleteGroup.fulfilled, (state, action: PayloadAction<string>) => {
      state.deleteStatus = "succeeded";
      state.groups = state.groups.filter((g) => g._id !== action.payload);
    });
    builder.addCase(deleteGroup.rejected, (state, action) => {
      state.deleteStatus = "failed";
      state.error = action.payload ?? action.error.message ?? "Failed to delete group";
    });
  },
});

export const { clearError, setGroups } = chitGroupSlice.actions;
export default chitGroupSlice.reducer;
