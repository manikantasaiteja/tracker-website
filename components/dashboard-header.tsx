"use client";

import Link from "next/link";
import { useState } from "react";

type DashboardHeaderProps = {
  userLabel: string;
  applicationsCount?: number;
  theme?: "dark" | "light";
  onThemeToggle?: () => void;
  onSignOut: () => void;
};

export function DashboardHeader({
  userLabel,
  applicationsCount = 0,
  theme = "dark",
  onThemeToggle,
  onSignOut,
}: DashboardHeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="dashboard-header">
      <Link className="brand-mark brand-mark--small" href="/dashboard">
        <span className="brand-mark__icon">T</span>
        <div>
          <p className="brand-mark__eyebrow">Trackr</p>
          <strong>{userLabel}</strong>
        </div>
      </Link>

      <nav className="dashboard-tabs">
        <Link href="/dashboard" className="tab-link">
          📊 Applications
        </Link>
        <Link href="/tools" className="tab-link">
          🛠️ Tools
        </Link>
      </nav>

      <div className="dashboard-header__actions">
        {onThemeToggle && (
          <button className="secondary-button" onClick={onThemeToggle} type="button">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        )}
        
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
                    <span className="profile-menu-email">{applicationsCount} applications</span>
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
                    onSignOut();
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
  );
}
