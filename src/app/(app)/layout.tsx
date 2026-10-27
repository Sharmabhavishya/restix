import { requireViewer } from "@/server/auth/viewer";
import { AppShell } from "@/components/shell/app-shell";

// Every page in this group needs a signed-in account with a verified, allowed email.
// Each page applies its own stricter check (browse, act, moderate) on top.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
