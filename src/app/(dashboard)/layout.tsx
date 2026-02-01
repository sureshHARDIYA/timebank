import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F4F4F4]">
      <div className="print:hidden">
        <AppSidebar />
      </div>
      <div className="pl-[52px] print:pl-0">
        <div className="print:hidden">
          <AppHeader />
        </div>
        <main className="p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
