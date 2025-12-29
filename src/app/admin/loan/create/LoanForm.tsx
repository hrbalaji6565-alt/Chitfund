"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { calculateEndDate, generateEMISchedule } from "@/app/lib/loanUtils";

type FormValues = {
  userId: string;
  durationType: "MONTHS" | "DAYS";
  durationValue: number;
  amount: number;
  monthlyInterestPercent: number;
  startDate: string;
};

type Member = {
  id: string;
  name: string;
};

type EMIRow = {
  monthNumber: number;
  emiAmount: number;
};

export default function LoanForm() {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { 
      durationType: "MONTHS",
      durationValue: 12, 
      monthlyInterestPercent: 1 
    },
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [endDate, setEndDate] = useState<string>("");
  
  const startDate = watch("startDate");
  const durationType = watch("durationType");
  const durationValue = watch("durationValue");
  const amount = watch("amount");
  const monthlyInterestPercent = watch("monthlyInterestPercent");

  useEffect(() => {
    let isMounted = true;
    const fetchMembers = async () => {
      try {
        setMembersLoading(true);
        setMembersError(null);
        const res = await fetch("/api/admin/members");
        if (!isMounted) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.members)) {
          setMembers(data.members);
        } else {
          setMembersError("Failed to load members");
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching members:", err);
        setMembersError("Error loading members");
      } finally {
        if (isMounted) {
          setMembersLoading(false);
        }
      }
    };
    fetchMembers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-calculate end date when start date, duration type, or duration value changes
  useEffect(() => {
    if (startDate && durationValue && durationType) {
      const calculated = calculateEndDate(startDate, durationType, Number(durationValue));
      setEndDate(calculated);
    } else {
      setEndDate("");
    }
  }, [startDate, durationType, durationValue]);

  const emi = useMemo(() => {
    const P = Number(amount || 0);
    const R = Number(monthlyInterestPercent || 0) / 100;
    const N = Number(durationValue || 0);
    
    if (!P || !N) return 0;
    
    if (durationType === "DAYS") {
      // For day-based loans, calculate simple interest: P + (P * R * (N/30))
      // Assuming monthly rate, convert to daily rate
      const dailyRate = R / 30;
      const totalAmount = P + (P * dailyRate * N);
      return Number(totalAmount.toFixed(2));
    } else {
      // Monthly EMI calculation (existing logic)
      if (R === 0) return P / N;
      const pow = Math.pow(1 + R, N);
      const val = (P * R * pow) / (pow - 1);
      return Number(val.toFixed(2));
    }
  }, [amount, monthlyInterestPercent, durationType, durationValue]);

  const previewSchedule = useMemo(() => {
    const N = Number(durationValue || 0);
    if (!N || !emi) return [];
    
    if (durationType === "DAYS") {
      // Day-based loan - single repayment
      return [{
        monthNumber: 1,
        emiAmount: emi,
      }];
    } else {
      // Monthly EMI schedule
      const arr: EMIRow[] = [];
      for (let i = 1; i <= N; i++) {
        arr.push({
          monthNumber: i,
          emiAmount: emi,
        });
      }
      return arr;
    }
  }, [emi, durationType, durationValue]);

  async function onSubmit(data: FormValues) {
    console.log("Form submitted with data:", data);
    setSubmitting(true);
    try {
      // Generate schedule using utility function
      const schedule = generateEMISchedule(
        data.startDate,
        data.durationType,
        data.durationValue,
        emi
      );

      const payloadData = {
        ...data,
        endDate: endDate,
        emiAmount: emi,
        schedule,
        // Keep backward compatibility
        durationInMonths: data.durationType === "MONTHS" ? data.durationValue : 0,
      };

      console.log("Sending payload to API:", payloadData);

      const res = await fetch("/api/admin/loan/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadData),
      });

      console.log("API Response status:", res.status);
      const j = await res.json();
      console.log("API Response data:", j);

      if (j.success) {
        toast.success(j.message || "Loan created successfully");
        // Dispatch event to notify loan list page
        window.dispatchEvent(new Event("loanCreated"));
        // Reset form after successful submission
        reset({
          durationType: "MONTHS",
          durationValue: 12,
          monthlyInterestPercent: 1,
          userId: "",
          amount: undefined,
          startDate: "",
        });
        setEndDate("");
      } else {
        toast.error(j.message || "Failed to create loan");
      }
    } catch (err) {
      console.error("Error in onSubmit:", err);
      toast.error("Server error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold">Create Loan</h2>

        <div>
          <label className="block text-sm font-medium">Select Member</label>
          {membersLoading ? (
            <div className="mt-1 p-2 text-sm text-gray-500">Loading members...</div>
          ) : membersError ? (
            <div className="mt-1 p-2 text-sm text-red-500">{membersError}</div>
          ) : members.length === 0 ? (
            <div className="mt-1 p-2 text-sm text-gray-500">No Members Found</div>
          ) : (
            <select {...register("userId", { required: "Member is required" })} className="mt-1 w-full border rounded px-3 py-2">
              <option value="">-- Select a member --</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          )}
          {errors.userId && <p className="text-red-500 text-sm mt-1">{errors.userId.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Duration Type</label>
            <select 
              {...register("durationType", { required: "Duration type is required" })} 
              className="mt-1 w-full border rounded px-3 py-2"
            >
              <option value="MONTHS">Months</option>
              <option value="DAYS">Days</option>
            </select>
            {errors.durationType && <p className="text-red-500 text-sm">{errors.durationType.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium">
              Duration ({durationType === "MONTHS" ? "Months" : "Days"})
            </label>
            <input 
              type="number" 
              {...register("durationValue", { 
                required: "Duration required", 
                valueAsNumber: true, 
                min: { value: 1, message: "Duration must be > 0" } 
              })} 
              className="mt-1 w-full border rounded px-3 py-2" 
              placeholder={`Enter number of ${durationType === "MONTHS" ? "months" : "days"}`} 
            />
            {errors.durationValue && <p className="text-red-500 text-sm">{errors.durationValue.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium">Loan Amount</label>
            <input type="number" step="0.01" {...register("amount", { required: "Amount required", valueAsNumber: true, min: { value: 1, message: "Amount must be > 0" } })} className="mt-1 w-full border rounded px-3 py-2" />
            {errors.amount && <p className="text-red-500 text-sm">{errors.amount.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Monthly Interest %</label>
            <input type="number" step="0.01" {...register("monthlyInterestPercent", { required: "Interest required", valueAsNumber: true })} className="mt-1 w-full border rounded px-3 py-2" />
            {errors.monthlyInterestPercent && <p className="text-red-500 text-sm">{errors.monthlyInterestPercent.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium">Start Date</label>
            <input type="date" {...register("startDate", { required: "Start date required" })} className="mt-1 w-full border rounded px-3 py-2" />
            {errors.startDate && <p className="text-red-500 text-sm">{errors.startDate.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">End Date</label>
          <input type="date" value={endDate} disabled className="mt-1 w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed" />
          {endDate && <p className="text-xs text-gray-500 mt-1">Automatically calculated based on start date and duration</p>}
        </div>

        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-medium">
            {durationType === "DAYS" ? "Day-based Loan" : "EMI Schedule Preview"}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {durationType === "DAYS" 
              ? `Total Repayment Amount: ₹${emi}` 
              : `Estimated EMI: ₹${emi}`
            }
          </p>

          <div className="mt-3 max-h-64 overflow-auto">
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="py-2 px-2 border border-gray-300">
                    {durationType === "DAYS" ? "Payment" : "Month"}
                  </th>
                  <th className="py-2 px-2 border border-gray-300">
                    {durationType === "DAYS" ? "Total Amount" : "EMI"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewSchedule.map((s) => (
                  <tr key={s.monthNumber} className="hover:bg-gray-100">
                    <td className="py-2 px-2 border border-gray-300">
                      {durationType === "DAYS" ? "Final Payment" : s.monthNumber}
                    </td>
                    <td className="py-2 px-2 border border-gray-300">₹{s.emiAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button 
            type="submit" 
            disabled={submitting} 
            className={`px-6 py-2 rounded font-medium transition-all ${
              submitting 
                ? "bg-gray-400 text-gray-700 cursor-not-allowed" 
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
            }`}
          >
            {submitting ? "Creating Loan..." : "Create Loan"}
          </button>
        </div>
      </form>
    </div>
  );
}
