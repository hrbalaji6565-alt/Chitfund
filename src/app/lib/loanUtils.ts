// src/app/lib/loanUtils.ts

export type LoanScheduleItem = {
  monthIndex: number;
  dueDate: string;       // ISO string
  baseAmount: number;
  interestAmount: number;
  emiAmount: number;
};

type InstallmentResult = {
  emi: number;
  basePerMonth: number;
  interestPerMonth: number;
};

// simple flat interest:
// base = principal / tenure
// interest = principal * monthlyRate% (every month same)
export function calculateInstallment(
  principal: number,
  tenureMonths: number,
  monthlyInterestRatePercent: number,
): InstallmentResult {
  if (tenureMonths <= 0) {
    throw new Error("tenureMonths must be > 0");
  }

  const basePerMonth = principal / tenureMonths;
  const interestPerMonth =
    principal * (monthlyInterestRatePercent / 100);

  const emi = basePerMonth + interestPerMonth;

  return {
    emi: Math.round(emi),
    basePerMonth: Math.round(basePerMonth),
    interestPerMonth: Math.round(interestPerMonth),
  };
}

type LoanScheduleInput = {
  principal: number;
  tenureMonths: number;
  monthlyInterestRate: number;
  installmentAmount: number;
  startDate: Date;
  dueDayOfMonth: number;
};

// har month same base + same interest + same EMI
export function buildLoanSchedule(
  input: LoanScheduleInput,
): LoanScheduleItem[] {
  const {
    principal,
    tenureMonths,
    monthlyInterestRate,
    installmentAmount,
    startDate,
    dueDayOfMonth,
  } = input;

  if (tenureMonths <= 0) return [];

  const { basePerMonth, interestPerMonth } = calculateInstallment(
    principal,
    tenureMonths,
    monthlyInterestRate,
  );

  const schedule: LoanScheduleItem[] = [];

  for (let i = 1; i <= tenureMonths; i += 1) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + (i - 1));
    d.setDate(dueDayOfMonth);

    schedule.push({
      monthIndex: i,
      dueDate: d.toISOString(),
      baseAmount: basePerMonth,
      interestAmount: interestPerMonth,
      emiAmount: installmentAmount,
    });
  }

  return schedule;
}

// penalty = EMI * penaltyRate% * monthsLate
export function computePenalty(
  emiAmount: number,
  penaltyRatePercent: number,
  dueDate: Date | string,
  now: Date,
): number {
  const due =
    typeof dueDate === "string" ? new Date(dueDate) : dueDate;

  if (Number.isNaN(due.getTime()) || now <= due) return 0;

  let monthsLate =
    (now.getFullYear() - due.getFullYear()) * 12 +
    (now.getMonth() - due.getMonth());

  if (now.getDate() > due.getDate()) {
    monthsLate += 1;
  }

  if (monthsLate < 1) monthsLate = 1;

  const penaltyPerMonth =
    (emiAmount * penaltyRatePercent) / 100;

  return Math.round(penaltyPerMonth * monthsLate);
}
