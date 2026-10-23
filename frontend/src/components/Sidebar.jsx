import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import T, { SPRING, SPRING_LG } from "../tokens";
import { MagBtn } from "./ui";
import { UserContext } from "../context/UserContext";

/* 
   INLINE SVG ICONS
 */
const Icons = {
  Logo: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill={T.cyan} />
      <path d="M7 12h10M12 7l5 5-5 5" stroke={T.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Overview: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Exams: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
  Grades: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  Audit: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Inbox: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 17.76 4H6.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  Spinner: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Flag: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Logout: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Hamburger: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Close: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

/* 
   NAV DEFINITIONS
 */
const INSTRUCTOR_NAV = [
  { label: "Overview", icon: Icons.Overview, path: "/instructor" },
  { label: "Exams", icon: Icons.Exams, path: "/instructor/exams" },
  { label: "Grades", icon: Icons.Grades, path: "/instructor/grades" },
];

const TA_NAV = [
  { label: "Review Queue", icon: Icons.Inbox, path: "/ta" },
  { label: "In Progress", icon: Icons.Spinner, path: "/ta/progress" },
  { label: "Completed", icon: Icons.CheckCircle, path: "/ta/completed" },
];

/* 
   ANIMATION VARIANTS
 */
const sidebarVariant = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { ...SPRING_LG } },
};

const navStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } },
};

const navItemVariant = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { ...SPRING } },
};

const drawerVariant = {
  hidden: { x: -220 },
  visible: { x: 0, transition: { ...SPRING_LG } },
  exit: { x: -220, transition: { ...SPRING } },
};

/* 
   HELPERS
 */
const initials = (email = "") => email[0]?.toUpperCase() ?? "?";
const truncate = (str = "", n = 18) => str.length > n ? str.slice(0, n) + "…" : str;

/* 
   NAV ITEM
 */
function NavItem({ item, active, collapsed, onClick }) {
  const isActive = active === item.path;
  const Icon = item.icon;

  return (
    <motion.div
      variants={navItemVariant}
      style={{ position: "relative" }}
    >
      {/* active pill background */}
      {isActive && (
        <motion.div
          layoutId="active-pill"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "8px",
            backgroundColor: T.cyanDim,
            boxShadow: `inset 2px 0 0 ${T.cyan}`,
          }}
          transition={{ ...SPRING }}
        />
      )}

      <motion.button
        onClick={() => onClick(item.path)}
        whileHover={{ backgroundColor: isActive ? T.cyanDim : T.surfaceHigh, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : "10px",
          justifyContent: collapsed ? "center" : "flex-start",
          width: "100%",
          padding: collapsed ? "10px" : "10px 12px",
          borderRadius: "8px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: isActive ? T.cyan : T.text2,
          fontSize: "13.5px",
          fontFamily: "Geist, sans-serif",
          fontWeight: isActive ? 600 : 400,
          letterSpacing: "-0.01em",
          transition: "color 0.15s, background-color 0.15s",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
        title={collapsed ? item.label : undefined}
      >
        <span style={{ flexShrink: 0 }}>
          <Icon />
        </span>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              key="label"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: "hidden" }}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}

/* 
   SIDEBAR INNER CONTENT
 */
function SidebarContent({ collapsed, activeRoute, onNavigate, onClose }) {
  const navigate = useNavigate();
  const { user, logout } = useContext(UserContext);

  const navItems = user?.role === "instructor" ? INSTRUCTOR_NAV : TA_NAV;

  const handleNav = (path) => {
    onNavigate(path);
    onClose?.();
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const roleLabel = user?.role === "instructor" ? "Instructor" : "TA";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: "0",
    }}>

      {/* ── TOP: logo ── */}
      <div style={{
        padding: "20px 16px 16px",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : "10px",
          justifyContent: collapsed ? "center" : "flex-start",
          marginBottom: collapsed ? 0 : "10px",
        }}>
          <span style={{ flexShrink: 0 }}>
            <Icons.Logo />
          </span>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                key="wordmark"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}
              >
                <span style={{
                  fontFamily: "Geist, sans-serif",
                  fontWeight: 700,
                  fontSize: "15px",
                  color: T.text1,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                }}>
                  GradeOps
                </span>
                <span style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  fontFamily: "Geist Mono, monospace",
                  letterSpacing: "0.08em",
                  color: T.emerald,
                  backgroundColor: T.emeraldDim,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: `1px solid ${T.emeraldGlow}`,
                  whiteSpace: "nowrap",
                }}>
                  BETA
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── MIDDLE: nav ── */}
      <motion.nav
        variants={navStagger}
        initial="hidden"
        animate="visible"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            active={activeRoute}
            collapsed={collapsed}
            onClick={handleNav}
          />
        ))}
      </motion.nav>

      {/* ── BOTTOM: user + logout ── */}
      <div style={{
        borderTop: `1px solid ${T.border}`,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}>
        {/* user info row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : "10px",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: "6px 4px",
        }}>
          {/* avatar */}
          <div style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            backgroundColor: T.cyanDim,
            border: `1px solid rgba(34,211,238,0.2)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: T.cyan,
            fontFamily: "Geist, sans-serif",
            fontWeight: 700,
            fontSize: "13px",
            flexShrink: 0,
          }}>
            {initials(user?.email)}
          </div>

          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                key="userinfo"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: "hidden", minWidth: 0 }}
              >
                <div style={{
                  fontFamily: "Geist, sans-serif",
                  fontSize: "12px",
                  color: T.text2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "130px",
                }}>
                  {truncate(user?.email ?? "")}
                </div>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginTop: "3px",
                  fontSize: "10px",
                  fontWeight: 600,
                  fontFamily: "Geist Mono, monospace",
                  letterSpacing: "0.07em",
                  color: T.cyan,
                  backgroundColor: T.cyanDim,
                  padding: "1px 6px",
                  borderRadius: "4px",
                }}>
                  {roleLabel}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* logout */}
        <motion.button
          onClick={handleLogout}
          whileHover={{ backgroundColor: "rgba(248,113,113,0.07)", color: T.red }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: collapsed ? 0 : "8px",
            width: "100%",
            padding: collapsed ? "9px" : "9px 12px",
            borderRadius: "8px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: T.text3,
            fontFamily: "Geist, sans-serif",
            fontSize: "13px",
            transition: "color 0.15s, background-color 0.15s",
          }}
          title={collapsed ? "Sign out" : undefined}
        >
          <Icons.Logout />
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="logout-label"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.18 }}
                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
              >
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

      </div>
    </div>
  );
}

/* 
   SIDEBAR (exported)
 */
export default function Sidebar({ activeRoute, onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [screenW, setScreenW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    const handler = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const isMobile = screenW < 768;
  const isTablet = screenW >= 768 && screenW < 1024;
  const collapsed = isTablet;
  const sidebarWidth = collapsed ? 60 : 220;

  /* close drawer on nav */
  const handleNavigate = (path) => {
    onNavigate(path);
    setMobileOpen(false);
  };

  /* ── DESKTOP + TABLET: fixed sidebar ── */
  if (!isMobile) {
    return (
      <motion.aside
        initial={{ x: -20, opacity: 0, width: sidebarWidth }}
        animate={{ x: 0, opacity: 1, width: sidebarWidth }}
        transition={{ ...SPRING_LG }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 50,
          backgroundColor: T.surface,
          borderRight: `1px solid ${T.border}`,
          overflow: "hidden",
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          activeRoute={activeRoute}
          onNavigate={handleNavigate}
          onClose={null}
        />
      </motion.aside>
    );
  }

  /* ── MOBILE: hamburger + drawer ── */
  return (
    <>
      {/* hamburger trigger */}
      <motion.button
        onClick={() => setMobileOpen(true)}
        whileHover={{ backgroundColor: T.surfaceHigh }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: "fixed",
          top: "16px",
          left: "16px",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          border: `1px solid ${T.border}`,
          backgroundColor: T.surface,
          cursor: "pointer",
          color: T.text1,
        }}
      >
        <Icons.Hamburger />
      </motion.button>

      {/* drawer + overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 90,
                backgroundColor: T.bg,
              }}
            />

            {/* drawer */}
            <motion.aside
              key="drawer"
              variants={drawerVariant}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                height: "100vh",
                width: "220px",
                zIndex: 95,
                backgroundColor: T.surface,
                borderRight: `1px solid ${T.border}`,
              }}
            >
              {/* close button */}
              <motion.button
                onClick={() => setMobileOpen(false)}
                whileHover={{ backgroundColor: T.surfaceHigh }}
                whileTap={{ scale: 0.95 }}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "12px",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  color: T.text3,
                }}
              >
                <Icons.Close />
              </motion.button>

              <SidebarContent
                collapsed={false}
                activeRoute={activeRoute}
                onNavigate={handleNavigate}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}