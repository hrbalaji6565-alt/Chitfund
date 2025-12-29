import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

interface EMI {
  monthNumber: number;
  emiAmount: number;
  dueDate: string;
  penalty: number;
  paidAmount: number;
  status: string;
  isCurrentMonth?: boolean;
  isPastMonth?: boolean;
  isFutureMonth?: boolean;
  canPay?: boolean;
  paymentMode?: string;
  paymentDate?: string;
  transactionId?: string;
  utrNumber?: string;
}

interface Loan {
  _id: string;
  loanName?: string;
  memberName?: string;
  principal: number;
  emiAmount: number;
  status: string;
  startDate: string;
  endDate?: string;
  durationMonths: number;
  durationType?: "MONTHS" | "DAYS";
  durationValue?: number;
  monthlyInterestPercent?: number;
  schedule?: EMI[];
}

interface LoanState {
  loans: Loan[];
  currentLoan: Loan | null;
  loading: boolean;
  error: string | null;
}

const initialState: LoanState = {
  loans: [],
  currentLoan: null,
  loading: false,
  error: null,
};

// Fetch user loans
export const fetchUserLoans = createAsyncThunk<
  Loan[],
  string,
  { rejectValue: { message: string } }
>("loans/fetchUserLoans", async (token, { rejectWithValue }) => {
  try {
    const response = await fetch("/api/user/loans", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return rejectWithValue({
        message: data.message || "Failed to fetch loans",
      });
    }

    return data.loans || [];
  } catch (error) {
    return rejectWithValue({
      message: "Network error while fetching loans",
    });
  }
});

// Fetch loan details
export const fetchLoanDetails = createAsyncThunk<
  Loan,
  { loanId: string; token: string },
  { rejectValue: { message: string } }
>("loans/fetchLoanDetails", async ({ loanId, token }, { rejectWithValue }) => {
  try {
    const response = await fetch(`/api/user/loans/${loanId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return rejectWithValue({
        message: data.message || "Failed to fetch loan details",
      });
    }

    return data.loan;
  } catch (error) {
    return rejectWithValue({
      message: "Network error while fetching loan details",
    });
  }
});

// Pay EMI
export const payEMI = createAsyncThunk<
  { updatedEmi: EMI; transactionId: string },
  {
    loanId: string;
    monthNumber: number;
    paymentMode: string;
    amount: number;
    utrNumber?: string;
    token: string;
  },
  { rejectValue: { message: string } }
>("loans/payEMI", async ({ loanId, monthNumber, paymentMode, amount, utrNumber, token }, { rejectWithValue }) => {
  try {
    const response = await fetch(`/api/user/loans/${loanId}/pay-emi`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        monthNumber,
        paymentMode,
        amount,
        utrNumber,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return rejectWithValue({
        message: data.message || "Failed to process EMI payment",
      });
    }

    return {
      updatedEmi: data.updatedEmi,
      transactionId: data.transactionId,
    };
  } catch (error) {
    return rejectWithValue({
      message: "Network error while processing payment",
    });
  }
});

const loanSlice = createSlice({
  name: "loans",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentLoan: (state) => {
      state.currentLoan = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user loans
      .addCase(fetchUserLoans.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserLoans.fulfilled, (state, action) => {
        state.loading = false;
        state.loans = action.payload;
      })
      .addCase(fetchUserLoans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch loans";
      })
      
      // Fetch loan details
      .addCase(fetchLoanDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLoanDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentLoan = action.payload;
      })
      .addCase(fetchLoanDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch loan details";
      })
      
      // Pay EMI
      .addCase(payEMI.pending, (state) => {
        state.error = null;
      })
      .addCase(payEMI.fulfilled, (state, action) => {
        // Update the current loan's schedule if it exists
        if (state.currentLoan && state.currentLoan.schedule) {
          const emiIndex = state.currentLoan.schedule.findIndex(
            (emi) => emi.monthNumber === action.payload.updatedEmi.monthNumber
          );
          if (emiIndex !== -1) {
            state.currentLoan.schedule[emiIndex] = action.payload.updatedEmi;
          }
        }
      })
      .addCase(payEMI.rejected, (state, action) => {
        state.error = action.payload?.message || "Failed to process EMI payment";
      });
  },
});

export const { clearError, clearCurrentLoan } = loanSlice.actions;
export default loanSlice.reducer;