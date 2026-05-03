"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });
  const [userName, setUserName] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    async function checkApprovalStatus() {
      if (!supabase) return;

      setChecking(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.replace("/login");
          return;
        }

        // Get user profile with fresh data
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("full_name, is_approved, email")
          .eq("id", user.id)
          .maybeSingle(); // Use maybeSingle instead of single to handle 0 rows

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          return;
        }

        // If profile doesn't exist, create it
        if (!profile) {
          console.log("Profile not found, creating one...");
          console.log("User data:", {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata
          });
          
          const { data: newProfile, error: insertError } = await supabase
            .from("user_profiles")
            .insert({
              id: user.id,
              full_name: user.user_metadata?.full_name || "",
              email: user.email || "",
              phone_number: user.user_metadata?.phone_number || "",
              is_approved: false,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Error creating profile:", insertError);
          } else {
            console.log("Profile created successfully:", newProfile);
          }
          
          // Profile just created, so not approved yet
          setUserName(user.user_metadata?.full_name || "");
          setLastChecked(new Date());
          setChecking(false);
          return;
        }

        console.log("Approval status check:", { 
          userId: user.id, 
          isApproved: profile.is_approved,
          fullName: profile.full_name 
        });

        setUserName(profile.full_name || "");
        setLastChecked(new Date());

        // If approved, redirect to dashboard
        if (profile.is_approved === true) {
          console.log("User is approved! Redirecting to dashboard...");
          router.push("/dashboard");
          router.refresh();
        }
      } catch (err) {
        console.error("Error checking approval status:", err);
      } finally {
        setChecking(false);
      }
    }

    // Check immediately on mount
    checkApprovalStatus();

    // Poll for approval status every 10 seconds (faster for testing)
    const interval = setInterval(checkApprovalStatus, 10000);

    return () => clearInterval(interval);
  }, [supabase, router]);

  async function handleManualCheck() {
    if (!supabase || checking) return;

    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("full_name, is_approved, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        alert("Error checking status. Please try again.");
        return;
      }

      // If profile doesn't exist, create it
      if (!profile) {
        console.log("Profile not found, creating one...");
        const { error: insertError } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || "",
            email: user.email || "",
            phone_number: user.user_metadata?.phone_number || "",
            is_approved: false,
          });

        if (insertError) {
          console.error("Error creating profile:", insertError);
          alert("Error creating profile. Please contact support.");
        } else {
          alert("Profile created! Your account is pending approval.");
        }
        setLastChecked(new Date());
        setChecking(false);
        return;
      }

      setLastChecked(new Date());

      if (profile.is_approved === true) {
        console.log("User is approved! Redirecting to dashboard...");
        router.push("/dashboard");
        router.refresh();
      } else {
        alert("Your account is still pending approval. We'll notify you once approved!");
      }
    } catch (err) {
      console.error("Error checking approval status:", err);
      alert("Error checking status. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="auth-shell">
      <section className="auth-shell__hero">
        <div className="brand-mark">
          <span className="brand-mark__icon">⏳</span>
          <div>
            <p className="brand-mark__eyebrow">Trackr</p>
            <h1>Almost there!</h1>
          </div>
        </div>
        <p className="auth-shell__copy">
          Your account has been created successfully. We're reviewing your registration and will notify you once you're approved.
        </p>
      </section>

      <section className="auth-shell__panel">
        <div className="auth-card">
          <p className="auth-card__eyebrow">Account Pending</p>
          <h2>Thanks for your interest{userName ? `, ${userName}` : ""}!</h2>
          <p className="auth-card__subcopy" style={{ marginBottom: "2rem" }}>
            Your account is currently under review by our admin team. We'll notify you via email once you've been approved and can access the platform.
          </p>

          <div style={{ 
            padding: "1.5rem", 
            backgroundColor: "var(--surface-soft)", 
            borderRadius: "var(--radius-md)",
            marginBottom: "2rem",
            border: "1px solid var(--border)"
          }}>
            <h3 style={{ marginTop: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>What happens next?</h3>
            <ul style={{ marginBottom: 0, paddingLeft: "1.5rem", color: "var(--text-muted)" }}>
              <li style={{ marginBottom: "0.5rem" }}>Our admin team will review your registration</li>
              <li style={{ marginBottom: "0.5rem" }}>You'll receive an email notification once approved</li>
              <li style={{ marginBottom: "0.5rem" }}>After approval, you can sign in and start using Trackr</li>
            </ul>
          </div>

          <button
            onClick={handleManualCheck}
            disabled={checking}
            className="primary-button"
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            {checking ? "Checking..." : "Check Approval Status Now"}
          </button>

          <button
            onClick={handleSignOut}
            className="secondary-button"
            style={{ width: "100%" }}
          >
            Sign Out
          </button>

          <p className="auth-card__switch" style={{ marginTop: "1rem", textAlign: "center", color: "var(--text-soft)" }}>
            {lastChecked ? (
              <>Last checked: {lastChecked.toLocaleTimeString()}<br /></>
            ) : null}
            Auto-checking every 10 seconds...
          </p>
        </div>
      </section>
    </div>
  );
}
