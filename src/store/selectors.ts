// src/store/selectors.ts
import type { RootState } from "./store";

export const selectAllGroups = (state: RootState) => state.chitGroups.groups;
export const selectGroupsStatus = (state: RootState) => state.chitGroups.status;
export const selectGroupsError = (state: RootState) => state.chitGroups.error;
