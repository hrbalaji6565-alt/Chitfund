import "../globals.css";
import BottomNav from "./components/bottomnav";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";

export const metadata = {
  title: "User Dashboard | BlackOSInventory",
  description: "User-side dashboard for BlackOSInventory system",
};

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar />
      <div className="flex flex-1">
        {/* Sidebar visible only on large screens */}
        <Sidebar />

        {/* Main content adjusts padding when sidebar visible */}
        <main className="flex-1 p-0 md:p-6 overflow-y-auto bg-[var(--bg-main)] lg:ml-64 pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
