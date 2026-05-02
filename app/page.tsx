"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function resolveRoute() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      router.replace(session ? "/dashboard" : "/login");
    }

    void resolveRoute();
  }, [router]);

  return (
    <main className="route-loader">
      <div className="route-loader__pulse" />
      <p>Preparing Trackr...</p>
    </main>
  );
}
