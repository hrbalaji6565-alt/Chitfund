/**
 * Utility functions for loan and EMI calculations
 */

export interface EMIMonth {
  month: number;
  year: number;
  monthName: string;
}

/**
 * Get current month info
 */
export function getCurrentMonth(): EMIMonth {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const monthName = now.toLocaleDateString("en-IN", { month: "long" });
  
  return { month, year, monthName };
}

/**
 * Check if two dates are in the same month
 */
export function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getMonth() === date2.getMonth() && 
         date1.getFullYear() === date2.getFullYear();
}

/**
 * Check if a date is in the current month
 */
export function isCurrentMonth(date: Date): boolean {
  const now = new Date();
  return isSameMonth(date, now);
}

/**
 * Check if a date is in the past (before current month)
 */
export function isPastMonth(date: Date): boolean {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateMonthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  
  return dateMonthStart < currentMonthStart;
}

/**
 * Check if a date is in the future (after current month)
 */
export function isFutureMonth(date: Date): boolean {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateMonthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  
  return dateMonthStart > currentMonthStart;
}

/**
 * Generate transaction ID
 */
export function generateTransactionId(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN${timestamp.slice(-6)}${random}`;
}

/**
 * Calculate EMI amount using reducing balance method
 */
export function calculateEMI(principal: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return principal / months;
  
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
              (Math.pow(1 + monthlyRate, months) - 1);
  
  return Math.round(emi);
}

/**
 * Get loan status based on EMI schedule
 */
export function getLoanStatus(schedule: any[]): string {
  if (!schedule || schedule.length === 0) return "Active";
  
  const totalEMIs = schedule.length;
  const paidEMIs = schedule.filter(emi => emi.status === "paid").length;
  const overdueEMIs = schedule.filter(emi => {
    const dueDate = new Date(emi.dueDate);
    return emi.status === "pending" && isPastMonth(dueDate);
  }).length;
  
  if (paidEMIs === totalEMIs) return "Completed";
  if (overdueEMIs > 0) return "Overdue";
  return "Active";
}

/**
 * Format currency in Indian format
 */
export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * Format date in Indian format
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}