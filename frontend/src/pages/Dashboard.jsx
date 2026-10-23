import { useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import T from "../tokens";
import { UserContext } from "../context/UserContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading } = useContext(UserContext);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (!user || !["instructor", "ta"].includes(user.role)) {
        navigate("/login", { replace: true });
      } else {
        navigate(user.role === "instructor" ? "/instructor" : "/ta", { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [user, navigate, loading]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100dvh",
      backgroundColor: T.bg,
      gap: "16px",
    }}>
      <motion.svg
        width="28" height="28" viewBox="0 0 24 24" fill="none"
        animate={{ scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="3" y="3" width="18" height="18" rx="4" fill={T.cyan} />
        <path d="M8 12h8M12 8l4 4-4 4" stroke={T.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>

      <span style={{
        fontFamily: "Geist Mono, monospace",
        fontSize: "12px",
        color: T.text3,
        letterSpacing: "0.04em",
      }}>
        Loading your workspace...
      </span>
    </div>
  );
}