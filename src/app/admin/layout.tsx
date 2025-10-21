import "../globals.css";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";

export const metadata = {
  title: "Admin Dashboard | BlackOSInventory",
  description: "Comprehensive admin dashboard for BlackOSInventory system",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-neutral)]">
      {/* Topbar */}
      <Topbar />

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar  />

        {/* Main Content */}
       <main className="flex-1 p-6 lg:ml-64 overflow-y-auto bg-[var(--color-neutral)]">
  {children}
</main>
      </div>
    </div>
  );
}
