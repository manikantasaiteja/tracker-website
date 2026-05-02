"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  APPLICATION_STATUSES,
  type ApplicationDraft,
  type ApplicationRecord,
  type ApplicationStatus,
} from "@/lib/types";

const EMPTY_DRAFT: ApplicationDraft = {
  company: "",
  role: "",
  status: "Applied",
  date_applied: new Date().toISOString().split("T")[0] ?? "",
  location: "",
  job_url: "",
  notes: "",
};

type DashboardAppProps = {
  initialSessionError?: string | null;
};

export function DashboardApp({ initialSessionError }: DashboardAppProps) {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return createBrowserSupabaseClient();
  });
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ApplicationStatus>("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialSessionError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("Guest");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("trackr-theme") === "light"
        ? "light"
        : "dark";
    }

    return "dark";
  });
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("trackr-theme", theme);
  }, [theme]);
  const loadApplications = useCallback(
    async (userId: string) => {
      if (!supabase) {
        return;
      }

      const { data, error: loadError } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .order("date_applied", { ascending: false })
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        return;
      }

      setApplications((data as ApplicationRecord[]) ?? []);
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    async function bootstrap() {
      const client = supabase;
      if (!client) {
        return;
      }

      setLoading(true);
      setError(initialSessionError ?? null);

      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();

      if (sessionError || !session?.user) {
        router.replace("/login");
        return;
      }

      const nextLabel =
        session.user.user_metadata.full_name ||
        session.user.email ||
        "Trackr user";

      setUserLabel(nextLabel);
      await loadApplications(session.user.id);
      setLoading(false);
    }

    void bootstrap();
  }, [initialSessionError, loadApplications, router, supabase]);

  function updateDraft<Key extends keyof ApplicationDraft>(
    key: Key,
    value: ApplicationDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openCreateModal() {
    setEditingId(null);
    setDraft({
      ...EMPTY_DRAFT,
      date_applied: new Date().toISOString().split("T")[0] ?? "",
    });
    setShowModal(true);
  }

  function openEditModal(item: ApplicationRecord) {
    setEditingId(item.id);
    setDraft({
      company: item.company,
      role: item.role,
      status: item.status,
      date_applied: item.date_applied,
      location: item.location ?? "",
      job_url: item.job_url ?? "",
      notes: item.notes ?? "",
    });
    setShowModal(true);
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase client is still loading.");
      return;
    }
    const client = supabase;

    setSaving(true);
    setError(null);
    setNotice(null);

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    const payload = {
      user_id: session.user.id,
      company: draft.company.trim(),
      role: draft.role.trim(),
      status: draft.status,
      date_applied: draft.date_applied,
      location: draft.location.trim() || null,
      job_url: draft.job_url.trim() || null,
      notes: draft.notes.trim() || null,
    };

    try {
      if (!payload.company || !payload.role || !payload.date_applied) {
        throw new Error("Company, role, and applied date are required.");
      }

      if (editingId) {
        const { error: updateError } = await client
          .from("applications")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", session.user.id);

        if (updateError) {
          throw updateError;
        }

        setNotice("Application updated.");
      } else {
        const { error: insertError } = await client
          .from("applications")
          .insert(payload);

        if (insertError) {
          throw insertError;
        }

        setNotice("Application saved to Supabase.");
      }

      setShowModal(false);
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      await loadApplications(session.user.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save the application.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteApplication(id: string) {
    const confirmed = window.confirm("Delete this application?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);
    if (!supabase) {
      setError("Supabase client is still loading.");
      return;
    }
    const client = supabase;

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    const { error: deleteError } = await client
      .from("applications")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("Application removed.");
    await loadApplications(session.user.id);
  }

  async function signOut() {
    if (!supabase) {
      return;
    }
    const client = supabase;

    await client.auth.signOut();
    router.replace("/login");
  }

  function handleThemeToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applications.filter((item) => {
      const matchesQuery =
        !query ||
        item.company.toLowerCase().includes(query) ||
        item.role.toLowerCase().includes(query) ||
        (item.location ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  const stats = useMemo(() => {
    const counts = APPLICATION_STATUSES.reduce(
      (accumulator, status) => ({
        ...accumulator,
        [status]: 0,
      }),
      {} as Record<ApplicationStatus, number>,
    );

    for (const application of applications) {
      counts[application.status] += 1;
    }

    return counts;
  }, [applications]);

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading your dashboard...</p>
      </main>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand-mark brand-mark--small" href="/dashboard">
          <span className="brand-mark__icon">T</span>
          <div>
            <p className="brand-mark__eyebrow">Trackr</p>
            <strong>Application tracker</strong>
          </div>
        </Link>

        <div className="dashboard-header__actions">
          <div className="dashboard-pill">
            <span className="dashboard-pill__dot" />
            Supabase connected
          </div>
          <button className="secondary-button" onClick={handleThemeToggle} type="button">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="dashboard-user">{userLabel}</div>
          <button className="secondary-button" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="hero-panel">
          <div>
            <p className="hero-panel__eyebrow">Job search control center</p>
            <h1>Keep every application, interview, and outcome in one place.</h1>
            <p className="hero-panel__copy">
              This UI is rebuilt from your old static Trackr concept and now
              stores real data in Supabase instead of local-only browser state.
            </p>
          </div>
          <button className="primary-button" onClick={openCreateModal} type="button">
            Add application
          </button>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <span>Total</span>
            <strong>{applications.length}</strong>
          </article>
          <article className="stat-card">
            <span>Applied</span>
            <strong>{stats.Applied}</strong>
          </article>
          <article className="stat-card">
            <span>Interview</span>
            <strong>{stats.Interview}</strong>
          </article>
          <article className="stat-card">
            <span>Offer</span>
            <strong>{stats.Offer}</strong>
          </article>
          <article className="stat-card">
            <span>Rejected</span>
            <strong>{stats.Rejected}</strong>
          </article>
          <article className="stat-card">
            <span>Other</span>
            <strong>{stats.Ghosted + stats.Withdrawn}</strong>
          </article>
        </section>

        <section className="toolbar-panel">
          <label className="search-field">
            <span className="sr-only">Search applications</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, role, or location"
              value={search}
            />
          </label>

          <select
            className="select-field"
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setStatusFilter(event.target.value as "All" | ApplicationStatus)
            }
            value={statusFilter}
          >
            <option value="All">All statuses</option>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </section>

        {error ? <div className="auth-banner auth-banner--error">{error}</div> : null}
        {notice ? <div className="auth-banner auth-banner--success">{notice}</div> : null}

        <section className="table-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length ? (
                  filteredApplications.map((item) => (
                    <tr key={item.id}>
                      <td>{item.company}</td>
                      <td>
                        <div className="role-cell">
                          <strong>{item.role}</strong>
                          {item.job_url ? (
                            <a href={item.job_url} rel="noreferrer" target="_blank">
                              Open role
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td>{item.date_applied}</td>
                      <td>
                        <span className={`status-badge status-badge--${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.location ?? "Remote / n/a"}</td>
                      <td className="notes-cell">{item.notes ?? "No notes yet"}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="ghost-button"
                            onClick={() => openEditModal(item)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="ghost-button ghost-button--danger"
                            onClick={() => deleteApplication(item.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty-state" colSpan={7}>
                      {applications.length
                        ? "No applications match the current filter."
                        : "No applications yet. Add your first one to create live Supabase data."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showModal ? (
        <div
          aria-modal="true"
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowModal(false);
            }
          }}
          role="dialog"
        >
          <div className="modal-card">
            <div className="modal-card__header">
              <div>
                <p className="hero-panel__eyebrow">
                  {editingId ? "Edit entry" : "New entry"}
                </p>
                <h2>{editingId ? "Update application" : "Add application"}</h2>
              </div>
              <button
                aria-label="Close modal"
                className="secondary-button"
                onClick={() => setShowModal(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="modal-form" onSubmit={saveApplication}>
              <label>
                <span>Company</span>
                <input
                  onChange={(event) => updateDraft("company", event.target.value)}
                  required
                  value={draft.company}
                />
              </label>

              <label>
                <span>Role</span>
                <input
                  onChange={(event) => updateDraft("role", event.target.value)}
                  required
                  value={draft.role}
                />
              </label>

              <label>
                <span>Date applied</span>
                <input
                  onChange={(event) => updateDraft("date_applied", event.target.value)}
                  required
                  type="date"
                  value={draft.date_applied}
                />
              </label>

              <label>
                <span>Status</span>
                <select
                  onChange={(event) =>
                    updateDraft("status", event.target.value as ApplicationStatus)
                  }
                  value={draft.status}
                >
                  {APPLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Location</span>
                <input
                  onChange={(event) => updateDraft("location", event.target.value)}
                  placeholder="Berlin or Remote"
                  value={draft.location}
                />
              </label>

              <label>
                <span>Job URL</span>
                <input
                  onChange={(event) => updateDraft("job_url", event.target.value)}
                  placeholder="https://company.com/job"
                  type="url"
                  value={draft.job_url}
                />
              </label>

              <label className="modal-form__full">
                <span>Notes</span>
                <textarea
                  onChange={(event) => updateDraft("notes", event.target.value)}
                  placeholder="Interview prep, recruiter notes, follow-up details..."
                  rows={5}
                  value={draft.notes}
                />
              </label>

              <div className="modal-card__footer">
                <button
                  className="secondary-button"
                  onClick={() => setShowModal(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? "Saving..." : editingId ? "Save changes" : "Create entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
