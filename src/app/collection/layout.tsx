import "../globals.css";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import BottomNav from "./components/bottomnav";

export const metadata = {
  title: "Collection Dashboard | BlackOSInventory",
  description: "Collection-side dashboard for BlackOSInventory system",
};

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)]">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto bg-[var(--bg-main)]">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
