import { configureStore } from "@reduxjs/toolkit";
import adminReducer from "./adminSlice";
import chitGroupReducer from "./chitGroupSlice";
import memberReducer from "./memberSlice";
import authReducer from "./memberAuthSlice";
import userChitReducer from "./userChitSlice";
import loanReducer from "./loanSlice";

export const store = configureStore({
  reducer: {
    admin: adminReducer,
    chitGroups: chitGroupReducer,
    members: memberReducer,
    auth: authReducer,
    userChit: userChitReducer,
    loans: loanReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
