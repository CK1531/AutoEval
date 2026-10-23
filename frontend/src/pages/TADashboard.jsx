import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/Sidebar";
import { MagBtn, LoadingSpinner, Dot } from "../components/ui";
import T, { SPRING, SPRING_LG, EASE_EXPO } from "../tokens";
import api from "../services/api";
import { UserContext } from "../context/UserContext";

const PATH_TO_SECTION = {
  "/ta": "queue",
  "/ta/progress": "progress",
  "/ta/completed": "completed",
  "/ta/flagged": "flagged",
};

const SECTION_META = {
  queue: { title: "Review Queue", sub: "AI-graded scripts awaiting your decision" },
  progress: { title: "In Progress", sub: "Scripts you have started reviewing" },
  completed: { title: "Completed", sub: "Scripts you have approved or overridden" },
  flagged: { title: "Flagged", sub: "Scripts flagged for senior review" },
};

const confidenceColor = (c) => c >= 80 ? T.emerald : c >= 60 ? "#f59e0b" : T.red;
const confidenceBg = (c) => c >= 80 ? T.emeraldDim : c >= 60 ? "rgba(245,158,11,0.10)" : "rgba(248,113,113,0.10)";
const statusColor = { pending: T.text2, flagged: "#f59e0b", completed: T.emerald };
const statusLabel = { pending: "Pending", flagged: "Flagged", completed: "Done" };
const matchColors = { full: T.emerald, partial: "#f59e0b", none: T.red };

const Toast = ({ message, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }}
      transition={SPRING}
      style={{
        position: "fixed", top: 24, right: 24, zIndex: 1000,
        background: T.surface, border: `1px solid ${T.borderMid}`,
        borderRadius: 10, padding: "12px 18px 12px 14px",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5)`, minWidth: 280,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: "0 2px 2px 0", background: T.emerald, boxShadow: `0 0 8px ${T.emeraldGlow}` }} />
      <div style={{ paddingLeft: 6 }}>
        <div style={{ fontSize: 13, color: T.text1, fontFamily: "Geist, sans-serif", fontWeight: 500 }}>{message}</div>
        <div style={{ fontSize: 11, color: T.text3, fontFamily: "Geist Mono, monospace", marginTop: 2 }}>Auto-advancing in 0.8s</div>
      </div>
    </motion.div>
  );
};

const QueueItem = ({ item, selected, onClick, sessionStatuses }) => {
  const liveStatus = sessionStatuses[item.id] || item.status;
  return (
    <motion.div
      layout onClick={onClick}
      whileHover={{ backgroundColor: selected ? T.cyanDim : T.surfaceHigh }}
      whileTap={{ scale: 0.99 }}
      style={{
        padding: "12px 14px", cursor: "pointer",
        background: selected ? T.cyanDim : "transparent",
        boxShadow: selected ? `inset 2px 0 0 ${T.cyan}` : "none",
        transition: "background 0.15s, box-shadow 0.15s",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 13, fontWeight: 600, color: selected ? T.cyan : T.text1 }}>
          {item.studentId}
        </span>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, fontWeight: 700, color: confidenceColor(item.confidence), background: confidenceBg(item.confidence), borderRadius: 4, padding: "2px 6px" }}>
          {item.confidence}%
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.text2 }}>
          {item.questionRef} — {item.questionText.split(":")[1]?.split(" ").slice(0, 3).join(" ") ?? ""}...
        </span>
        <span style={{ fontSize: 10, fontFamily: "Geist Mono, monospace", color: liveStatus === "pending" ? T.text3 : statusColor[liveStatus] }}>
          {liveStatus !== "pending" ? statusLabel[liveStatus] : item.timeAgo}
        </span>
      </div>
    </motion.div>
  );
};

function Section({ label, title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, fontWeight: 700, color: T.cyan, background: T.cyanDim, borderRadius: 4, padding: "3px 7px", letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.text3, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
      {children}
    </div>
  );
}

const sectionTransition = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { ...SPRING_LG } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

const rowStagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const rowItem = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { ...SPRING } } };

function SectionProgress({ items, sessionStatuses }) {
  const inProgress = items.filter((i) => (sessionStatuses[i.id] || i.status) === "pending");
  return (
    <motion.div key="progress" {...sectionTransition}>
      {inProgress.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 16 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke={T.text3} strokeWidth="1.5" /><path d="M24 16v8l5 3" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" /></svg>
          <div style={{ fontSize: 14, color: T.text3, textAlign: "center" }}>No scripts currently in progress</div>
        </div>
      ) : (
        <motion.div variants={rowStagger} initial="hidden" animate="visible" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {inProgress.map((item) => (
            <motion.div key={item.id} variants={rowItem}
              style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 13, fontWeight: 700, color: T.cyan, marginBottom: 4 }}>{item.studentId}</div>
                <div style={{ fontSize: 12, color: T.text2 }}>{item.questionRef} — {item.questionText.slice(0, 60)}...</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.text3 }}>{item.timeAgo}</span>
                <span style={{
                  fontFamily: "Geist Mono, monospace", fontSize: 11, fontWeight: 700,
                  color: item.confidence >= 80 ? T.emerald : item.confidence >= 60 ? "#f59e0b" : T.red,
                  backgroundColor: item.confidence >= 80 ? T.emeraldDim : item.confidence >= 60 ? "rgba(245,158,11,0.10)" : "rgba(248,113,113,0.10)",
                  borderRadius: 4, padding: "2px 8px"
                }}>{item.confidence}%</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

function SectionCompleted({ items, sessionStatuses }) {
  const done = items.filter((i) => (sessionStatuses[i.id] || i.status) === "completed");
  return (
    <motion.div key="completed" {...sectionTransition}>
      {done.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 16 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke={T.text3} strokeWidth="1.5" /><polyline points="16 24 21 29 32 18" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ fontSize: 14, color: T.text3, textAlign: "center" }}>No completed reviews yet this session</div>
        </div>
      ) : (
        <motion.div variants={rowStagger} initial="hidden" animate="visible" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Student ID", "Question", "AI Score", "Your Decision", "Confidence"].map((h) => (
                  <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: T.text3, fontFamily: "Geist Mono, monospace", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={rowStagger} initial="hidden" animate="visible">
              {done.map((item) => (
                <motion.tr key={item.id} variants={rowItem} whileHover={{ backgroundColor: T.surfaceHigh }} style={{ transition: "background-color 0.15s" }}>
                  <td style={{ padding: "13px 20px", fontFamily: "Geist Mono, monospace", fontSize: 13, color: T.cyan, fontWeight: 600 }}>{item.studentId}</td>
                  <td style={{ padding: "13px 20px", fontSize: 12, color: T.text2 }}>{item.questionRef}</td>
                  <td style={{ padding: "13px 20px", fontFamily: "Geist Mono, monospace", fontSize: 13, color: T.text1, fontWeight: 700 }}>{item.aiScore}/{item.maxScore}</td>
                  <td style={{ padding: "13px 20px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "Geist Mono, monospace", color: T.emerald, backgroundColor: T.emeraldDim, border: `1px solid rgba(52,211,153,0.18)`, borderRadius: 5, padding: "2px 8px" }}>APPROVED</span>
                  </td>
                  <td style={{
                    padding: "13px 20px", fontFamily: "Geist Mono, monospace", fontSize: 12,
                    color: item.confidence >= 80 ? T.emerald : item.confidence >= 60 ? "#f59e0b" : T.red
                  }}>{item.confidence}%</td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </motion.div>
      )}
    </motion.div>
  );
}

function SectionFlagged({ items, sessionStatuses }) {
  const flagged = items.filter((i) => (sessionStatuses[i.id] || i.status) === "flagged");
  return (
    <motion.div key="flagged" {...sectionTransition}>
      {flagged.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 16 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M12 40V14s4-4 12-4 12 4 12 4v16s-4-4-12-4-12 4-12 4" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ fontSize: 14, color: T.text3, textAlign: "center" }}>No flagged scripts this session</div>
        </div>
      ) : (
        <motion.div variants={rowStagger} initial="hidden" animate="visible" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {flagged.map((item) => (
            <motion.div key={item.id} variants={rowItem}
              style={{ backgroundColor: T.surface, border: `1px solid rgba(245,158,11,0.22)`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>{item.studentId}</div>
                  <div style={{ fontSize: 12, color: T.text2 }}>{item.questionRef} — {item.questionText.slice(0, 70)}...</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "Geist Mono, monospace", color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.10)", border: `1px solid rgba(245,158,11,0.22)`, borderRadius: 5, padding: "2px 8px", flexShrink: 0 }}>FLAGGED</span>
              </div>
              {item.similarityFlag && (
                <div style={{ fontSize: 12, color: T.text3, fontFamily: "Geist Mono, monospace" }}>
                  Similar to: {item.similarityFlag.papers.join(", ")}
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

function ExamCard({ exam, onSelect }) {
  const conf = typeof exam.avgConfidence === "number" ? exam.avgConfidence : null;
  const confC = conf == null ? T.text2 : conf >= 80 ? T.emerald : conf >= 60 ? "#f59e0b" : T.red;
  return (
    <motion.div
      variants={rowItem}
      onClick={() => onSelect(exam)}
      whileHover={{ y: -3, borderColor: T.borderStrong }}
      whileTap={{ scale: 0.99 }}
      style={{ cursor: "pointer", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {exam.code ? (
          <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, fontWeight: 700, color: T.cyan, background: T.cyanDim, borderRadius: 5, padding: "3px 8px", letterSpacing: "0.04em" }}>{exam.code}</span>
        ) : (
          <span />
        )}
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3 }}>{exam.updatedAgo ?? exam.uploaded ?? ""}</span>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text1, lineHeight: 1.4, letterSpacing: "-0.01em" }}>{exam.title}</div>
        {exam.term && <div style={{ fontSize: 11, color: T.text3, marginTop: 4, fontFamily: "Geist Mono, monospace" }}>{exam.term}</div>}
      </div>
      <div style={{ height: 1, background: T.border }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, color: exam.pending > 0 ? T.cyan : T.text2, lineHeight: 1 }}>{exam.pending}</div>
            <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 9, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>Pending</div>
          </div>
          <div>
            <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, color: T.text2, lineHeight: 1 }}>{exam.total}</div>
            <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 9, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>Scripts</div>
          </div>
          {conf != null && (
            <div>
              <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 700, color: confC, lineHeight: 1 }}>{conf}%</div>
              <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 9, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>Avg conf</div>
            </div>
          )}
        </div>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, fontWeight: 600, color: T.cyan }}>Grade →</span>
      </div>
    </motion.div>
  );
}

function ExamListView({ exams, loading, onSelect, onLogout }) {
  return (
    <div style={{ minHeight: "100dvh", background: T.bg, fontFamily: "Geist, sans-serif", color: T.text1, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.cyan, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px ${T.cyanGlow}` }}>
            <span style={{ color: T.bg, fontSize: 16, fontWeight: 800, lineHeight: 1 }}>→</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text1, letterSpacing: "-0.02em" }}>GradeOps</span>
          <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 9, fontWeight: 700, color: T.cyan, background: T.cyanDim, borderRadius: 4, padding: "2px 6px", letterSpacing: "0.08em" }}>BETA</span>
        </div>
        <button
          onClick={onLogout}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.text1; e.currentTarget.style.borderColor = T.borderMid; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.text2; e.currentTarget.style.borderColor = T.border; }}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, cursor: "pointer", color: T.text2, fontFamily: "Geist Mono, monospace", fontSize: 12, padding: "7px 12px", transition: "color 0.15s, border-color 0.15s" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Sign out
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 32px 56px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text1, letterSpacing: "-0.03em", margin: 0 }}>Exams to grade</h1>
            <p style={{ fontSize: 13, color: T.text3, marginTop: 6, margin: "6px 0 0" }}>Select an exam to open its review queue</p>
          </div>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, gap: 10, color: T.text3 }}>
              <LoadingSpinner />
              <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12 }}>Loading exams…</span>
            </div>
          ) : exams.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 280, gap: 16 }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="6" width="32" height="36" rx="4" stroke={T.text3} strokeWidth="1.5" /><path d="M16 16h16M16 24h16M16 32h10" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" /></svg>
              <div style={{ fontSize: 14, color: T.text3 }}>No exams to grade</div>
            </div>
          ) : (
            <motion.div variants={rowStagger} initial="hidden" animate="visible" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {exams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} onSelect={onSelect} />
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TADashboard() {
  const navigate = useNavigate();
  const { logout } = useContext(UserContext);
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [selectedExam, setSelectedExam] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeRoute, setActiveRoute] = useState("/ta");
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [sessionStatuses, setSessionStatuses] = useState({});
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [loading, setLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [contentKey, setContentKey] = useState(0);
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [screenW, setScreenW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);

  useEffect(() => {
    const h = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await api.get(`/exams/to-grade`);
        const data = res?.data;
        setExams(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load exams", err);
        setExams([]);
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();
  }, []);

  useEffect(() => {
    if (!selectedExam) return;
    let cancelled = false;
    const fetchQueue = async () => {
      setLoadingData(true);
      setSessionStatuses({});
      setSessionReviewed(0);
      setFilter("All");
      try {
        const res = await api.get(`/exams/${selectedExam.id}/queue`);
        const data = res?.data?.queue;
        const next = Array.isArray(data) ? data : [];
        if (cancelled) return;
        setQueue(next);
        setSelectedId(next.length > 0 ? next[0].id : null);
      } catch (err) {
        console.error("Failed to load queue", err);
        if (cancelled) return;
        setQueue([]);
        setSelectedId(null);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    fetchQueue();
    return () => { cancelled = true; };
  }, [selectedExam]);

  const isMobile = screenW < 768;
  const isTablet = screenW >= 768 && screenW < 1024;
  const sidebarW = isMobile ? 0 : isTablet ? 60 : 220;

  const filteredQueue = queue.filter((item) => {
    const liveStatus = sessionStatuses[item.id] || item.status;
    if (filter === "All") return true;
    return liveStatus.toLowerCase() === filter.toLowerCase();
  });

  const selectedItem = queue.find((i) => i.id === selectedId) ?? null;
  const selectedIndex = filteredQueue.findIndex((i) => i.id === selectedId);
  const totalVisible = filteredQueue.length;
  const totalSession = queue.length;

  const selectItem = useCallback((item) => {
    setSelectedId(item.id);
    setOverrideOpen(false);
    setOverrideScore(String(item.aiScore));
    setOverrideReason("");
    setContentKey((k) => k + 1);
  }, []);

  const nextItem = useCallback(() => {
    const idx = filteredQueue.findIndex((i) => i.id === selectedId);
    const next = filteredQueue[idx + 1];
    if (next) selectItem(next);
  }, [filteredQueue, selectedId, selectItem]);

  const prevItem = useCallback(() => {
    const idx = filteredQueue.findIndex((i) => i.id === selectedId);
    const prev = filteredQueue[idx - 1];
    if (prev) selectItem(prev);
  }, [filteredQueue, selectedId, selectItem]);

  const handleAction = useCallback(async (type) => {
    if (!selectedItem || loading) return;
    setLoading(type);
    await new Promise((r) => setTimeout(r, 600));

    const newStatus = type === "flag" ? "flagged" : "completed";

   const updatedQueue = queue.map((q) => {
      if (q.id === selectedItem.id) {
        if (type === "override") {
          return {
            ...q,
            aiScore: Number(overrideScore),
            status: newStatus,
            aiJustification: `[TA OVERRIDE]: ${overrideReason}`,
          };
        }
        return { ...q, status: newStatus };
      }
      return q;
    });

    setQueue(updatedQueue);

    const newSessionStatuses = { ...sessionStatuses, [selectedItem.id]: newStatus };
    setSessionStatuses(newSessionStatuses);

    setLoading(null);
    setSessionReviewed((n) => n + 1);
    setToast("Decision saved — moving to next item");
    setOverrideOpen(false);

    const targetSubId = selectedItem.submission_id;
    const studentQuestions = updatedQueue.filter(q => q.submission_id === targetSubId);

    const allGraded = studentQuestions.every(
      q => newSessionStatuses[q.id] === "completed" || newSessionStatuses[q.id] === "flagged"
    );

    if (allGraded) {
      try {
        await api.post(`/upload/${targetSubId}/review`, { questions: studentQuestions });
        console.log(`Successfully finalized submission ${targetSubId}`);
      } catch (err) {
        console.error("Failed to finalize submission", err);
      }
    }

    setTimeout(() => nextItem(), 800);
  }, [selectedItem, loading, nextItem, overrideScore, overrideReason, queue, sessionStatuses]);

  const handleApprove = useCallback(() => handleAction("approve"), [handleAction]);
  const handleFlag = useCallback(() => handleAction("flag"), [handleAction]);

  const handleOverrideSubmit = useCallback(() => {
    if (!overrideReason.trim()) return;
    handleAction("override");
  }, [overrideReason, handleAction]);

  const toggleOverride = useCallback(() => {
    setOverrideOpen((v) => !v);
    if (selectedItem) setOverrideScore(String(selectedItem.aiScore));
  }, [selectedItem]);

  const openExam = useCallback((exam) => {
    setSelectedExam(exam);
    setActiveRoute("/ta");
  }, []);

  const backToExams = useCallback(() => {
    setSelectedExam(null);
    setActiveRoute("/ta");
    setQueue([]);
    setSelectedId(null);
    setSessionStatuses({});
    setSessionReviewed(0);
    setOverrideOpen(false);
    setFilter("All");
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "a" || e.key === "A") handleApprove();
      if (e.key === "o" || e.key === "O") toggleOverride();
      if (e.key === "ArrowRight") nextItem();
      if (e.key === "ArrowLeft") prevItem();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleApprove, handleFlag, toggleOverride, nextItem, prevItem]);

  useEffect(() => {
    if (filteredQueue.length > 0 && !filteredQueue.find((i) => i.id === selectedId)) {
      selectItem(filteredQueue[0]);
    }
  }, [filter]);

  useEffect(() => {
    const subId = selectedItem?.submission_id;
    if (!subId) {
      setPages([]);
      return;
    }
    let cancelled = false;
    const fetchPages = async () => {
      setLoadingPages(true);
      try {
        const res = await api.get(`/upload/${subId}/pages`);
        const list = res?.data?.pages;
        if (cancelled) return;
        const base = api.defaults.baseURL || "";
        setPages(Array.isArray(list) ? list.map((p) => `${base}${p}`) : []);
      } catch (err) {
        console.error("Failed to load script pages", err);
        if (!cancelled) setPages([]);
      } finally {
        if (!cancelled) setLoadingPages(false);
      }
    };
    fetchPages();
    return () => { cancelled = true; };
  }, [selectedItem?.submission_id]);

  if (!selectedExam) {
    return <ExamListView exams={exams} loading={loadingExams} onSelect={openExam} onLogout={handleLogout} />;
  }

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: T.bg, fontFamily: "Geist, sans-serif", color: T.text1, overflow: "hidden" }}>

      <Sidebar activeRoute={activeRoute} onNavigate={(path) => {
        setActiveRoute(path);
        navigate(path, { replace: true });
      }} />

      <div style={{ display: "flex", flex: 1, marginLeft: sidebarW, overflow: "hidden", height: "100dvh", flexDirection: "column" }}>

        {PATH_TO_SECTION[activeRoute] !== "queue" && (
          <div style={{ height: 56, backgroundColor: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={backToExams} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, cursor: "pointer", color: T.text2, fontFamily: "Geist Mono, monospace", fontSize: 11, padding: "5px 9px" }}>
                <span style={{ fontSize: 13 }}>←</span> Exams
              </button>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.text1, letterSpacing: "-0.02em" }}>{SECTION_META[PATH_TO_SECTION[activeRoute] || "queue"].title}</div>
                <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{SECTION_META[PATH_TO_SECTION[activeRoute] || "queue"].sub}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Dot color={T.emerald} />
              <span style={{ fontSize: 12, color: T.text3, fontFamily: "Geist Mono, monospace" }}>Live</span>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {PATH_TO_SECTION[activeRoute] === "queue" && (
            <motion.div key="queue" style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

              <div style={{ width: 280, minWidth: 280, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
                <div style={{ padding: "18px 16px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                  <button onClick={backToExams} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: T.text3, fontFamily: "Geist Mono, monospace", fontSize: 11, padding: 0, marginBottom: 10 }}>
                    <span style={{ fontSize: 13 }}>←</span> All exams
                  </button>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text1, letterSpacing: "-0.01em" }}>Review Queue</span>
                    <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, fontWeight: 700, color: T.cyan, background: T.cyanDim, borderRadius: 5, padding: "3px 8px" }}>
                      {queue.filter((i) => (sessionStatuses[i.id] || i.status) === "pending").length} pending
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, background: T.bg, borderRadius: 8, padding: 3 }}>
                    {["All", "Pending", "Completed"].map((tab) => (
                      <button key={tab} onClick={() => setFilter(tab)} style={{ flex: 1, padding: "5px 0", fontSize: 11, fontFamily: "Geist Mono, monospace", fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filter === tab ? T.cyanDim : "transparent", color: filter === tab ? T.cyan : T.text3, transition: "all 0.15s" }}>
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
                  <AnimatePresence>
                    {filteredQueue.map((item) => (
                      <QueueItem key={item.id} item={item} selected={item.id === selectedId} onClick={() => selectItem(item)} sessionStatuses={sessionStatuses} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: T.bg }}>

                {!selectedItem ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect x="6" y="10" width="36" height="30" rx="4" stroke={T.text3} strokeWidth="1.5" />
                      <path d="M14 20h20M14 27h14" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <div style={{ textAlign: "center", maxWidth: 260 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: T.text2, marginBottom: 6 }}>Select an item to begin reviewing</div>
                      <div style={{ fontSize: 12, color: T.text3 }}>Press [→] to jump to the first pending item</div>
                    </div>
                    <MagBtn variant="primary" size="md" onClick={() => filteredQueue.length > 0 && selectItem(filteredQueue[0])}>Start from top</MagBtn>
                  </div>
                ) : (
                  <>
                    <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 14, fontWeight: 700, color: T.cyan }}>{selectedItem.studentId}</span>
                        <span style={{ fontSize: 12, color: T.text3 }}>·</span>
                        <span style={{ fontSize: 13, color: T.text2 }}>{selectedExam.title}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.text3 }}>{selectedIndex + 1} of {totalVisible}</span>
                        {[{ label: "←", fn: prevItem, disabled: selectedIndex === 0 }, { label: "→", fn: nextItem, disabled: selectedIndex === totalVisible - 1 }].map(({ label, fn, disabled }) => (
                          <motion.button key={label} onClick={fn} whileHover={{ scale: disabled ? 1 : 1.05 }} whileTap={{ scale: disabled ? 1 : 0.95 }} disabled={disabled}
                            style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${disabled ? T.border : T.borderMid}`, background: "transparent", cursor: disabled ? "not-allowed" : "pointer", color: disabled ? T.text3 : T.text1, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Geist Mono, monospace" }}>
                            {label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "20px 24px 40px" }}>
                      <AnimatePresence mode="wait">
                        <motion.div key={contentKey} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>

                          <Section label="A" title="Question & Rubric">
                            <div style={{ fontSize: 15, color: T.text1, fontWeight: 500, lineHeight: 1.6, marginBottom: 16 }}>{selectedItem.questionText}</div>
                            <div style={{ borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr", padding: "7px 12px", background: T.surfaceHigh, borderBottom: `1px solid ${T.border}` }}>
                                {["Criterion", "Pts", "Keywords"].map((h) => (
                                  <span key={h} style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{h}</span>
                                ))}
                              </div>
                              {selectedItem.rubric.map((r, i) => (
                                <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr", padding: "9px 12px", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", borderBottom: i < selectedItem.rubric.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                  <span style={{ fontSize: 12, color: T.text1 }}>{r.name}</span>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, color: T.text2 }}>{r.maxPoints}</span>
                                  <span style={{ fontSize: 11, color: T.text3, fontFamily: "Geist Mono, monospace" }}>{r.keywords.join(", ")}</span>
                                </div>
                              ))}
                            </div>
                          </Section>

                          <Section label="B" title="Student's Answer">
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>

                              <div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase" }}>Original Script</span>
                                  {pages.length > 1 && <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3 }}>{pages.length} pages</span>}
                                </div>
                                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 8, maxHeight: 460, overflowY: "auto", scrollbarWidth: "none" }}>
                                  {loadingPages ? (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: T.text3 }}>
                                      <LoadingSpinner />
                                      <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12 }}>Loading script…</span>
                                    </div>
                                  ) : pages.length === 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: T.text3, textAlign: "center", padding: 12 }}>
                                      <svg width="40" height="40" viewBox="0 0 48 48" fill="none"><rect x="10" y="6" width="28" height="36" rx="4" stroke={T.text3} strokeWidth="1.5" /><path d="M17 16h14M17 24h14M17 32h9" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" /></svg>
                                      <span style={{ fontSize: 12 }}>Original script unavailable</span>
                                    </div>
                                  ) : (
                                    pages.map((url, idx) => (
                                      <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: idx < pages.length - 1 ? 8 : 0 }}>
                                        <img src={url} alt={`Script page ${idx + 1}`} loading="lazy" style={{ width: "100%", display: "block", borderRadius: 6, border: `1px solid ${T.border}`, background: "#ffffff" }} />
                                      </a>
                                    ))
                                  )}
                                </div>
                                {pages.length > 0 && <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, marginTop: 6 }}>Click a page to open full size</div>}
                              </div>

                              <div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase" }}>Extracted Answer</span>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, fontWeight: 700, color: selectedItem.ocrConfidence >= 80 ? T.emerald : selectedItem.ocrConfidence >= 60 ? "#f59e0b" : T.red, background: selectedItem.ocrConfidence >= 80 ? T.emeraldDim : selectedItem.ocrConfidence >= 60 ? "rgba(245,158,11,0.10)" : "rgba(248,113,113,0.10)", borderRadius: 4, padding: "2px 7px" }}>OCR {selectedItem.ocrConfidence}%</span>
                                </div>
                                <pre style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, fontFamily: "Geist Mono, monospace", fontSize: 12, color: T.text1, lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>
                                  {selectedItem.ocrText}
                                </pre>
                              </div>

                            </div>
                          </Section>

                          <Section label="C" title="AI Grading Decision">
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Awarded</div>
                                <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 36, fontWeight: 700, color: T.cyan, lineHeight: 1 }}>
                                  {selectedItem.aiScore}<span style={{ fontSize: 18, color: T.text3 }}> / {selectedItem.maxScore}</span>
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>AI Confidence</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                                    <div style={{ width: `${selectedItem.confidence}%`, height: "100%", background: selectedItem.confidence >= 80 ? T.emerald : selectedItem.confidence >= 60 ? "#f59e0b" : T.red, borderRadius: 2 }} />
                                  </div>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, fontWeight: 700, color: selectedItem.confidence >= 80 ? T.emerald : selectedItem.confidence >= 60 ? "#f59e0b" : T.red }}>{selectedItem.confidence}%</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.65, marginBottom: 16, padding: "12px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                              {selectedItem.aiJustification}
                            </div>
                            <div style={{ borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden", marginBottom: selectedItem.similarityFlag ? 12 : 0 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 50px 80px", padding: "7px 12px", background: T.surfaceHigh, borderBottom: `1px solid ${T.border}` }}>
                                {["Criterion", "Pts", "Max", "Status"].map((h) => (
                                  <span key={h} style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{h}</span>
                                ))}
                              </div>
                              {selectedItem.rubricMatch.map((r, i) => (
                                <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr 50px 50px 80px", padding: "9px 12px", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", borderBottom: i < selectedItem.rubricMatch.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
                                  <span style={{ fontSize: 12, color: T.text1 }}>{r.name}</span>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, color: matchColors[r.status], fontWeight: 700 }}>{r.awarded}</span>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, color: T.text3 }}>{r.max}</span>
                                  <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, fontWeight: 700, color: matchColors[r.status], background: r.status === "full" ? T.emeraldDim : r.status === "partial" ? "rgba(245,158,11,0.10)" : "rgba(248,113,113,0.10)", borderRadius: 4, padding: "2px 7px", textTransform: "uppercase", display: "inline-block" }}>{r.status}</span>
                                </div>
                              ))}
                            </div>
                            {selectedItem.similarityFlag && (
                              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.07)", border: `1px solid rgba(245,158,11,0.20)`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="#f59e0b" strokeWidth="1.3" strokeLinejoin="round" /><path d="M8 6v3.5M8 11h.01" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" /></svg>
                                <span style={{ fontSize: 12, color: "#f59e0b" }}>Similar logic in <strong>{selectedItem.similarityFlag.count}</strong> other papers — <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11 }}>{selectedItem.similarityFlag.papers.join(", ")}</span></span>
                              </div>
                            )}
                          </Section>

                          <Section label="D" title="TA Decision">
                            <AnimatePresence>
                              {overrideOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING_LG} style={{ overflow: "hidden" }}>
                                  <div style={{ padding: 14, background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 8, marginBottom: 16 }}>
                                    <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Override Score</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setOverrideScore((s) => String(Math.max(0, Number(s) - 1)))}
                                        style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${T.borderMid}`, background: T.surfaceHigh, color: T.text1, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</motion.button>
                                      <div style={{ minWidth: 70, textAlign: "center", fontFamily: "Geist Mono, monospace", fontSize: 22, fontWeight: 700, color: T.cyan }}>
                                        {overrideScore}<span style={{ fontSize: 13, color: T.text3 }}>/{selectedItem.maxScore}</span>
                                      </div>
                                      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setOverrideScore((s) => String(Math.min(selectedItem.maxScore, Number(s) + 1)))}
                                        style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${T.borderMid}`, background: T.surfaceHigh, color: T.text1, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</motion.button>
                                    </div>
                                    <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Override reason (required)..." rows={3}
                                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "10px 12px", fontFamily: "Geist, sans-serif", fontSize: 13, color: T.text1, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.55 }}
                                      onFocus={(e) => (e.target.style.borderColor = T.cyan)}
                                      onBlur={(e) => (e.target.style.borderColor = T.border)} />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <MagBtn variant="primary" size="md" onClick={overrideOpen ? handleOverrideSubmit : handleApprove}>
                                {loading === "approve" || (overrideOpen && loading === "override") ? <LoadingSpinner /> : overrideOpen ? "Submit Override" : "Approve"}
                              </MagBtn>
                              {!overrideOpen && <MagBtn variant="white" size="md" onClick={toggleOverride}>Override</MagBtn>}
                              {overrideOpen && <MagBtn variant="ghost" size="md" onClick={toggleOverride}>Cancel</MagBtn>}
                            </div>
                            <div style={{ marginTop: 12, fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.text3, display: "flex", gap: 16, flexWrap: "wrap" }}>
                              {[["A", "Approve"], ["O", "Override"], ["→", "Next"], ["←", "Prev"]].map(([key, label]) => (
                                <span key={key}>
                                  <span style={{ border: `1px solid ${T.border}`, borderRadius: 4, padding: "1px 5px", fontSize: 10, color: T.text2, background: T.surface }}>{key}</span> {label}
                                </span>
                              ))}
                            </div>
                          </Section>

                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {PATH_TO_SECTION[activeRoute] === "progress" && (
            <div key="progress" style={{ flex: 1, overflowY: "auto", padding: 28 }}>
              <SectionProgress items={queue} sessionStatuses={sessionStatuses} />
            </div>
          )}

          {PATH_TO_SECTION[activeRoute] === "completed" && (
            <div key="completed" style={{ flex: 1, overflowY: "auto", padding: 28 }}>
              <SectionCompleted items={queue} sessionStatuses={sessionStatuses} />
            </div>
          )}

          {PATH_TO_SECTION[activeRoute] === "flagged" && (
            <div key="flagged" style={{ flex: 1, overflowY: "auto", padding: 28 }}>
              <SectionFlagged items={queue} sessionStatuses={sessionStatuses} />
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && <Toast key={toast} message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}