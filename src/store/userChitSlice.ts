// src/store/userChitSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface UserChitState {
  joinedIds: string[];
}

const initialState: UserChitState = {
  joinedIds: [],
};

const userChitSlice = createSlice({
  name: "userChit",
  initialState,
  reducers: {
    setJoinedGroups(state, action: PayloadAction<string[]>) {
      state.joinedIds = action.payload;
    },
    addJoinedGroup(state, action: PayloadAction<string>) {
      const id = String(action.payload);
      if (!state.joinedIds.includes(id)) state.joinedIds.push(id);
    },
    removeJoinedGroup(state, action: PayloadAction<string>) {
      const id = String(action.payload);
      state.joinedIds = state.joinedIds.filter((i) => i !== id);
    },
    clearJoinedGroups(state) {
      state.joinedIds = [];
    },
  },
});

export const { setJoinedGroups, addJoinedGroup, removeJoinedGroup, clearJoinedGroups } =
  userChitSlice.actions;

export default userChitSlice.reducer;

export const selectUserJoinedIds = (state: { userChit: UserChitState }) => state.userChit.joinedIds;
