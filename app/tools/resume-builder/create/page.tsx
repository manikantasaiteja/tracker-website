"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionType =
  | "personal" | "summary" | "experience" | "education" | "skills"
  | "languages" | "certifications" | "interests" | "projects"
  | "awards" | "organisations" | "publications" | "references"
  | "declaration" | "custom";

type ActiveSection = { id: string; type: SectionType; title: string };

type ResumeData = {
  fullName: string; jobTitle: string; email: string; phone: string;
  location: string; linkedin: string; website: string; summary: string;
  photo: string | null; photoShape: "circle" | "square" | "rounded";
  photoPosition: "left" | "top" | "right";
  experiences:    Array<{ id: string; jobTitle: string; company: string; location: string; startDate: string; endDate: string; current: boolean; responsibilities: string }>;
  education:      Array<{ id: string; degree: string; institution: string; location: string; graduationDate: string; gpa: string }>;
  skills:         Array<{ id: string; name: string; level: string }>;
  languages:      Array<{ id: string; name: string; proficiency: string }>;
  certifications: Array<{ id: string; name: string; issuer: string; date: string }>;
  interests:      Array<{ id: string; name: string }>;
  projects:       Array<{ id: string; name: string; role: string; startDate: string; endDate: string; description: string; url: string }>;
  awards:         Array<{ id: string; title: string; issuer: string; date: string; description: string }>;
  organisations:  Array<{ id: string; name: string; role: string; startDate: string; endDate: string; description: string }>;
  publications:   Array<{ id: string; title: string; publisher: string; date: string; url: string; description: string }>;
  references:     Array<{ id: string; name: string; company: string; position: string; email: string; phone: string }>;
  declaration:    string;
  customSections: Array<{ id: string; title: string; content: string }>;
};

type Template = { id: string; name: string; category: string; color: string; icon: string };

// ─── Customization Style ──────────────────────────────────────────────────────
type ResumeStyle = {
  // Layout
  columns: "one" | "two" | "mix";
  // Spacing
  fontSize: number;        // pt  8-14
  lineHeight: number;      // 1.0-2.0
  leftRightMargin: number; // mm  5-25
  topBottomMargin: number; // mm  5-25
  spaceBetweenEntries: number; // 0-8
  // Entry Layout
  entryLayout: "a" | "b" | "c" | "d";
  columnWidth: "auto" | "manual";
  titleSize: "s" | "m" | "l";
  subtitleStyle: "normal" | "bold" | "italic";
  subtitlePlacement: "same" | "next";
  descriptionIndent: boolean;
  listStyle: "bullet" | "hyphen";
  // Font
  fontCategory: "serif" | "sans" | "mono";
  fontFamily: string;
  // Colors
  accentColor: string;
  // Section Headings
  headingStyle: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7";
  headingCapitalization: "capitalize" | "uppercase";
  headingSize: "s" | "m" | "l" | "xl";
  headingIcons: "none" | "outline" | "filled";
  // Link Styling
  linkUnderline: boolean;
  linkBlue: boolean;
  linkIcon: boolean;
  linkIconStyle: "a" | "b";
  // Header Layout
  headerAlignment: "left" | "center";
  detailsArrangement: "a" | "b" | "c" | "icon" | "bullet" | "bar";
  // Name
  nameSize: "xs" | "s" | "m" | "l" | "xl";
  nameBold: boolean;
  nameFont: "body" | "creative";
  // Professional Title
  titleSizeHeader: "s" | "m" | "l";
  titlePosition: "same" | "below";
  titleStyle: "normal" | "italic";
  // Photo
  showPhoto: boolean;
  photoGrayscale: boolean;
  photoPosition: "left" | "top" | "right";
  photoSize: "xs" | "s" | "m" | "l" | "xl";
  photoShape: "circle" | "sq1" | "sq2" | "sq3" | "sq4";
  // Skills display
  skillsDisplay: "grid" | "level" | "compact" | "bubble" | "bullet" | "pipe" | "newline" | "comma";
  skillsSubinfo: "dash" | "colon" | "bracket";
  // Languages display
  languagesDisplay: "grid" | "level" | "compact" | "bubble" | "bullet" | "pipe" | "newline" | "comma";
  languagesSubinfo: "dash" | "colon" | "bracket";
  // Summary
  summaryInHeader: boolean;
  summaryShowHeading: boolean;
  // Footer
  footerPageNumbers: boolean;
  footerEmail: boolean;
  footerName: boolean;
};

const DEFAULT_STYLE: ResumeStyle = {
  columns: "one",
  fontSize: 10, lineHeight: 1.15, leftRightMargin: 12, topBottomMargin: 14, spaceBetweenEntries: 1,
  entryLayout: "a", columnWidth: "auto", titleSize: "s", subtitleStyle: "normal",
  subtitlePlacement: "same", descriptionIndent: false, listStyle: "bullet",
  fontCategory: "sans", fontFamily: "Source Sans Pro",
  accentColor: "#4f46e5",
  headingStyle: "5", headingCapitalization: "uppercase", headingSize: "s", headingIcons: "none",
  linkUnderline: false, linkBlue: false, linkIcon: true, linkIconStyle: "b",
  headerAlignment: "left", detailsArrangement: "b",
  nameSize: "s", nameBold: true, nameFont: "body",
  titleSizeHeader: "s", titlePosition: "same", titleStyle: "normal",
  showPhoto: false, photoGrayscale: false, photoPosition: "left",
  photoSize: "xs", photoShape: "circle",
  skillsDisplay: "compact", skillsSubinfo: "dash",
  languagesDisplay: "comma", languagesSubinfo: "bracket",
  summaryInHeader: false, summaryShowHeading: true,
  footerPageNumbers: false, footerEmail: true, footerName: false,
};

const FONT_FAMILIES = {
  sans:  ["Source Sans Pro","Karla","Mulish","Lato","Titillium Web","Work Sans","Barlow","Jost","Fira Sans","Roboto","Rubik","Asap","Nunito","Open Sans","IBM Plex Sans"],
  serif: ["Georgia","Merriweather","Playfair Display","Lora","EB Garamond","Libre Baskerville"],
  mono:  ["Fira Code","JetBrains Mono","Source Code Pro","Roboto Mono","IBM Plex Mono"],
};

const ACCENT_COLORS = [
  "#000000","#1a3a2a","#1a3a3a","#1a2a3a","#1a1a3a","#2a1a3a",
  "#6b2a2a","#8b3a3a","#c0392b","#e74c3c","#3498db","#5b2d8e",
];

// ─── Available content blocks (the "Add Content" modal) ───────────────────────

const CONTENT_BLOCKS: Array<{ type: SectionType; icon: string; label: string; description: string }> = [
  { type: "education",      icon: "🎓", label: "Education",        description: "Add your degrees and schools. Include your focus, honors, or exchange terms." },
  { type: "experience",     icon: "💼", label: "Work Experience",   description: "Add your professional roles and employer history including internships." },
  { type: "skills",         icon: "🎯", label: "Skills",            description: "Add your hard and soft skills that help you stand out from the crowd today." },
  { type: "languages",      icon: "🌐", label: "Language Skills",   description: "Add your languages and proficiency level to show your communication range." },
  { type: "certifications", icon: "📜", label: "Certificates",      description: "Add your industry certificates or licences. Include issuer and date earned." },
  { type: "interests",      icon: "⭐", label: "Interests",         description: "Add relevant personal interests that support your career story and cultural fit." },
  { type: "projects",       icon: "🖥️", label: "Design Projects",   description: "Add key projects you participated in and highlight your challenges, role, and impact." },
  { type: "awards",         icon: "🏆", label: "Awards",            description: "Add your awards and recognitions from industry, competitions, or academia." },
  { type: "organisations",  icon: "🏢", label: "Organisations",     description: "Add your memberships or volunteering with organisations including your role." },
  { type: "publications",   icon: "📖", label: "Publications",      description: "Add publications, articles, or books you wrote or contributed to." },
  { type: "references",     icon: "👥", label: "References",        description: "Add your references from managers or coworkers, including their contact details." },
  { type: "declaration",    icon: "✍️", label: "Declaration",       description: "Add your declaration by creating or uploading your personal signature." },
  { type: "custom",         icon: "🧩", label: "Custom",            description: "Add a custom section for anything else, or combine sections cleanly." },
];

const TEMPLATES: Template[] = [
  { id: "classic",      name: "Classic Serif",    category: "Traditional",  color: "#1f2937", icon: "📄" },
  { id: "modern",       name: "Modern Blue",      category: "Professional", color: "#3b82f6", icon: "✨" },
  { id: "atlantic",     name: "Atlantic Blue",    category: "Professional", color: "#0ea5e9", icon: "🌊" },
  { id: "executive",    name: "Executive",        category: "Traditional",  color: "#374151", icon: "👔" },
  { id: "creative",     name: "Creative Purple",  category: "Creative",     color: "#8b5cf6", icon: "🎨" },
  { id: "minimal",      name: "Minimal",          category: "Modern",       color: "#6b7280", icon: "⚡" },
];

const PROFICIENCY_LEVELS = ["Native", "Fluent", "Advanced", "Intermediate", "Basic"];
const SKILL_LEVELS       = ["Expert", "Advanced", "Intermediate", "Beginner"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

const DEFAULT_DATA: ResumeData = {
  fullName: "", jobTitle: "", email: "", phone: "", location: "",
  linkedin: "", website: "", summary: "",
  photo: null, photoShape: "circle", photoPosition: "left",
  experiences: [], education: [], skills: [], languages: [],
  certifications: [], interests: [], projects: [], awards: [],
  organisations: [], publications: [], references: [],
  declaration: "", customSections: [],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResumeBuilderPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() =>
    typeof window === "undefined" ? null : createBrowserSupabaseClient()
  );

  const [loading, setLoading]               = useState(true);
  const [resumeData, setResumeData]         = useState<ResumeData>(DEFAULT_DATA);
  const [activeSections, setActiveSections] = useState<ActiveSection[]>([
    { id: "personal",   type: "personal",   title: "Personal Information" },
    { id: "summary",    type: "summary",    title: "Professional Summary" },
    { id: "experience", type: "experience", title: "Work Experience" },
    { id: "education",  type: "education",  title: "Education" },
    { id: "skills",     type: "skills",     title: "Skills" },
  ]);
  const [openSection,       setOpenSection]       = useState<string>("personal");
  const [selectedTemplate,  setSelectedTemplate]  = useState("modern");
  const [zoomLevel,         setZoomLevel]         = useState(75);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAddModal,      setShowAddModal]      = useState(false);
  const [showCustomize,     setShowCustomize]     = useState(false);
  const [customizeTab,      setCustomizeTab]      = useState<"layout"|"spacing"|"font"|"colors"|"headings"|"links"|"header"|"name"|"photo"|"skills"|"languages"|"summary">("layout");
  const [style,             setStyle]             = useState<ResumeStyle>(DEFAULT_STYLE);
  const [saveNotification,  setSaveNotification]  = useState<string>("");
  const [activeNavSection,  setActiveNavSection]  = useState<string>("");
  
  const updStyle = (patch: Partial<ResumeStyle>) => setStyle(prev => ({ ...prev, ...patch }));

  // ── Auth + load draft ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) { router.replace("/login"); return; }

      const { data: profile } = await supabase
        .from("user_profiles").select("*").eq("id", session.user.id).single();

      const base: Partial<ResumeData> = {
        fullName: profile?.full_name || session.user.user_metadata?.full_name || "",
        email:    session.user.email || "",
        phone:    profile?.phone_number || "",
      };

      const draft = localStorage.getItem("fcv-draft");
      const tmpl  = localStorage.getItem("fcv-template");
      const sects = localStorage.getItem("fcv-sections");

      if (draft)  { try { const d = JSON.parse(draft);  setResumeData({ ...DEFAULT_DATA, ...d, ...base }); } catch {} }
      else        { setResumeData(prev => ({ ...prev, ...base })); }
      if (tmpl)   { setSelectedTemplate(tmpl); }
      if (sects)  { try { setActiveSections(JSON.parse(sects)); } catch {} }

      const savedStyle = localStorage.getItem("fcv-style");
      if (savedStyle) { try { setStyle(s => ({ ...DEFAULT_STYLE, ...JSON.parse(savedStyle) })); } catch {} }

      setLoading(false);
    })();
  }, [supabase, router]);

  // ── Auto-save with notification ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem("fcv-draft",    JSON.stringify(resumeData));
      localStorage.setItem("fcv-template", selectedTemplate);
      localStorage.setItem("fcv-sections", JSON.stringify(activeSections));
      localStorage.setItem("fcv-style",    JSON.stringify(style));
      
      // Show save notification
      setSaveNotification("✓ Auto-saved");
      const notifTimer = setTimeout(() => setSaveNotification(""), 2000);
      return () => clearTimeout(notifTimer);
    }, 800);
    return () => clearTimeout(t);
  }, [resumeData, selectedTemplate, activeSections, style]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Save customization
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        localStorage.setItem("fcv-style", JSON.stringify(style));
        setSaveNotification("✓ Customization saved");
        setTimeout(() => setSaveNotification(""), 2000);
      }
      // Ctrl/Cmd + P: Download PDF
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [style]);

  // ── Section management ─────────────────────────────────────────────────────
  const addSection = (type: SectionType, label: string) => {
    const block = CONTENT_BLOCKS.find(b => b.type === type);
    const title = block?.label ?? label;
    const id    = type === "custom" ? uid() : type;
    if (activeSections.find(s => s.id === id && type !== "custom")) return;
    setActiveSections(prev => [...prev, { id, type, title }]);
    setOpenSection(id);
    setShowAddModal(false);
  };

  const removeSection = (id: string) => {
    setActiveSections(prev => prev.filter(s => s.id !== id));
    if (openSection === id) setOpenSection("");
  };

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    setActiveNavSection(sectionId);
    setOpenSection(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Clear draft
  const clearDraft = () => {
    if (confirm("Are you sure you want to clear all resume data? Your name, email, and phone will be kept.")) {
      const { fullName, email, phone } = resumeData;
      setResumeData({ ...DEFAULT_DATA, fullName, email, phone });
      setSaveNotification("✓ Draft cleared");
      setTimeout(() => setSaveNotification(""), 2000);
    }
  };

  // ── Data helpers ───────────────────────────────────────────────────────────
  const upd = (patch: Partial<ResumeData>) => setResumeData(prev => ({ ...prev, ...patch }));

  function arrAdd<T>(key: keyof ResumeData, item: T) {
    setResumeData(prev => ({ ...prev, [key]: [...(prev[key] as T[]), item] }));
  }
  function arrRemove(key: keyof ResumeData, idx: number) {
    setResumeData(prev => ({ ...prev, [key]: (prev[key] as any[]).filter((_: any, i: number) => i !== idx) }));
  }
  function arrUpdate<T>(key: keyof ResumeData, idx: number, patch: Partial<T>) {
    setResumeData(prev => {
      const arr = [...(prev[key] as T[])];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, [key]: arr };
    });
  }

  // ── Photo ──────────────────────────────────────────────────────────────────
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max 5 MB"); return; }
    if (!file.type.startsWith("image/")) { alert("Images only"); return; }
    const reader = new FileReader();
    reader.onloadend = () => upd({ photo: reader.result as string });
    reader.readAsDataURL(file);
  };

  if (loading || !supabase) {
    return (
      <main className="route-loader">
        <div className="route-loader__pulse" />
        <p>Loading Resume Builder…</p>
      </main>
    );
  }

  // ── Render section editor ──────────────────────────────────────────────────
  const renderSectionEditor = (sec: ActiveSection) => {
    const open = openSection === sec.id;
    const block = CONTENT_BLOCKS.find(b => b.type === sec.type);
    const icon  = block?.icon ?? "📄";

    return (
      <div key={sec.id} className="flowcv-section" id={`section-${sec.id}`}>
        <button
          className="flowcv-section-header"
          onClick={() => setOpenSection(open ? "" : sec.id)}
        >
          <span className="section-icon">{icon}</span>
          <span className="section-title">{sec.title}</span>
          <div className="section-header-actions">
            {sec.type !== "personal" && sec.type !== "summary" && (
              <span
                className="section-remove-icon"
                title="Remove section"
                onClick={(e) => { e.stopPropagation(); removeSection(sec.id); }}
              >✕</span>
            )}
            <span className="section-toggle">{open ? "−" : "+"}</span>
          </div>
        </button>

        {open && (
          <div className="flowcv-section-content">
            {sec.type === "personal"       && <PersonalEditor   data={resumeData} upd={upd} handlePhoto={handlePhoto} />}
            {sec.type === "summary"        && <SummaryEditor    data={resumeData} upd={upd} />}
            {sec.type === "experience"     && <ExperienceEditor data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "education"      && <EducationEditor  data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "skills"         && <SkillsEditor     data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "languages"      && <LanguagesEditor  data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "certifications" && <CertsEditor      data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "interests"      && <InterestsEditor  data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "projects"       && <ProjectsEditor   data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "awards"         && <AwardsEditor     data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "organisations"  && <OrgsEditor       data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "publications"   && <PublicationsEditor data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "references"     && <ReferencesEditor data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
            {sec.type === "declaration"    && <DeclarationEditor data={resumeData} upd={upd} />}
            {sec.type === "custom"         && <CustomEditor     secId={sec.id} data={resumeData} arrAdd={arrAdd} arrRemove={arrRemove} arrUpdate={arrUpdate} />}
          </div>
        )}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="flowcv-shell">
      {/* Top Bar */}
      <header className="flowcv-topbar">
        <div className="flowcv-topbar-left">
          <Link href="/tools" className="flowcv-back-btn">← Back to Tools</Link>
          <div className="flowcv-doc-title">
            <span className="flowcv-title-text">
              {resumeData.fullName ? `${resumeData.fullName}'s Resume` : "Untitled Resume"}
            </span>
            <span className="flowcv-autosave">{saveNotification || "✓ Saved"}</span>
          </div>
        </div>
        <div className="flowcv-topbar-right">
          <button className="flowcv-btn-secondary" onClick={() => setShowTemplateModal(true)} title="Change template">
            🎨 Template
          </button>
          <button className="flowcv-btn-secondary" onClick={() => setShowCustomize(c => !c)} title="Customize design">
            ⚙️ Customize
          </button>
          <button className="flowcv-btn-secondary" onClick={clearDraft} title="Clear all data">
            🗑️ Clear
          </button>
          <button className="flowcv-btn-primary" onClick={() => window.print()} title="Download as PDF (Ctrl/Cmd + P)">
            ⬇ Download PDF
          </button>
        </div>
      </header>

      {/* Quick Tips Panel */}
      <div className="flowcv-quick-tips">
        <div className="quick-tip">
          <span className="tip-icon">⌨️</span>
          <span className="tip-text"><strong>Ctrl/Cmd + S</strong> to save customization</span>
        </div>
        <div className="quick-tip">
          <span className="tip-icon">📄</span>
          <span className="tip-text"><strong>Ctrl/Cmd + P</strong> to download PDF</span>
        </div>
        <div className="quick-tip">
          <span className="tip-icon">💾</span>
          <span className="tip-text">Auto-save is <strong>active</strong></span>
        </div>
      </div>

      {/* Workspace */}
      <div className="flowcv-workspace">
        {/* ── Navigation Sidebar ── */}
        <aside className="flowcv-nav-sidebar">
          <div className="nav-sidebar-header">
            <h3>Sections</h3>
            <p>Click to navigate</p>
          </div>
          <div className="nav-sidebar-list">
            {activeSections.map(sec => {
              const block = CONTENT_BLOCKS.find(b => b.type === sec.type);
              const icon = block?.icon ?? "📄";
              return (
                <button
                  key={sec.id}
                  className={`nav-sidebar-item ${activeNavSection === sec.id ? 'active' : ''}`}
                  onClick={() => scrollToSection(sec.id)}
                  title={`Jump to ${sec.title}`}
                >
                  <span className="nav-item-icon">{icon}</span>
                  <span className="nav-item-title">{sec.title}</span>
                </button>
              );
            })}
          </div>
          <div className="nav-sidebar-actions">
            <button className="nav-action-btn" onClick={() => setShowAddModal(true)} title="Add new section">
              ➕ Add Section
            </button>
            {activeSections.some(s => s.type === 'experience') && (
              <button 
                className="nav-action-btn" 
                onClick={() => {
                  scrollToSection('experience');
                  arrAdd("experiences", { id: uid(), jobTitle: "", company: "", location: "", startDate: "", endDate: "", current: false, responsibilities: "" });
                }}
                title="Quick add experience"
              >
                💼 Add Experience
              </button>
            )}
            {activeSections.some(s => s.type === 'education') && (
              <button 
                className="nav-action-btn" 
                onClick={() => {
                  scrollToSection('education');
                  arrAdd("education", { id: uid(), degree: "", institution: "", location: "", graduationDate: "", gpa: "" });
                }}
                title="Quick add education"
              >
                🎓 Add Education
              </button>
            )}
          </div>
        </aside>

        {/* ── Editor ── */}
        <aside className="flowcv-editor">
          <div className="flowcv-editor-header">
            <h2>Resume Content</h2>
            <p>Fill in your information below</p>
          </div>

          <div className="flowcv-sections">
            {activeSections.map(renderSectionEditor)}
          </div>

          {/* Add Content button */}
          <div className="flowcv-add-section-wrap">
            <button className="flowcv-add-section-btn" onClick={() => setShowAddModal(true)}>
              + Add Content
            </button>
          </div>
        </aside>

        {/* ── Customize Panel ── */}
        {showCustomize && (
          <aside className="fcv-customize-panel">
            <CustomizePanel style={style} updStyle={updStyle} sections={activeSections} setSections={setActiveSections} />
          </aside>
        )}

        {/* ── Preview ── */}
        <main className="flowcv-preview-area">
          <div className="flowcv-preview-controls">
            <div className="flowcv-zoom-controls">
              <button onClick={() => setZoomLevel(z => Math.max(40, z - 10))} title="Zoom out">−</button>
              <span>{zoomLevel}%</span>
              <button onClick={() => setZoomLevel(z => Math.min(150, z + 10))} title="Zoom in">+</button>
            </div>
          </div>

          <div className="flowcv-preview-outer">
            <div className="flowcv-preview-container" style={{ transform: `scale(${zoomLevel / 100})` }}>
              <ResumePreview data={resumeData} sections={activeSections} style={style} />
            </div>
          </div>
        </main>
      </div>

      {/* ── Add Content Modal ── */}
      {showAddModal && (
        <div className="flowcv-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="flowcv-modal flowcv-add-modal" onClick={e => e.stopPropagation()}>
            <div className="flowcv-modal-header">
              <h2>Add content</h2>
              <button className="flowcv-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="flowcv-add-grid">
              {CONTENT_BLOCKS.map(block => {
                const alreadyAdded = activeSections.some(s => s.type === block.type) && block.type !== "custom";
                return (
                  <button
                    key={block.type}
                    className={`flowcv-add-card ${alreadyAdded ? "added" : ""}`}
                    onClick={() => !alreadyAdded && addSection(block.type, block.label)}
                    disabled={alreadyAdded}
                  >
                    <div className="add-card-icon">{block.icon}</div>
                    <div className="add-card-body">
                      <strong>{block.label}</strong>
                      <p>{block.description}</p>
                    </div>
                    {alreadyAdded && <span className="add-card-badge">Added</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Template Modal ── */}
      {showTemplateModal && (
        <div className="flowcv-modal-backdrop" onClick={() => setShowTemplateModal(false)}>
          <div className="flowcv-modal" onClick={e => e.stopPropagation()}>
            <div className="flowcv-modal-header">
              <h2>Choose a Template</h2>
              <button className="flowcv-close-btn" onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>
            <div className="flowcv-templates-grid">
              {TEMPLATES.map(t => (
                <div
                  key={t.id}
                  className={`flowcv-template-card ${selectedTemplate === t.id ? "selected" : ""}`}
                  onClick={() => { setSelectedTemplate(t.id); setShowTemplateModal(false); }}
                >
                  <div className="flowcv-template-preview" style={{ background: t.color }}>
                    <span className="flowcv-template-icon">{t.icon}</span>
                  </div>
                  <div className="flowcv-template-info">
                    <strong>{t.name}</strong>
                    <span>{t.category}</span>
                  </div>
                  {selectedTemplate === t.id && <div className="flowcv-selected-badge">✓</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION EDITORS
// ═══════════════════════════════════════════════════════════════════════════════

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flowcv-field"><label>{label}</label>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flowcv-field-row">{children}</div>;
}
function EntryBlock({ title, onRemove, children }: { title: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flowcv-entry-block">
      <div className="flowcv-entry-header">
        <span>{title}</span>
        <button className="flowcv-remove-btn" onClick={onRemove}>✕</button>
      </div>
      {children}
    </div>
  );
}

// ── Personal ──────────────────────────────────────────────────────────────────
function PersonalEditor({ data, upd, handlePhoto }: { data: ResumeData; upd: (p: Partial<ResumeData>) => void; handlePhoto: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <>
      {/* Photo */}
      <div className="flowcv-photo-section">
        <label>Profile Photo (Optional)</label>
        <div className="flowcv-photo-upload">
          {data.photo ? (
            <div className="flowcv-photo-preview">
              <img src={data.photo} alt="Profile" className={`flowcv-photo-img ${data.photoShape}`} />
              <button className="flowcv-photo-remove" onClick={() => upd({ photo: null })}>✕</button>
            </div>
          ) : (
            <label className="flowcv-photo-upload-btn">
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
              <div className="flowcv-photo-placeholder">
                <span className="flowcv-photo-icon">📷</span>
                <span>Upload Photo</span>
                <span className="flowcv-photo-hint">Max 5 MB</span>
              </div>
            </label>
          )}
        </div>
        {data.photo && (
          <div className="flowcv-photo-options">
            <Field label="Photo Shape">
              <div className="flowcv-photo-shapes">
                {(["circle","square","rounded"] as const).map(s => (
                  <button key={s} type="button" className={`flowcv-shape-btn ${s} ${data.photoShape === s ? "active" : ""}`} onClick={() => upd({ photoShape: s })}>
                    <div className={`shape-preview ${s}`}></div>
                    <span>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Photo Position">
              <div className="flowcv-position-btns">
                {(["left","top","right"] as const).map(p => (
                  <button key={p} type="button" className={`flowcv-pos-btn ${data.photoPosition === p ? "active" : ""}`} onClick={() => upd({ photoPosition: p })}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}
      </div>

      <Field label="Full Name *"><input value={data.fullName} onChange={e => upd({ fullName: e.target.value })} placeholder="John Doe" /></Field>
      <Field label="Job Title"><input value={data.jobTitle} onChange={e => upd({ jobTitle: e.target.value })} placeholder="Software Engineer" /></Field>
      <Row>
        <Field label="Email *"><input type="email" value={data.email} onChange={e => upd({ email: e.target.value })} placeholder="john@example.com" /></Field>
        <Field label="Phone *"><input type="tel" value={data.phone} onChange={e => upd({ phone: e.target.value })} placeholder="+1 234 567 8900" /></Field>
      </Row>
      <Field label="Location"><input value={data.location} onChange={e => upd({ location: e.target.value })} placeholder="New York, NY" /></Field>
      <Row>
        <Field label="LinkedIn"><input type="url" value={data.linkedin} onChange={e => upd({ linkedin: e.target.value })} placeholder="linkedin.com/in/johndoe" /></Field>
        <Field label="Website"><input type="url" value={data.website} onChange={e => upd({ website: e.target.value })} placeholder="johndoe.com" /></Field>
      </Row>
    </>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
function SummaryEditor({ data, upd }: { data: ResumeData; upd: (p: Partial<ResumeData>) => void }) {
  return (
    <Field label="Summary">
      <textarea rows={4} value={data.summary} onChange={e => upd({ summary: e.target.value })} placeholder="Write a brief professional summary (2–3 sentences)…" />
    </Field>
  );
}

// ── Experience ────────────────────────────────────────────────────────────────
function ExperienceEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.experiences.map((exp: any, i: number) => (
        <EntryBlock key={exp.id} title={exp.jobTitle || `Experience #${i + 1}`} onRemove={() => arrRemove("experiences", i)}>
          <Field label="Job Title *"><input value={exp.jobTitle} onChange={e => arrUpdate("experiences", i, { jobTitle: e.target.value })} placeholder="Software Engineer" /></Field>
          <Field label="Company *"><input value={exp.company} onChange={e => arrUpdate("experiences", i, { company: e.target.value })} placeholder="Tech Company Inc." /></Field>
          <Field label="Location"><input value={exp.location} onChange={e => arrUpdate("experiences", i, { location: e.target.value })} placeholder="New York, NY" /></Field>
          <Row>
            <Field label="Start Date"><input value={exp.startDate} onChange={e => arrUpdate("experiences", i, { startDate: e.target.value })} placeholder="Jan 2020" /></Field>
            <Field label="End Date"><input value={exp.endDate} onChange={e => arrUpdate("experiences", i, { endDate: e.target.value })} placeholder="Present" disabled={exp.current} /></Field>
          </Row>
          <label className="flowcv-checkbox">
            <input type="checkbox" checked={exp.current} onChange={e => arrUpdate("experiences", i, { current: e.target.checked })} />
            <span>I currently work here</span>
          </label>
          <Field label="Description">
            <textarea rows={4} value={exp.responsibilities} onChange={e => arrUpdate("experiences", i, { responsibilities: e.target.value })} placeholder={"• Developed web applications\n• Improved performance by 40%"} />
          </Field>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("experiences", { id: uid(), jobTitle: "", company: "", location: "", startDate: "", endDate: "", current: false, responsibilities: "" })}>+ Add Experience</button>
    </>
  );
}

// ── Education ─────────────────────────────────────────────────────────────────
function EducationEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.education.map((edu: any, i: number) => (
        <EntryBlock key={edu.id} title={edu.degree || `Education #${i + 1}`} onRemove={() => arrRemove("education", i)}>
          <Field label="Degree *"><input value={edu.degree} onChange={e => arrUpdate("education", i, { degree: e.target.value })} placeholder="Bachelor of Science in Computer Science" /></Field>
          <Field label="Institution *"><input value={edu.institution} onChange={e => arrUpdate("education", i, { institution: e.target.value })} placeholder="University Name" /></Field>
          <Field label="Location"><input value={edu.location} onChange={e => arrUpdate("education", i, { location: e.target.value })} placeholder="New York, NY" /></Field>
          <Row>
            <Field label="Graduation Date"><input value={edu.graduationDate} onChange={e => arrUpdate("education", i, { graduationDate: e.target.value })} placeholder="May 2020" /></Field>
            <Field label="GPA"><input value={edu.gpa} onChange={e => arrUpdate("education", i, { gpa: e.target.value })} placeholder="3.8 / 4.0" /></Field>
          </Row>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("education", { id: uid(), degree: "", institution: "", location: "", graduationDate: "", gpa: "" })}>+ Add Education</button>
    </>
  );
}

// ── Skills ────────────────────────────────────────────────────────────────────
function SkillsEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.skills.map((s: any, i: number) => (
        <div key={s.id} className="flowcv-skill-row">
          <input className="flowcv-skill-input" value={s.name} onChange={e => arrUpdate("skills", i, { name: e.target.value })} placeholder="e.g. JavaScript" />
          <select className="flowcv-skill-level" value={s.level} onChange={e => arrUpdate("skills", i, { level: e.target.value })}>
            {SKILL_LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          <button className="flowcv-remove-btn-small" onClick={() => arrRemove("skills", i)}>✕</button>
        </div>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("skills", { id: uid(), name: "", level: "Intermediate" })}>+ Add Skill</button>
    </>
  );
}

// ── Languages ─────────────────────────────────────────────────────────────────
function LanguagesEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.languages.map((l: any, i: number) => (
        <div key={l.id} className="flowcv-skill-row">
          <input className="flowcv-skill-input" value={l.name} onChange={e => arrUpdate("languages", i, { name: e.target.value })} placeholder="e.g. Spanish" />
          <select className="flowcv-skill-level" value={l.proficiency} onChange={e => arrUpdate("languages", i, { proficiency: e.target.value })}>
            {PROFICIENCY_LEVELS.map(p => <option key={p}>{p}</option>)}
          </select>
          <button className="flowcv-remove-btn-small" onClick={() => arrRemove("languages", i)}>✕</button>
        </div>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("languages", { id: uid(), name: "", proficiency: "Intermediate" })}>+ Add Language</button>
    </>
  );
}

// ── Certifications ────────────────────────────────────────────────────────────
function CertsEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.certifications.map((c: any, i: number) => (
        <EntryBlock key={c.id} title={c.name || `Certificate #${i + 1}`} onRemove={() => arrRemove("certifications", i)}>
          <Field label="Certificate Name *"><input value={c.name} onChange={e => arrUpdate("certifications", i, { name: e.target.value })} placeholder="AWS Certified Solutions Architect" /></Field>
          <Row>
            <Field label="Issuer"><input value={c.issuer} onChange={e => arrUpdate("certifications", i, { issuer: e.target.value })} placeholder="Amazon Web Services" /></Field>
            <Field label="Date Earned"><input value={c.date} onChange={e => arrUpdate("certifications", i, { date: e.target.value })} placeholder="Jun 2023" /></Field>
          </Row>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("certifications", { id: uid(), name: "", issuer: "", date: "" })}>+ Add Certificate</button>
    </>
  );
}

// ── Interests ─────────────────────────────────────────────────────────────────
function InterestsEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.interests.map((item: any, i: number) => (
        <div key={item.id} className="flowcv-skill-row">
          <input className="flowcv-skill-input" value={item.name} onChange={e => arrUpdate("interests", i, { name: e.target.value })} placeholder="e.g. Photography, Hiking, Open Source" />
          <button className="flowcv-remove-btn-small" onClick={() => arrRemove("interests", i)}>✕</button>
        </div>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("interests", { id: uid(), name: "" })}>+ Add Interest</button>
    </>
  );
}

// ── Projects ──────────────────────────────────────────────────────────────────
function ProjectsEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.projects.map((p: any, i: number) => (
        <EntryBlock key={p.id} title={p.name || `Project #${i + 1}`} onRemove={() => arrRemove("projects", i)}>
          <Field label="Project Name *"><input value={p.name} onChange={e => arrUpdate("projects", i, { name: e.target.value })} placeholder="E-commerce Platform" /></Field>
          <Field label="Your Role"><input value={p.role} onChange={e => arrUpdate("projects", i, { role: e.target.value })} placeholder="Lead Developer" /></Field>
          <Row>
            <Field label="Start Date"><input value={p.startDate} onChange={e => arrUpdate("projects", i, { startDate: e.target.value })} placeholder="Jan 2023" /></Field>
            <Field label="End Date"><input value={p.endDate} onChange={e => arrUpdate("projects", i, { endDate: e.target.value })} placeholder="Mar 2023" /></Field>
          </Row>
          <Field label="Project URL"><input type="url" value={p.url} onChange={e => arrUpdate("projects", i, { url: e.target.value })} placeholder="https://github.com/…" /></Field>
          <Field label="Description"><textarea rows={3} value={p.description} onChange={e => arrUpdate("projects", i, { description: e.target.value })} placeholder="Describe the project, your role, and impact…" /></Field>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("projects", { id: uid(), name: "", role: "", startDate: "", endDate: "", description: "", url: "" })}>+ Add Project</button>
    </>
  );
}

// ── Awards ────────────────────────────────────────────────────────────────────
function AwardsEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.awards.map((a: any, i: number) => (
        <EntryBlock key={a.id} title={a.title || `Award #${i + 1}`} onRemove={() => arrRemove("awards", i)}>
          <Field label="Award Title *"><input value={a.title} onChange={e => arrUpdate("awards", i, { title: e.target.value })} placeholder="Best Innovation Award" /></Field>
          <Row>
            <Field label="Issuer / Organisation"><input value={a.issuer} onChange={e => arrUpdate("awards", i, { issuer: e.target.value })} placeholder="Tech Conference 2023" /></Field>
            <Field label="Date"><input value={a.date} onChange={e => arrUpdate("awards", i, { date: e.target.value })} placeholder="Nov 2023" /></Field>
          </Row>
          <Field label="Description"><textarea rows={2} value={a.description} onChange={e => arrUpdate("awards", i, { description: e.target.value })} placeholder="Brief description of the award…" /></Field>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("awards", { id: uid(), title: "", issuer: "", date: "", description: "" })}>+ Add Award</button>
    </>
  );
}

// ── Organisations ─────────────────────────────────────────────────────────────
function OrgsEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.organisations.map((o: any, i: number) => (
        <EntryBlock key={o.id} title={o.name || `Organisation #${i + 1}`} onRemove={() => arrRemove("organisations", i)}>
          <Field label="Organisation Name *"><input value={o.name} onChange={e => arrUpdate("organisations", i, { name: e.target.value })} placeholder="Red Cross" /></Field>
          <Field label="Your Role"><input value={o.role} onChange={e => arrUpdate("organisations", i, { role: e.target.value })} placeholder="Volunteer Coordinator" /></Field>
          <Row>
            <Field label="Start Date"><input value={o.startDate} onChange={e => arrUpdate("organisations", i, { startDate: e.target.value })} placeholder="Jan 2021" /></Field>
            <Field label="End Date"><input value={o.endDate} onChange={e => arrUpdate("organisations", i, { endDate: e.target.value })} placeholder="Present" /></Field>
          </Row>
          <Field label="Description"><textarea rows={2} value={o.description} onChange={e => arrUpdate("organisations", i, { description: e.target.value })} placeholder="Describe your involvement…" /></Field>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("organisations", { id: uid(), name: "", role: "", startDate: "", endDate: "", description: "" })}>+ Add Organisation</button>
    </>
  );
}

// ── Publications ──────────────────────────────────────────────────────────────
function PublicationsEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.publications.map((p: any, i: number) => (
        <EntryBlock key={p.id} title={p.title || `Publication #${i + 1}`} onRemove={() => arrRemove("publications", i)}>
          <Field label="Title *"><input value={p.title} onChange={e => arrUpdate("publications", i, { title: e.target.value })} placeholder="Article or Book Title" /></Field>
          <Row>
            <Field label="Publisher"><input value={p.publisher} onChange={e => arrUpdate("publications", i, { publisher: e.target.value })} placeholder="Medium / IEEE / O'Reilly" /></Field>
            <Field label="Date"><input value={p.date} onChange={e => arrUpdate("publications", i, { date: e.target.value })} placeholder="Mar 2024" /></Field>
          </Row>
          <Field label="URL"><input type="url" value={p.url} onChange={e => arrUpdate("publications", i, { url: e.target.value })} placeholder="https://…" /></Field>
          <Field label="Description"><textarea rows={2} value={p.description} onChange={e => arrUpdate("publications", i, { description: e.target.value })} placeholder="Brief summary…" /></Field>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("publications", { id: uid(), title: "", publisher: "", date: "", url: "", description: "" })}>+ Add Publication</button>
    </>
  );
}

// ── References ────────────────────────────────────────────────────────────────
function ReferencesEditor({ data, arrAdd, arrRemove, arrUpdate }: any) {
  return (
    <>
      {data.references.map((r: any, i: number) => (
        <EntryBlock key={r.id} title={r.name || `Reference #${i + 1}`} onRemove={() => arrRemove("references", i)}>
          <Field label="Full Name *"><input value={r.name} onChange={e => arrUpdate("references", i, { name: e.target.value })} placeholder="Jane Smith" /></Field>
          <Row>
            <Field label="Company"><input value={r.company} onChange={e => arrUpdate("references", i, { company: e.target.value })} placeholder="Acme Corp" /></Field>
            <Field label="Position"><input value={r.position} onChange={e => arrUpdate("references", i, { position: e.target.value })} placeholder="Engineering Manager" /></Field>
          </Row>
          <Row>
            <Field label="Email"><input type="email" value={r.email} onChange={e => arrUpdate("references", i, { email: e.target.value })} placeholder="jane@acme.com" /></Field>
            <Field label="Phone"><input type="tel" value={r.phone} onChange={e => arrUpdate("references", i, { phone: e.target.value })} placeholder="+1 555 000 0000" /></Field>
          </Row>
        </EntryBlock>
      ))}
      <button className="flowcv-add-btn" onClick={() => arrAdd("references", { id: uid(), name: "", company: "", position: "", email: "", phone: "" })}>+ Add Reference</button>
    </>
  );
}

// ── Declaration ───────────────────────────────────────────────────────────────
function DeclarationEditor({ data, upd }: { data: ResumeData; upd: (p: Partial<ResumeData>) => void }) {
  return (
    <Field label="Declaration Statement">
      <textarea rows={4} value={data.declaration} onChange={e => upd({ declaration: e.target.value })} placeholder="I hereby declare that the information provided is true and correct to the best of my knowledge…" />
    </Field>
  );
}

// ── Custom ────────────────────────────────────────────────────────────────────
function CustomEditor({ secId, data, arrAdd, arrRemove, arrUpdate }: any) {
  const items = data.customSections.filter((c: any) => c.sectionId === secId);
  return (
    <>
      {items.map((c: any, i: number) => {
        const realIdx = data.customSections.findIndex((x: any) => x.id === c.id);
        return (
          <EntryBlock key={c.id} title={c.title || `Entry #${i + 1}`} onRemove={() => arrRemove("customSections", realIdx)}>
            <Field label="Title"><input value={c.title} onChange={e => arrUpdate("customSections", realIdx, { title: e.target.value })} placeholder="Entry title" /></Field>
            <Field label="Content"><textarea rows={3} value={c.content} onChange={e => arrUpdate("customSections", realIdx, { content: e.target.value })} placeholder="Describe this entry…" /></Field>
          </EntryBlock>
        );
      })}
      <button className="flowcv-add-btn" onClick={() => arrAdd("customSections", { id: uid(), sectionId: secId, title: "", content: "" })}>+ Add Entry</button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUME PREVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function PreviewSection({ title, children, headingStyle }: { title: string; children: React.ReactNode; headingStyle?: React.CSSProperties }) {
  return (
    <div className="flowcv-resume-section">
      <h2 style={headingStyle}>{title}</h2>
      {children}
    </div>
  );
}

function ResumePreview({ data, sections, style }: { data: ResumeData; sections: ActiveSection[]; style: ResumeStyle }) {
  const isEmpty = !data.fullName && !data.summary && data.experiences.length === 0 && data.education.length === 0;

  const fontMap: Record<string, string> = {
    "Source Sans Pro": "'Source Sans Pro', sans-serif",
    "Karla": "'Karla', sans-serif", "Mulish": "'Mulish', sans-serif",
    "Lato": "'Lato', sans-serif", "Roboto": "'Roboto', sans-serif",
    "Open Sans": "'Open Sans', sans-serif", "Nunito": "'Nunito', sans-serif",
    "Georgia": "Georgia, serif", "Merriweather": "'Merriweather', serif",
    "Fira Code": "'Fira Code', monospace",
  };
  const fontStack = fontMap[style.fontFamily] || `'${style.fontFamily}', sans-serif`;
  const accentColor = style.accentColor;

  const headingStyleCSS = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      color: accentColor,
      textTransform: style.headingCapitalization === "uppercase" ? "uppercase" : "capitalize",
      fontSize: style.headingSize === "s" ? "0.85rem" : style.headingSize === "m" ? "1rem" : style.headingSize === "l" ? "1.15rem" : "1.3rem",
      fontWeight: 700, marginBottom: "0.5rem", paddingBottom: "0.25rem",
    };
    switch (style.headingStyle) {
      case "0": return { ...base, borderBottom: `2px solid ${accentColor}` };
      case "1": return { ...base, borderBottom: `1px solid ${accentColor}` };
      case "2": return { ...base, background: accentColor, color: "#fff", padding: "0.25rem 0.5rem" };
      case "3": return { ...base, borderLeft: `4px solid ${accentColor}`, paddingLeft: "0.5rem" };
      case "4": return { ...base, letterSpacing: "0.15em" };
      case "5": return { ...base, borderBottom: `2px solid ${accentColor}` };
      default:  return base;
    }
  };

  return (
    <div
      className="flowcv-resume-page"
      id="resume-preview"
      style={{
        fontFamily: fontStack,
        fontSize: `${style.fontSize}pt`,
        lineHeight: style.lineHeight,
        padding: `${style.topBottomMargin}mm ${style.leftRightMargin}mm`,
      }}
    >
      {/* Header */}
      <div className={`flowcv-resume-header ${data.photo ? `with-photo photo-${data.photoPosition}` : ""}`}>
        {data.photo && (
          <div className={`flowcv-resume-photo ${data.photoShape}`}>
            <img src={data.photo} alt={data.fullName} />
          </div>
        )}
        <div className="flowcv-header-content">
          <h1>{data.fullName || "Your Name"}</h1>
          {data.jobTitle && <div className="flowcv-job-title">{data.jobTitle}</div>}
          <div className="flowcv-contact-info">
            {data.email    && <span>{data.email}</span>}
            {data.phone    && <span>{data.phone}</span>}
            {data.location && <span>{data.location}</span>}
          </div>
          {(data.linkedin || data.website) && (
            <div className="flowcv-links">
              {data.linkedin && <span>{data.linkedin}</span>}
              {data.website  && <span>{data.website}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic sections in order */}
      {sections.filter(s => s.type !== "personal").map(sec => {
        switch (sec.type) {
          case "summary":
            return data.summary ? (
              <PreviewSection key={sec.id} title="Professional Summary">
                <p style={{ margin: 0, color: "#374151", lineHeight: 1.7 }}>{data.summary}</p>
              </PreviewSection>
            ) : null;

          case "experience":
            return data.experiences.some(e => e.jobTitle || e.company) ? (
              <PreviewSection key={sec.id} title="Work Experience">
                {data.experiences.filter(e => e.jobTitle || e.company).map(exp => (
                  <div key={exp.id} className="flowcv-resume-entry">
                    <div className="flowcv-entry-title-row">
                      <strong>{exp.jobTitle}</strong>
                      {exp.startDate && <span className="flowcv-entry-dates">{exp.startDate} – {exp.current ? "Present" : exp.endDate || "Present"}</span>}
                    </div>
                    {exp.company && <div className="flowcv-entry-company">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</div>}
                    {exp.responsibilities && (
                      <div className="flowcv-entry-description">
                        {exp.responsibilities.split("\n").filter(l => l.trim()).map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    )}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          case "education":
            return data.education.some(e => e.degree || e.institution) ? (
              <PreviewSection key={sec.id} title="Education">
                {data.education.filter(e => e.degree || e.institution).map(edu => (
                  <div key={edu.id} className="flowcv-resume-entry">
                    <div className="flowcv-entry-title-row">
                      <strong>{edu.degree}</strong>
                      {edu.graduationDate && <span className="flowcv-entry-dates">{edu.graduationDate}</span>}
                    </div>
                    {edu.institution && <div className="flowcv-entry-company">{edu.institution}{edu.location ? ` · ${edu.location}` : ""}</div>}
                    {edu.gpa && <div className="flowcv-entry-meta-small">GPA: {edu.gpa}</div>}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          case "skills":
            return data.skills.some(s => s.name) ? (
              <PreviewSection key={sec.id} title="Skills">
                <div className="flowcv-skills-list">
                  {data.skills.filter(s => s.name).map(s => (
                    <span key={s.id} className="flowcv-skill-tag">{s.name}{s.level && s.level !== "Intermediate" ? ` · ${s.level}` : ""}</span>
                  ))}
                </div>
              </PreviewSection>
            ) : null;

          case "languages":
            return data.languages.some(l => l.name) ? (
              <PreviewSection key={sec.id} title="Language Skills">
                <div className="flowcv-skills-list">
                  {data.languages.filter(l => l.name).map(l => (
                    <span key={l.id} className="flowcv-skill-tag">{l.name} · {l.proficiency}</span>
                  ))}
                </div>
              </PreviewSection>
            ) : null;

          case "certifications":
            return data.certifications.some(c => c.name) ? (
              <PreviewSection key={sec.id} title="Certificates">
                {data.certifications.filter(c => c.name).map(c => (
                  <div key={c.id} className="flowcv-resume-entry">
                    <div className="flowcv-entry-title-row">
                      <strong>{c.name}</strong>
                      {c.date && <span className="flowcv-entry-dates">{c.date}</span>}
                    </div>
                    {c.issuer && <div className="flowcv-entry-company">{c.issuer}</div>}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          case "interests":
            return data.interests.some(i => i.name) ? (
              <PreviewSection key={sec.id} title="Interests">
                <div className="flowcv-skills-list">
                  {data.interests.filter(i => i.name).map(i => (
                    <span key={i.id} className="flowcv-skill-tag">{i.name}</span>
                  ))}
                </div>
              </PreviewSection>
            ) : null;

          case "projects":
            return data.projects.some(p => p.name) ? (
              <PreviewSection key={sec.id} title="Projects">
                {data.projects.filter(p => p.name).map(p => (
                  <div key={p.id} className="flowcv-resume-entry">
                    <div className="flowcv-entry-title-row">
                      <strong>{p.name}</strong>
                      {(p.startDate || p.endDate) && <span className="flowcv-entry-dates">{p.startDate}{p.endDate ? ` – ${p.endDate}` : ""}</span>}
                    </div>
                    {p.role && <div className="flowcv-entry-company">{p.role}</div>}
                    {p.url  && <div className="flowcv-entry-meta-small" style={{ color: "#3b82f6" }}>{p.url}</div>}
                    {p.description && <div className="flowcv-entry-description">{p.description.split("\n").filter(l => l.trim()).map((l, i) => <div key={i}>{l}</div>)}</div>}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          case "awards":
            return data.awards.some(a => a.title) ? (
              <PreviewSection key={sec.id} title="Awards">
                {data.awards.filter(a => a.title).map(a => (
                  <div key={a.id} className="flowcv-resume-entry">
                    <div className="flowcv-entry-title-row">
                      <strong>{a.title}</strong>
                      {a.date && <span className="flowcv-entry-dates">{a.date}</span>}
                    </div>
                    {a.issuer      && <div className="flowcv-entry-company">{a.issuer}</div>}
                    {a.description && <div className="flowcv-entry-description">{a.description}</div>}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          case "organisations":
            return data.organisations.some(o => o.name) ? (
              <PreviewSection key={sec.id} title="Organisations">
                {data.organisations.filter(o => o.name).map(o => (
                  <div key={o.id} className="flowcv-resume-entry">
                    <div className="flowcv-entry-title-row">
                      <strong>{o.name}</strong>
                      {(o.startDate || o.endDate) && <span className="flowcv-entry-dates">{o.startDate}{o.endDate ? ` – ${o.endDate}` : ""}</span>}
                    </div>
                    {o.role        && <div className="flowcv-entry-company">{o.role}</div>}
                    {o.description && <div className="flowcv-entry-description">{o.description}</div>}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          case "publications":
            return data.publications.some(p => p.title) ? (
              <PreviewSection key={sec.id} title="Publications">
                {data.publications.filter(p => p.title).map(p => (
                  <div key={p.id} className="flowcv-resume-entry">
                    <div className="flowcv-entry-title-row">
                      <strong>{p.title}</strong>
                      {p.date && <span className="flowcv-entry-dates">{p.date}</span>}
                    </div>
                    {p.publisher   && <div className="flowcv-entry-company">{p.publisher}</div>}
                    {p.url         && <div className="flowcv-entry-meta-small" style={{ color: "#3b82f6" }}>{p.url}</div>}
                    {p.description && <div className="flowcv-entry-description">{p.description}</div>}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          case "references":
            return data.references.some(r => r.name) ? (
              <PreviewSection key={sec.id} title="References">
                <div className="flowcv-references-grid">
                  {data.references.filter(r => r.name).map(r => (
                    <div key={r.id} className="flowcv-reference-card">
                      <strong>{r.name}</strong>
                      {r.position && <div>{r.position}</div>}
                      {r.company  && <div style={{ color: "#6b7280" }}>{r.company}</div>}
                      {r.email    && <div style={{ color: "#3b82f6", fontSize: "0.85em" }}>{r.email}</div>}
                      {r.phone    && <div style={{ fontSize: "0.85em" }}>{r.phone}</div>}
                    </div>
                  ))}
                </div>
              </PreviewSection>
            ) : null;

          case "declaration":
            return data.declaration ? (
              <PreviewSection key={sec.id} title="Declaration">
                <p style={{ margin: 0, color: "#374151", lineHeight: 1.7, fontStyle: "italic" }}>{data.declaration}</p>
              </PreviewSection>
            ) : null;

          case "custom":
            const items = data.customSections.filter((c: any) => c.sectionId === sec.id && (c.title || c.content));
            return items.length > 0 ? (
              <PreviewSection key={sec.id} title={sec.title}>
                {items.map((c: any) => (
                  <div key={c.id} className="flowcv-resume-entry">
                    {c.title   && <strong style={{ display: "block", marginBottom: "0.25rem" }}>{c.title}</strong>}
                    {c.content && <div className="flowcv-entry-description">{c.content}</div>}
                  </div>
                ))}
              </PreviewSection>
            ) : null;

          default:
            return null;
        }
      })}

      {isEmpty && (
        <div className="flowcv-empty-state">
          <p>👈 Start filling in your information to see your resume come to life!</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMIZE PANEL
// ═══════════════════════════════════════════════════════════════════════════════

type CProps = { style: ResumeStyle; updStyle: (p: Partial<ResumeStyle>) => void; sections: ActiveSection[]; setSections: React.Dispatch<React.SetStateAction<ActiveSection[]>> };

const CUSTOMIZE_TABS = [
  { id: "layout",   label: "Layout" },
  { id: "spacing",  label: "Spacing" },
  { id: "font",     label: "Font" },
  { id: "colors",   label: "Colors" },
  { id: "headings", label: "Headings" },
  { id: "links",    label: "Links" },
  { id: "header",   label: "Header" },
  { id: "name",     label: "Name" },
  { id: "photo",    label: "Photo" },
  { id: "skills",   label: "Skills" },
  { id: "languages",label: "Languages" },
  { id: "summary",  label: "Summary" },
] as const;

type CTab = typeof CUSTOMIZE_TABS[number]["id"];

function CBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`cp-btn ${active ? "active" : ""}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function CRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cp-row">
      <div className="cp-row-label">{label}</div>
      <div className="cp-row-control">{children}</div>
    </div>
  );
}

function CSlider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="cp-slider-row">
      <div className="cp-slider-header">
        <span className="cp-slider-label">{label}</span>
        <div className="cp-slider-stepper">
          <button type="button" onClick={() => onChange(Math.max(min, value - step))}>−</button>
          <span>{value}{unit}</span>
          <button type="button" onClick={() => onChange(Math.min(max, value + step))}>+</button>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="cp-range" />
    </div>
  );
}

function CCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cp-check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function CustomizePanel({ style, updStyle, sections, setSections }: CProps) {
  const [tab, setTab] = useState<CTab>("layout");

  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  return (
    <div className="cp-panel">
      <div className="cp-header">
        <h3>Customize</h3>
      </div>

      {/* Tab nav — scrollable */}
      <div className="cp-tabs">
        {CUSTOMIZE_TABS.map(t => (
          <button key={t.id} className={`cp-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)} type="button">
            {t.label}
          </button>
        ))}
      </div>

      <div className="cp-body">

        {/* ── LAYOUT ── */}
        {tab === "layout" && (
          <div className="cp-section">
            <div className="cp-section-title">Columns</div>
            <div className="cp-col-options">
              {(["one","two","mix"] as const).map(c => (
                <button key={c} type="button" className={`cp-col-btn ${style.columns === c ? "active" : ""}`} onClick={() => updStyle({ columns: c })}>
                  <div className={`cp-col-icon col-${c}`}>
                    {c === "one" && <><div/><div/><div/></>}
                    {c === "two" && <><div className="half"/><div className="half"/></>}
                    {c === "mix" && <><div className="wide"/><div className="narrow"/></>}
                  </div>
                  <span>{c.charAt(0).toUpperCase() + c.slice(1)}</span>
                </button>
              ))}
            </div>

            <div className="cp-section-title" style={{ marginTop: "1.5rem" }}>Change Section Layout</div>
            <div className="cp-section-list">
              {sections.map((sec, idx) => {
                const block = CONTENT_BLOCKS.find(b => b.type === sec.type);
                return (
                  <div key={sec.id} className={`cp-section-item ${sec.type === "personal" ? "pinned" : ""}`}>
                    <span className="cp-drag-handle">⠿</span>
                    <span className="cp-sec-icon">{block?.icon ?? "📄"}</span>
                    <span className="cp-sec-name">{sec.title}</span>
                    {sec.type !== "personal" && (
                      <div className="cp-sec-arrows">
                        <button type="button" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>↑</button>
                        <button type="button" onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1}>↓</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SPACING ── */}
        {tab === "spacing" && (
          <div className="cp-section">
            <CSlider label="Font Size" value={style.fontSize} min={8} max={14} step={0.5} unit="pt" onChange={v => updStyle({ fontSize: v })} />
            <CSlider label="Line Height" value={style.lineHeight} min={1.0} max={2.0} step={0.05} unit="" onChange={v => updStyle({ lineHeight: v })} />
            <CSlider label="Left & Right Margin" value={style.leftRightMargin} min={5} max={25} step={1} unit="mm" onChange={v => updStyle({ leftRightMargin: v })} />
            <CSlider label="Top & Bottom Margin" value={style.topBottomMargin} min={5} max={25} step={1} unit="mm" onChange={v => updStyle({ topBottomMargin: v })} />
            <CSlider label="Space between Entries" value={style.spaceBetweenEntries} min={0} max={8} step={0.5} unit="" onChange={v => updStyle({ spaceBetweenEntries: v })} />

            <div className="cp-section-title" style={{ marginTop: "1.5rem" }}>Entry Layout</div>
            <div className="cp-entry-layouts">
              {(["a","b","c","d"] as const).map(l => (
                <button key={l} type="button" className={`cp-entry-layout-btn ${style.entryLayout === l ? "active" : ""}`} onClick={() => updStyle({ entryLayout: l })}>
                  <div className={`cp-entry-preview entry-${l}`}>
                    <div className="ep-line bold"/><div className="ep-line"/><div className="ep-line short"/>
                  </div>
                </button>
              ))}
            </div>

            <CRow label="Column Width">
              <CBtn active={style.columnWidth === "auto"} onClick={() => updStyle({ columnWidth: "auto" })}>Auto</CBtn>
              <CBtn active={style.columnWidth === "manual"} onClick={() => updStyle({ columnWidth: "manual" })}>Manual</CBtn>
            </CRow>
            <CRow label="Title & subtitle size">
              {(["s","m","l"] as const).map(s => <CBtn key={s} active={style.titleSize === s} onClick={() => updStyle({ titleSize: s })}>{s.toUpperCase()}</CBtn>)}
            </CRow>
            <CRow label="Subtitle style">
              {(["normal","bold","italic"] as const).map(s => <CBtn key={s} active={style.subtitleStyle === s} onClick={() => updStyle({ subtitleStyle: s })}>{s.charAt(0).toUpperCase()+s.slice(1)}</CBtn>)}
            </CRow>
            <CRow label="Subtitle placement">
              <CBtn active={style.subtitlePlacement === "same"} onClick={() => updStyle({ subtitlePlacement: "same" })}>Try Same Line</CBtn>
              <CBtn active={style.subtitlePlacement === "next"} onClick={() => updStyle({ subtitlePlacement: "next" })}>Next Line</CBtn>
            </CRow>
            <CCheck label="Indent body" checked={style.descriptionIndent} onChange={v => updStyle({ descriptionIndent: v })} />
            <CRow label="List style">
              <CBtn active={style.listStyle === "bullet"} onClick={() => updStyle({ listStyle: "bullet" })}>• Bullet</CBtn>
              <CBtn active={style.listStyle === "hyphen"} onClick={() => updStyle({ listStyle: "hyphen" })}>– Hyphen</CBtn>
            </CRow>

            <div className="cp-section-title" style={{ marginTop: "1.5rem" }}>Footer</div>
            <CCheck label="Page numbers" checked={style.footerPageNumbers} onChange={v => updStyle({ footerPageNumbers: v })} />
            <CCheck label="Email" checked={style.footerEmail} onChange={v => updStyle({ footerEmail: v })} />
            <CCheck label="Name" checked={style.footerName} onChange={v => updStyle({ footerName: v })} />
          </div>
        )}

        {/* ── FONT ── */}
        {tab === "font" && (
          <div className="cp-section">
            <CRow label="Category">
              {(["serif","sans","mono"] as const).map(c => (
                <CBtn key={c} active={style.fontCategory === c} onClick={() => updStyle({ fontCategory: c, fontFamily: FONT_FAMILIES[c][0] })}>
                  <span style={{ fontFamily: c === "serif" ? "Georgia,serif" : c === "mono" ? "monospace" : "sans-serif" }}>Aa</span>
                  <span style={{ fontSize: "0.75rem", display: "block" }}>{c.charAt(0).toUpperCase()+c.slice(1)}</span>
                </CBtn>
              ))}
            </CRow>
            <div className="cp-font-grid">
              {FONT_FAMILIES[style.fontCategory].map(f => (
                <button key={f} type="button" className={`cp-font-btn ${style.fontFamily === f ? "active" : ""}`} onClick={() => updStyle({ fontFamily: f })} style={{ fontFamily: `'${f}', sans-serif` }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── COLORS ── */}
        {tab === "colors" && (
          <div className="cp-section">
            <div className="cp-section-title">Accent Color</div>
            <div className="cp-color-swatches">
              {ACCENT_COLORS.map(c => (
                <button key={c} type="button" className={`cp-color-swatch ${style.accentColor === c ? "active" : ""}`} style={{ background: c }} onClick={() => updStyle({ accentColor: c })} />
              ))}
              <label className="cp-color-swatch cp-color-custom" title="Custom color">
                🎨
                <input type="color" value={style.accentColor} onChange={e => updStyle({ accentColor: e.target.value })} style={{ opacity: 0, position: "absolute", width: 0, height: 0 }} />
              </label>
            </div>
            <div className="cp-color-preview" style={{ background: style.accentColor }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>Preview: {style.accentColor}</span>
            </div>
          </div>
        )}

        {/* ── SECTION HEADINGS ── */}
        {tab === "headings" && (
          <div className="cp-section">
            <div className="cp-section-title">Style</div>
            <div className="cp-heading-styles">
              {(["0","1","2","3","4","5","6","7"] as const).map(s => (
                <button key={s} type="button" className={`cp-heading-style-btn ${style.headingStyle === s ? "active" : ""}`} onClick={() => updStyle({ headingStyle: s })}>
                  <div className={`cp-heading-preview hs-${s}`} style={{ color: style.accentColor, borderColor: style.accentColor }}>
                    <span>HEADING</span>
                  </div>
                </button>
              ))}
            </div>
            <CRow label="Capitalization">
              <CBtn active={style.headingCapitalization === "capitalize"} onClick={() => updStyle({ headingCapitalization: "capitalize" })}>Capitalize</CBtn>
              <CBtn active={style.headingCapitalization === "uppercase"} onClick={() => updStyle({ headingCapitalization: "uppercase" })}>UPPERCASE</CBtn>
            </CRow>
            <CRow label="Size">
              {(["s","m","l","xl"] as const).map(s => <CBtn key={s} active={style.headingSize === s} onClick={() => updStyle({ headingSize: s })}>{s.toUpperCase()}</CBtn>)}
            </CRow>
            <CRow label="Icons">
              {(["none","outline","filled"] as const).map(s => <CBtn key={s} active={style.headingIcons === s} onClick={() => updStyle({ headingIcons: s })}>{s.charAt(0).toUpperCase()+s.slice(1)}</CBtn>)}
            </CRow>
          </div>
        )}

        {/* ── LINKS ── */}
        {tab === "links" && (
          <div className="cp-section">
            <div className="cp-section-title">Link Styling</div>
            <CCheck label="Underline" checked={style.linkUnderline} onChange={v => updStyle({ linkUnderline: v })} />
            <CCheck label="Blue color" checked={style.linkBlue} onChange={v => updStyle({ linkBlue: v })} />
            <CCheck label="Link icon" checked={style.linkIcon} onChange={v => updStyle({ linkIcon: v })} />
            {style.linkIcon && (
              <CRow label="Icon style">
                <CBtn active={style.linkIconStyle === "a"} onClick={() => updStyle({ linkIconStyle: "a" })}>🔗</CBtn>
                <CBtn active={style.linkIconStyle === "b"} onClick={() => updStyle({ linkIconStyle: "b" })}>↗</CBtn>
              </CRow>
            )}
          </div>
        )}

        {/* ── HEADER ── */}
        {tab === "header" && (
          <div className="cp-section">
            <CRow label="Text alignment">
              <CBtn active={style.headerAlignment === "left"} onClick={() => updStyle({ headerAlignment: "left" })}>
                <div className="cp-align-icon left">
                  <div/><div/><div/>
                </div>
                Left
              </CBtn>
              <CBtn active={style.headerAlignment === "center"} onClick={() => updStyle({ headerAlignment: "center" })}>
                <div className="cp-align-icon center">
                  <div/><div/><div/>
                </div>
                Center
              </CBtn>
            </CRow>
            <CRow label="Details Arrangement">
              {(["a","b","c","icon","bullet","bar"] as const).map(d => (
                <CBtn key={d} active={style.detailsArrangement === d} onClick={() => updStyle({ detailsArrangement: d })}>
                  {d === "icon" ? "Icon" : d === "bullet" ? "• Bullet" : d === "bar" ? "| Bar" : d.toUpperCase()}
                </CBtn>
              ))}
            </CRow>
          </div>
        )}

        {/* ── NAME ── */}
        {tab === "name" && (
          <div className="cp-section">
            <CRow label="Size">
              {(["xs","s","m","l","xl"] as const).map(s => <CBtn key={s} active={style.nameSize === s} onClick={() => updStyle({ nameSize: s })}>{s.toUpperCase()}</CBtn>)}
            </CRow>
            <CCheck label="Name bold" checked={style.nameBold} onChange={v => updStyle({ nameBold: v })} />
            <CRow label="Font">
              <CBtn active={style.nameFont === "body"} onClick={() => updStyle({ nameFont: "body" })}>Body Font</CBtn>
              <CBtn active={style.nameFont === "creative"} onClick={() => updStyle({ nameFont: "creative" })}>Creative</CBtn>
            </CRow>
            <div className="cp-section-title" style={{ marginTop: "1.5rem" }}>Professional Title</div>
            <CRow label="Size">
              {(["s","m","l"] as const).map(s => <CBtn key={s} active={style.titleSizeHeader === s} onClick={() => updStyle({ titleSizeHeader: s })}>{s.toUpperCase()}</CBtn>)}
            </CRow>
            <CRow label="Position">
              <CBtn active={style.titlePosition === "same"} onClick={() => updStyle({ titlePosition: "same" })}>Try Same Line</CBtn>
              <CBtn active={style.titlePosition === "below"} onClick={() => updStyle({ titlePosition: "below" })}>Below</CBtn>
            </CRow>
            <CRow label="Style">
              <CBtn active={style.titleStyle === "normal"} onClick={() => updStyle({ titleStyle: "normal" })}>Normal</CBtn>
              <CBtn active={style.titleStyle === "italic"} onClick={() => updStyle({ titleStyle: "italic" })}>Italic</CBtn>
            </CRow>
          </div>
        )}

        {/* ── PHOTO ── */}
        {tab === "photo" && (
          <div className="cp-section">
            <CCheck label="Show" checked={style.showPhoto} onChange={v => updStyle({ showPhoto: v })} />
            <CCheck label="Grayscale" checked={style.photoGrayscale} onChange={v => updStyle({ photoGrayscale: v })} />
            <CRow label="Photo position">
              {(["left","top","right"] as const).map(p => (
                <CBtn key={p} active={style.photoPosition === p} onClick={() => updStyle({ photoPosition: p })}>
                  <div className={`cp-photo-pos-icon pos-${p}`}><div className="dot"/><div className="lines"><div/><div/></div></div>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </CBtn>
              ))}
            </CRow>
            <CRow label="Size">
              {(["xs","s","m","l","xl"] as const).map(s => <CBtn key={s} active={style.photoSize === s} onClick={() => updStyle({ photoSize: s })}>{s.toUpperCase()}</CBtn>)}
            </CRow>
            <CRow label="Shape">
              {(["circle","sq1","sq2","sq3","sq4"] as const).map(s => (
                <button key={s} type="button" className={`cp-shape-btn ${style.photoShape === s ? "active" : ""}`} onClick={() => updStyle({ photoShape: s })}>
                  <div className={`cp-shape-preview ${s}`} style={{ borderColor: style.accentColor }} />
                </button>
              ))}
            </CRow>
          </div>
        )}

        {/* ── SKILLS ── */}
        {tab === "skills" && (
          <div className="cp-section">
            <div className="cp-section-title">Display Style</div>
            <div className="cp-display-grid">
              {(["grid","level","compact","bubble","bullet","pipe","newline","comma"] as const).map(d => (
                <CBtn key={d} active={style.skillsDisplay === d} onClick={() => updStyle({ skillsDisplay: d })}>
                  {d.charAt(0).toUpperCase()+d.slice(1)}
                </CBtn>
              ))}
            </div>
            <CRow label="Subinfo Style">
              <CBtn active={style.skillsSubinfo === "dash"} onClick={() => updStyle({ skillsSubinfo: "dash" })}>– Dash</CBtn>
              <CBtn active={style.skillsSubinfo === "colon"} onClick={() => updStyle({ skillsSubinfo: "colon" })}>: Colon</CBtn>
              <CBtn active={style.skillsSubinfo === "bracket"} onClick={() => updStyle({ skillsSubinfo: "bracket" })}>() Bracket</CBtn>
            </CRow>
          </div>
        )}

        {/* ── LANGUAGES ── */}
        {tab === "languages" && (
          <div className="cp-section">
            <div className="cp-section-title">Display Style</div>
            <div className="cp-display-grid">
              {(["grid","level","compact","bubble","bullet","pipe","newline","comma"] as const).map(d => (
                <CBtn key={d} active={style.languagesDisplay === d} onClick={() => updStyle({ languagesDisplay: d })}>
                  {d.charAt(0).toUpperCase()+d.slice(1)}
                </CBtn>
              ))}
            </div>
            <CRow label="Subinfo Style">
              <CBtn active={style.languagesSubinfo === "dash"} onClick={() => updStyle({ languagesSubinfo: "dash" })}>– Dash</CBtn>
              <CBtn active={style.languagesSubinfo === "colon"} onClick={() => updStyle({ languagesSubinfo: "colon" })}>: Colon</CBtn>
              <CBtn active={style.languagesSubinfo === "bracket"} onClick={() => updStyle({ languagesSubinfo: "bracket" })}>() Bracket</CBtn>
            </CRow>
          </div>
        )}

        {/* ── SUMMARY ── */}
        {tab === "summary" && (
          <div className="cp-section">
            <CCheck label="Display summary as part of header" checked={style.summaryInHeader} onChange={v => updStyle({ summaryInHeader: v })} />
            <CCheck label="Show summary heading" checked={style.summaryShowHeading} onChange={v => updStyle({ summaryShowHeading: v })} />
          </div>
        )}

      </div>
    </div>
  );
}
