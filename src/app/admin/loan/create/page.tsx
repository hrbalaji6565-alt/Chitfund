import { Metadata } from "next";
import LoanForm from "./LoanForm";

export const metadata: Metadata = {
  title: "Admin - Loan Create",
};

export default function Page() {
  return (
    <section>
      <LoanForm />
    </section>
  );
}
