import { DashboardNav } from "@/components/dashboard-nav";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <DashboardNav />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </>
  );
}
