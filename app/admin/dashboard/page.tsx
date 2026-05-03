"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type PendingUser = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  created_at: string;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return createBrowserSupabaseClient();
  });
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdminAndLoadUsers() {
      if (!supabase) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.replace("/admin/login");
          return;
        }

        // Verify admin status
        const { data: adminData, error: adminError } = await supabase
          .from("admins")
          .select("id")
          .eq("id", user.id)
          .single();

        if (adminError || !adminData) {
          await supabase.auth.signOut();
          router.replace("/admin/login");
          return;
        }

        // Load pending users
        await loadPendingUsers();
      } catch (err) {
        console.error("Error checking admin status:", err);
        router.replace("/admin/login");
      }
    }

    checkAdminAndLoadUsers();
  }, [supabase, router]);

  async function loadPendingUsers() {
    if (!supabase) return;

    try {
      setLoading(true);
      
      // Get pending user profiles with email
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, phone_number, created_at")
        .eq("is_approved", false)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const usersWithEmails: PendingUser[] = (profiles || []).map(profile => ({
        id: profile.id,
        full_name: profile.full_name || "N/A",
        email: profile.email || "N/A",
        phone_number: profile.phone_number || "N/A",
        created_at: profile.created_at,
      }));

      setPendingUsers(usersWithEmails);
    } catch (err) {
      console.error("Error loading pending users:", err);
      setError("Failed to load pending users. Check console for details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!supabase) return;

    try {
      setProcessingUserId(userId);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Remove from pending list
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      
      // TODO: Send notification email to user
      alert("User approved successfully!");
    } catch (err) {
      console.error("Error approving user:", err);
      setError("Failed to approve user");
    } finally {
      setProcessingUserId(null);
    }
  }

  async function handleReject(userId: string) {
    if (!supabase) return;
    
    if (!confirm("Are you sure you want to reject this user? This will delete their account.")) {
      return;
    }

    try {
      setProcessingUserId(userId);
      setError(null);

      // Delete user profile (cascade will handle auth.users)
      const { error: deleteError } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId);

      if (deleteError) throw deleteError;

      // Remove from pending list
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      
      alert("User rejected and account deleted.");
    } catch (err) {
      console.error("Error rejecting user:", err);
      setError("Failed to reject user");
    } finally {
      setProcessingUserId(null);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand-mark brand-mark--small">
          <span className="brand-mark__icon">A</span>
          <div>
            <p className="brand-mark__eyebrow">Admin Portal</p>
            <strong>User Management</strong>
          </div>
        </div>
        <div className="dashboard-header__actions">
          <button onClick={handleSignOut} className="secondary-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="hero-panel">
          <div>
            <p className="hero-panel__eyebrow">Admin Dashboard</p>
            <h1>Pending User Approvals</h1>
            <p className="hero-panel__copy">
              Review and approve new user registrations. Approved users will gain access to the platform.
            </p>
          </div>
        </section>

        {error && (
          <div className="auth-banner auth-banner--error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}

        <section className="table-panel" style={{ marginTop: "1.5rem" }}>
          <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text)" }}>
              Pending Users ({pendingUsers.length})
            </h2>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="empty-state">
              No pending user approvals at this time.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Registered</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone_number}</td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: "center" }}>
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={processingUserId === user.id}
                            className="primary-button"
                            style={{
                              padding: "0.5rem 1rem",
                              fontSize: "0.88rem",
                              opacity: processingUserId === user.id ? 0.6 : 1,
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            disabled={processingUserId === user.id}
                            className="ghost-button ghost-button--danger"
                            style={{
                              opacity: processingUserId === user.id ? 0.6 : 1,
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
