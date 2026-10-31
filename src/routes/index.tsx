import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AcademyApp } from "@/components/academy-app";
import { BootScreen } from "@/components/ui";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || isPending) return <BootScreen />;
  if (!user) return <RedirectToSignIn />;
  return <AcademyApp />;
}
