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
  useRef,
} from "react";
import { Table, Button, Space, Tag, ConfigProvider, theme as antTheme } from 'antd';
import { DownloadOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, FilePdfOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
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
      
      setNotice(`Exported ${applications.length} applications successfully!`);
    } catch (err) {
      setError("Failed to export data. Please try again.");
      console.error("Export error:", err);
    }
  }

  // Status color mapping
  const getStatusColor = (status: ApplicationStatus) => {
    const colors: Record<ApplicationStatus, string> = {
      Applied: 'blue',
      Interview: 'orange',
      Offer: 'green',
      Rejected: 'red',
      Ghosted: 'default',
      Withdrawn: 'purple',
    };
    return colors[status];
  };

  // Ant Design Table Columns
  const columns: ColumnsType<ApplicationRecord> = useMemo(() => [
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      sorter: (a, b) => a.company.localeCompare(b.company),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <input
            placeholder="Search company"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{
              width: 188,
              marginBottom: 8,
              display: 'block',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
            }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
            <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>
              Reset
            </Button>
          </Space>
        </div>
      ),
      onFilter: (value, record) => record.company.toLowerCase().includes(String(value).toLowerCase()),
      width: 150,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      sorter: (a, b) => a.role.localeCompare(b.role),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <input
            placeholder="Search role"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{
              width: 188,
              marginBottom: 8,
              display: 'block',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
            }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
            <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>
              Reset
            </Button>
          </Space>
        </div>
      ),
      onFilter: (value, record) => record.role.toLowerCase().includes(String(value).toLowerCase()),
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{text}</div>
          {record.job_url && (
            <a href={record.job_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              Open role →
            </a>
          )}
        </div>
      ),
    },
    {
      title: 'Applied',
      dataIndex: 'date_applied',
      key: 'date_applied',
      sorter: (a, b) => new Date(a.date_applied).getTime() - new Date(b.date_applied).getTime(),
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: APPLICATION_STATUSES.map(status => ({ text: status, value: status })),
      onFilter: (value, record) => record.status === value,
      width: 130,
      render: (status: ApplicationStatus, record) => (
        <Tag 
          color={getStatusColor(status)}
          style={{ cursor: 'pointer', fontWeight: 600 }}
          onClick={() => updateApplicationStatus(record.id, status)}
        >
          {status}
        </Tag>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      sorter: (a, b) => (a.location || '').localeCompare(b.location || ''),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <input
            placeholder="Search location"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{
              width: 188,
              marginBottom: 8,
              display: 'block',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #d9d9d9',
            }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
            <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>
              Reset
            </Button>
          </Space>
        </div>
      ),
      onFilter: (value, record) => (record.location || '').toLowerCase().includes(String(value).toLowerCase()),
      width: 150,
      render: (text) => text || 'Remote / n/a',
    },
    {
      title: 'CV',
      key: 'cv',
      width: 60,
      render: (_, record) => {
        if (record.cv_file_url && record.cv_file_name) {
          return (
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => downloadFile(record.cv_file_url!, record.cv_file_name!)}
              title={record.cv_file_name}
            />
          );
        }
        return (
          <Button
            size="small"
            type="dashed"
            icon={<FilePdfOutlined />}
            onClick={() => openEditModal(record)}
            title="Add CV"
          />
        );
      },
    },
    {
      title: 'CL',
      key: 'cover_letter',
      width: 60,
      render: (_, record) => {
        if (record.cover_letter_file_url && record.cover_letter_file_name) {
          return (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => downloadFile(record.cover_letter_file_url!, record.cover_letter_file_name!)}
              title={record.cover_letter_file_name}
            />
          );
        }
        return (
          <Button
            size="small"
            type="dashed"
            icon={<FileTextOutlined />}
            onClick={() => openEditModal(record)}
            title="Add Cover Letter"
          />
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Edit
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteApplication(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ], []);

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

        {error ? <div className="auth-banner auth-banner--error">{error}</div> : null}
        {notice ? <div className="auth-banner auth-banner--success">{notice}</div> : null}

        <section className="table-panel">
          <div className="table-controls">
            <div className="table-info">
              <h3 className="table-title">Applications</h3>
              <span className="table-count">{applications.length} total</span>
            </div>
            <div className="table-controls-right">
              {applications.length > 0 && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={exportToExcel}
                  size="large"
                >
                  Export to Excel
                </Button>
              )}
            </div>
          </div>

          <ConfigProvider
            theme={{
              algorithm: theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
              token: {
                colorPrimary: '#6b7fff',
                colorBgContainer: theme === 'dark' ? '#1a1d2e' : '#ffffff',
                colorBgElevated: theme === 'dark' ? '#22263a' : '#ffffff',
                colorBorder: theme === 'dark' ? '#2d3348' : 'rgba(79, 95, 255, 0.12)',
                colorText: theme === 'dark' ? '#e5e7eb' : '#1f2937',
                colorTextSecondary: theme === 'dark' ? '#9ca3af' : '#6b7280',
                borderRadius: 8,
                fontSize: 14,
              },
              components: {
                Table: {
                  headerBg: theme === 'dark' ? '#22263a' : 'rgba(79, 95, 255, 0.04)',
                  headerColor: theme === 'dark' ? '#e5e7eb' : '#1f2937',
                  rowHoverBg: theme === 'dark' ? 'rgba(107, 127, 255, 0.08)' : 'rgba(79, 95, 255, 0.06)',
                  borderColor: theme === 'dark' ? '#2d3348' : 'rgba(79, 95, 255, 0.12)',
                },
                Button: {
                  primaryShadow: '0 2px 8px rgba(107, 127, 255, 0.3)',
                },
                Pagination: {
                  itemActiveBg: '#6b7fff',
                },
              },
            }}
          >
            <Table
              columns={columns}
              dataSource={applications}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} applications`,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              scroll={{ x: 1200 }}
              size="middle"
              bordered
              loading={loading}
            />
          </ConfigProvider>
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
