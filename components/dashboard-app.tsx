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
  cvFile: null,
  coverLetterFile: null,
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

  // Auto-dismiss notice after 5 seconds
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => {
        setNotice(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notice]);
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [showAdvancedSearchPanel, setShowAdvancedSearchPanel] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    company: true,
    role: true,
    applied: true,
    status: true,
    location: true,
    cv: true,
    coverLetter: true,
    actions: true,
  });
  const [searchFilters, setSearchFilters] = useState<Array<{
    id: string;
    column: string;
    operator: "=" | "!=";
    value: string;
  }>>([]);

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

      // Check if user is approved
      const { data: profile, error: profileError } = await client
        .from("user_profiles")
        .select("is_approved, email")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      }

      // If profile doesn't exist, create it
      if (!profile) {
        console.log("Profile not found, creating one...");
        const { error: insertError } = await client
          .from("user_profiles")
          .insert({
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name || "",
            email: session.user.email || "",
            phone_number: session.user.user_metadata?.phone_number || "",
            is_approved: false,
          });

        if (insertError) {
          console.error("Error creating profile:", insertError);
        }
        
        // Profile just created, so not approved yet
        router.replace("/pending-approval");
        return;
      }

      // If not approved, redirect to pending approval page
      if (!profile?.is_approved) {
        router.replace("/pending-approval");
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
      cvFile: null,
      coverLetterFile: null,
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

    try {
      if (!draft.company.trim() || !draft.role.trim() || !draft.date_applied) {
        throw new Error("Company, role, and applied date are required.");
      }

      let cvFileName = null;
      let cvFileUrl = null;
      let coverLetterFileName = null;
      let coverLetterFileUrl = null;

      // Upload CV if provided
      if (draft.cvFile) {
        const cvPath = `${session.user.id}/${Date.now()}_${draft.cvFile.name}`;
        const { error: cvUploadError } = await client.storage
          .from("application-documents")
          .upload(cvPath, draft.cvFile);

        if (cvUploadError) {
          throw new Error(`CV upload failed: ${cvUploadError.message}`);
        }

        const { data: cvUrlData } = client.storage
          .from("application-documents")
          .getPublicUrl(cvPath);

        cvFileName = draft.cvFile.name;
        cvFileUrl = cvPath; // Store path for authenticated download
      }

      // Upload Cover Letter if provided
      if (draft.coverLetterFile) {
        const clPath = `${session.user.id}/${Date.now()}_${draft.coverLetterFile.name}`;
        const { error: clUploadError } = await client.storage
          .from("application-documents")
          .upload(clPath, draft.coverLetterFile);

        if (clUploadError) {
          throw new Error(`Cover letter upload failed: ${clUploadError.message}`);
        }

        coverLetterFileName = draft.coverLetterFile.name;
        coverLetterFileUrl = clPath; // Store path for authenticated download
      }

      const payload = {
        user_id: session.user.id,
        company: draft.company.trim(),
        role: draft.role.trim(),
        status: draft.status,
        date_applied: draft.date_applied,
        location: draft.location.trim() || null,
        job_url: draft.job_url.trim() || null,
        ...(cvFileName && { cv_file_name: cvFileName }),
        ...(cvFileUrl && { cv_file_url: cvFileUrl }),
        ...(coverLetterFileName && { cover_letter_file_name: coverLetterFileName }),
        ...(coverLetterFileUrl && { cover_letter_file_url: coverLetterFileUrl }),
      };

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

  async function downloadFile(filePath: string, fileName: string) {
    if (!supabase) {
      setError("Supabase client is still loading.");
      return;
    }

    try {
      const { data, error: downloadError } = await supabase.storage
        .from("application-documents")
        .download(filePath);

      if (downloadError) {
        throw downloadError;
      }

      // Create a download link
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to download file.",
      );
    }
  }

  async function updateApplicationStatus(id: string, currentStatus: ApplicationStatus) {
    if (!supabase) {
      setError("Supabase client is still loading.");
      return;
    }

    // Define the status progression order
    const statusOrder: ApplicationStatus[] = [
      "Applied",
      "Interview",
      "Offer",
      "Rejected",
      "Ghosted",
      "Withdrawn",
    ];

    // Get the next status in the cycle
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    const nextStatus = statusOrder[nextIndex];

    setError(null);
    setNotice(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("applications")
        .update({ status: nextStatus })
        .eq("id", id)
        .eq("user_id", session.user.id);

      if (updateError) {
        throw updateError;
      }

      setNotice(`Status updated to ${nextStatus}`);
      await loadApplications(session.user.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update status.",
      );
    }
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

  async function exportToExcel() {
    try {
      // Dynamically import xlsx to avoid SSR issues
      const XLSX = await import("xlsx");
      
      // Prepare data for export
      const exportData = applications.map((app) => ({
        Company: app.company,
        Role: app.role,
        "Date Applied": app.date_applied,
        Status: app.status,
        Location: app.location || "Remote / n/a",
        "Job URL": app.job_url || "",
        "CV Attached": app.cv_file_name ? "Yes" : "No",
        "Cover Letter Attached": app.cover_letter_file_name ? "Yes" : "No",
        "Created At": new Date(app.created_at).toLocaleDateString(),
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Company
        { wch: 25 }, // Role
        { wch: 12 }, // Date Applied
        { wch: 12 }, // Status
        { wch: 15 }, // Location
        { wch: 40 }, // Job URL
        { wch: 15 }, // CV Attached
        { wch: 20 }, // Cover Letter Attached
        { wch: 12 }, // Created At
      ];
      worksheet["!cols"] = columnWidths;

      // Generate filename with current date
      const fileName = `Job_Applications_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, fileName);
      
      setNotice(`Exported ${applications.length} applications to ${fileName}`);
    } catch (err) {
      setError("Failed to export data. Please try again.");
      console.error("Export error:", err);
    }
  }

  const addSearchFilter = () => {
    setSearchFilters([
      ...searchFilters,
      {
        id: Date.now().toString(),
        column: "company",
        operator: "=",
        value: "",
      },
    ]);
  };

  const removeSearchFilter = (id: string) => {
    setSearchFilters(searchFilters.filter((filter) => filter.id !== id));
  };

  const updateSearchFilter = (id: string, field: "column" | "operator" | "value", value: string) => {
    setSearchFilters(
      searchFilters.map((filter) =>
        filter.id === id ? { ...filter, [field]: value } : filter
      )
    );
  };

  const clearAllSearchFilters = () => {
    setSearchFilters([]);
  };

  const getActiveFiltersCount = () => {
    return searchFilters.filter(f => f.value).length;
  };

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

      // Advanced search filters
      const matchesAdvancedSearch = searchFilters.every((filter) => {
        if (!filter.value) return true;

        let itemValue = "";
        switch (filter.column) {
          case "company":
            itemValue = item.company;
            break;
          case "role":
            itemValue = item.role;
            break;
          case "applied":
            itemValue = item.date_applied;
            break;
          case "status":
            itemValue = item.status;
            break;
          case "location":
            itemValue = item.location ?? "";
            break;
        }

        const filterValue = filter.value.toLowerCase();
        const itemValueLower = itemValue.toLowerCase();

        if (filter.operator === "=") {
          return itemValueLower.includes(filterValue);
        } else {
          return !itemValueLower.includes(filterValue);
        }
      });

      return matchesQuery && matchesStatus && matchesAdvancedSearch;
    });
  }, [applications, search, statusFilter, searchFilters]);

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
            <strong>{userLabel}</strong>
          </div>
        </Link>

        <nav className="dashboard-tabs">
          <Link href="/dashboard" className="tab-link active">
            📊 Applications
          </Link>
          <Link href="/tools" className="tab-link">
            🛠️ Tools
          </Link>
        </nav>

        <div className="dashboard-header__actions">
          <button className="secondary-button" onClick={handleThemeToggle} type="button">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          
          <div className="profile-menu-container">
            <button 
              className="profile-menu-trigger" 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              type="button"
              aria-label="User menu"
            >
              <div className="profile-avatar">
                {userLabel.charAt(0).toUpperCase()}
              </div>
            </button>
            
            {showProfileMenu && (
              <>
                <div 
                  className="profile-menu-backdrop" 
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="profile-menu-dropdown">
                  <div className="profile-menu-header">
                    <div className="profile-avatar-large">
                      {userLabel.charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-menu-info">
                      <strong>{userLabel}</strong>
                      <span className="profile-menu-email">{applications.length} applications</span>
                    </div>
                  </div>
                  
                  <div className="profile-menu-divider" />
                  
                  <Link 
                    href="/profile" 
                    className="profile-menu-item"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <span className="profile-menu-icon">👤</span>
                    <span>Profile</span>
                  </Link>
                  
                  <Link 
                    href="/help" 
                    className="profile-menu-item"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <span className="profile-menu-icon">❓</span>
                    <span>Help & FAQ</span>
                  </Link>
                  
                  <Link 
                    href="/about" 
                    className="profile-menu-item"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <span className="profile-menu-icon">ℹ️</span>
                    <span>About</span>
                  </Link>
                  
                  <div className="profile-menu-divider" />
                  
                  <button 
                    className="profile-menu-item profile-menu-item--danger" 
                    onClick={() => {
                      setShowProfileMenu(false);
                      signOut();
                    }}
                    type="button"
                  >
                    <span className="profile-menu-icon">🚪</span>
                    <span>Sign out</span>
                  </button>
                </div>
              </>
            )}
          </div>
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
          <div className="hero-panel__actions">
            <button className="primary-button" onClick={openCreateModal} type="button">
              Add application
            </button>
          </div>
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
          <div className="table-controls">
            <div className="filter-search-container">
              <button 
                className={`filter-toggle-btn ${showAdvancedSearchPanel ? 'active' : ''} ${getActiveFiltersCount() > 0 ? 'has-filters' : ''}`}
                onClick={() => setShowAdvancedSearchPanel(!showAdvancedSearchPanel)}
                type="button"
                title="Advanced filters"
              >
                <span className="filter-icon">⚙️</span>
                <span className="filter-text">Filters</span>
                {getActiveFiltersCount() > 0 && (
                  <span className="filter-badge">{getActiveFiltersCount()}</span>
                )}
              </button>
              
              {showAdvancedSearchPanel && (
                <>
                  <div 
                    className="filter-panel-backdrop" 
                    onClick={() => setShowAdvancedSearchPanel(false)}
                  />
                  <div className="filter-dropdown-panel">
                    <div className="filter-panel-header">
                      <h4>Advanced Filters</h4>
                      <div className="filter-panel-actions">
                        <button 
                          className="filter-action-btn filter-action-btn--add" 
                          onClick={addSearchFilter}
                          type="button"
                        >
                          <span>+</span> Add Filter
                        </button>
                        {searchFilters.length > 0 && (
                          <button 
                            className="filter-action-btn filter-action-btn--clear" 
                            onClick={clearAllSearchFilters}
                            type="button"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="filter-panel-body">
                      {searchFilters.length === 0 ? (
                        <div className="filter-empty-state">
                          <span className="filter-empty-icon">🔍</span>
                          <p>No filters applied</p>
                          <span className="filter-empty-hint">Click "Add Filter" to start</span>
                        </div>
                      ) : (
                        <div className="filter-list">
                          {searchFilters.map((filter, index) => (
                            <div key={filter.id} className="filter-item">
                              <div className="filter-item-header">
                                <span className="filter-item-number">{index + 1}</span>
                                <button
                                  className="filter-item-remove"
                                  onClick={() => removeSearchFilter(filter.id)}
                                  type="button"
                                  title="Remove filter"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="filter-item-body">
                                <select
                                  className="filter-select"
                                  value={filter.column}
                                  onChange={(e) => updateSearchFilter(filter.id, "column", e.target.value)}
                                >
                                  <option value="company">Company</option>
                                  <option value="role">Role</option>
                                  <option value="applied">Applied Date</option>
                                  <option value="status">Status</option>
                                  <option value="location">Location</option>
                                </select>
                                
                                <select
                                  className="filter-select"
                                  value={filter.operator}
                                  onChange={(e) => updateSearchFilter(filter.id, "operator", e.target.value as "=" | "!=")}
                                >
                                  <option value="=">Contains</option>
                                  <option value="!=">Does not contain</option>
                                </select>
                                
                                <input
                                  type="text"
                                  className="filter-input"
                                  placeholder="Enter value..."
                                  value={filter.value}
                                  onChange={(e) => updateSearchFilter(filter.id, "value", e.target.value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="table-controls-right">
              <button 
                className="table-control-btn" 
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                type="button"
                title="Toggle column visibility"
              >
                <span>👁️</span> Columns
              </button>
              {applications.length > 0 && (
                <button 
                  className="table-control-btn table-control-btn--primary" 
                  onClick={exportToExcel} 
                  type="button"
                  title="Export to Excel"
                >
                  <span>📊</span> Export
                </button>
              )}
            </div>
          </div>

          {showColumnFilter && (
            <div className="column-filter-panel">
              <div className="column-filter-header">
                <h4>Show/Hide Columns</h4>
                <button 
                  className="column-filter-close"
                  onClick={() => setShowColumnFilter(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>
              <div className="column-filter-grid">
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.company}
                    onChange={(e) => setVisibleColumns({...visibleColumns, company: e.target.checked})}
                  />
                  <span>Company</span>
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.role}
                    onChange={(e) => setVisibleColumns({...visibleColumns, role: e.target.checked})}
                  />
                  <span>Role</span>
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.applied}
                    onChange={(e) => setVisibleColumns({...visibleColumns, applied: e.target.checked})}
                  />
                  <span>Applied</span>
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.status}
                    onChange={(e) => setVisibleColumns({...visibleColumns, status: e.target.checked})}
                  />
                  <span>Status</span>
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.location}
                    onChange={(e) => setVisibleColumns({...visibleColumns, location: e.target.checked})}
                  />
                  <span>Location</span>
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.cv}
                    onChange={(e) => setVisibleColumns({...visibleColumns, cv: e.target.checked})}
                  />
                  <span>CV</span>
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.coverLetter}
                    onChange={(e) => setVisibleColumns({...visibleColumns, coverLetter: e.target.checked})}
                  />
                  <span>Cover Letter</span>
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visibleColumns.actions}
                    onChange={(e) => setVisibleColumns({...visibleColumns, actions: e.target.checked})}
                  />
                  <span>Actions</span>
                </label>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {visibleColumns.company && <th>Company</th>}
                  {visibleColumns.role && <th>Role</th>}
                  {visibleColumns.applied && <th>Applied</th>}
                  {visibleColumns.status && <th>Status</th>}
                  {visibleColumns.location && <th>Location</th>}
                  {visibleColumns.cv && <th>CV</th>}
                  {visibleColumns.coverLetter && <th>Cover Letter</th>}
                  {visibleColumns.actions && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length ? (
                  filteredApplications.map((item) => (
                    <tr key={item.id}>
                      {visibleColumns.company && <td>{item.company}</td>}
                      {visibleColumns.role && (
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
                      )}
                      {visibleColumns.applied && <td>{item.date_applied}</td>}
                      {visibleColumns.status && (
                        <td>
                          <button
                            className={`status-badge status-badge--${item.status} status-badge--clickable`}
                            onClick={() => updateApplicationStatus(item.id, item.status)}
                            type="button"
                            title="Click to advance to next status"
                          >
                            {item.status}
                          </button>
                        </td>
                      )}
                      {visibleColumns.location && <td>{item.location ?? "Remote / n/a"}</td>}
                      {visibleColumns.cv && (
                        <td>
                        {item.cv_file_url && item.cv_file_name ? (
                          <button
                            className="document-download-btn"
                            onClick={() => downloadFile(item.cv_file_url!, item.cv_file_name!)}
                            type="button"
                            title="Download CV"
                          >
                            📄 {item.cv_file_name}
                          </button>
                        ) : (
                          <button
                            className="document-add-btn"
                            onClick={() => openEditModal(item)}
                            type="button"
                          >
                            + Add CV
                          </button>
                        )}
                        </td>
                      )}
                      {visibleColumns.coverLetter && (
                        <td>
                          {item.cover_letter_file_url && item.cover_letter_file_name ? (
                            <button
                              className="document-download-btn"
                              onClick={() => downloadFile(item.cover_letter_file_url!, item.cover_letter_file_name!)}
                              type="button"
                              title="Download Cover Letter"
                            >
                              📝 {item.cover_letter_file_name}
                            </button>
                          ) : (
                            <button
                              className="document-add-btn"
                              onClick={() => openEditModal(item)}
                              type="button"
                            >
                              + Add CL
                            </button>
                          )}
                        </td>
                      )}
                      {visibleColumns.actions && (
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
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty-state" colSpan={8}>
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
            </div>

            <form className="modal-form" onSubmit={saveApplication}>
              <label>
                <span className="required-field">Company</span>
                <input
                  onChange={(event) => updateDraft("company", event.target.value)}
                  required
                  value={draft.company}
                />
              </label>

              <label>
                <span className="required-field">Role</span>
                <input
                  onChange={(event) => updateDraft("role", event.target.value)}
                  required
                  value={draft.role}
                />
              </label>

              <label>
                <span className="required-field">Date applied</span>
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

              <label className="modal-form__full file-upload-section">
                <span>📄 Upload CV (PDF, DOC, DOCX)</span>
                <input
                  accept=".pdf,.doc,.docx"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    updateDraft("cvFile", file);
                  }}
                  type="file"
                  className="file-input"
                />
                {draft.cvFile ? (
                  <span className="file-name">✓ Selected: {draft.cvFile.name}</span>
                ) : (
                  <span className="file-hint">No file selected</span>
                )}
              </label>

              <label className="modal-form__full file-upload-section">
                <span>📝 Upload Cover Letter (PDF, DOC, DOCX)</span>
                <input
                  accept=".pdf,.doc,.docx"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    updateDraft("coverLetterFile", file);
                  }}
                  type="file"
                  className="file-input"
                />
                {draft.coverLetterFile ? (
                  <span className="file-name">✓ Selected: {draft.coverLetterFile.name}</span>
                ) : (
                  <span className="file-hint">No file selected</span>
                )}
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
