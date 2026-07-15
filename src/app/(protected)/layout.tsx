import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { requireSession } from "@/server/auth/authorization";

export default async function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await requireSession();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppHeader username={session.username} />
      {children}
    </div>
  );
}
