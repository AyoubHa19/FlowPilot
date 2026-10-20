import { AppShell } from "@/components/app-shell/app-shell";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
