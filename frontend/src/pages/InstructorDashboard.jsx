import { useState, useContext, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import T, { SPRING, SPRING_LG, EASE_EXPO } from "../tokens";
import { MagBtn, LoadingSpinner, Dot } from "../components/ui";
import { UserContext } from "../context/UserContext";
import Sidebar from "../components/Sidebar";
import api from "../services/api";


const Ico = {
  Upload: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  ),
  Eye: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  X: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: ({ color }) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color || T.emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Edit: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

/* 
   HOOKS
 */
function useCountUp(target, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

function useBreakpoint() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return { isMobile: w < 768, isTablet: w >= 768 && w < 1024 };
}

/* 
   RUBRIC PLACEHOLDER
 */
const RUBRIC_PLACEHOLDER = `{
  "exam": "MATH201 Midterm",
  "questions": [
    {
      "id": "Q3b",
      "text": "Evaluate the definite integral \\\\int_{0}^{\\\\pi} \\\\sin(x) \\\\, dx and justify each step.",
      "criteria": [
        {
          "name": "Antiderivative setup",
          "maxPoints": 3,
          "keywords": ["-cos(x)", "antiderivative", "FTC"]
        },
        {
          "name": "Limit substitution",
          "maxPoints": 3,
          "keywords": ["cos(π)", "cos(0)", "-(-1)", "-1"]
        },
        {
          "name": "Final answer",
          "maxPoints": 2,
          "keywords": ["2", "equals 2"]
        },
        {
          "name": "Justification quality",
          "maxPoints": 2,
          "keywords": ["Fundamental Theorem", "continuity"]
        }
      ]
    },
    {
      "id": "Q4",
      "text": "Find the eigenvalues of the matrix A = [[3, 1], [0, 2]].",
      "criteria": [
        {
          "name": "Characteristic equation",
          "maxPoints": 4,
          "keywords": ["det(A - λI)", "(3-λ)(2-λ)", "λ^2 - 5λ + 6"]
        },
        {
          "name": "Correct eigenvalues",
          "maxPoints": 6,
          "keywords": ["λ = 3", "λ = 2"]
        }
      ]
    }
  ]
}`;

/* 
   SMALL SHARED COMPONENTS
 */
const StatusBadge = ({ status }) => {
  const map = {
    processing: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.22)" },
    in_review: { color: T.cyan, bg: T.cyanDim, border: "rgba(34,211,238,0.18)" },
    completed: { color: T.emerald, bg: T.emeraldDim, border: "rgba(52,211,153,0.18)" },
    released: { color: T.text3, bg: "rgba(69,85,95,0.15)", border: T.border },
  };
  const s = map[status] || map["released"];
  const displayStatus = status.replace("_", " ").toUpperCase();
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, fontFamily: "Geist Mono, monospace",
      letterSpacing: "0.07em", color: s.color, backgroundColor: s.bg,
      border: `1px solid ${s.border}`, borderRadius: "5px", padding: "2px 8px",
      whiteSpace: "nowrap",
    }}>
      {displayStatus}
    </span>
  );
};

const PctColor = (pct) => {
  if (pct >= 85) return T.emerald;
  if (pct >= 70) return T.cyan;
  if (pct >= 50) return "#f59e0b";
  return T.red;
};

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: "4px", borderRadius: "2px", backgroundColor: T.surfaceHigh, overflow: "hidden", width: "100%" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ ...SPRING_LG, delay: 0.1 }}
        style={{ height: "100%", borderRadius: "2px", backgroundColor: color || T.cyan }}
      />
    </div>
  );
}

const sectionTransition = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { ...SPRING_LG } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

const rowStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
const rowItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { ...SPRING } },
};

/* 
   STAT CARD
 */
function StatCard({ label, value, accent }) {
  const displayed = useCountUp(value);
  return (
    <motion.div
      variants={rowItem}
      style={{
        backgroundColor: T.surface, border: `1px solid ${T.border}`,
        borderRadius: "14px", padding: "24px",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: "12px", fontFamily: "Geist Mono, monospace" }}>
        {label}
      </div>
      <div style={{ fontFamily: "Geist Mono, monospace", fontWeight: 700, fontSize: "clamp(28px,3vw,40px)", color: accent || T.text1, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "10px" }}>
        {displayed.toLocaleString()}
      </div>
    </motion.div>
  );
}

/* 
   SECTION 1 — OVERVIEW
 */
function SectionOverview({ exams }) {
  return (
    <motion.div key="overview" {...sectionTransition}>
      <motion.div
        variants={rowStagger} initial="hidden" animate="visible"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}
      >
        <StatCard label="Total Exams" value={exams.length} />
        <StatCard label="Scripts Graded" value={exams.reduce((acc, curr) => acc + curr.graded, 0)} />
        <StatCard label="Pending Review" value={exams.filter(exam => exam.status === "in_review").length} accent={T.cyan} />
        <StatCard label="Flagged" value={0} accent={T.red} />
      </motion.div>

      <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: "15px", color: T.text1, letterSpacing: "-0.02em" }}>Recent Exams</span>
          <Dot color={T.cyan} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Exam Name", "Uploaded", "Scripts", "Graded", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: T.text3, fontFamily: "Geist Mono, monospace", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={rowStagger} initial="hidden" animate="visible">
              {exams.map((exam) => (
                <motion.tr
                  key={exam.id} variants={rowItem}
                  whileHover={{ backgroundColor: T.surfaceHigh }}
                  style={{ transition: "background-color 0.15s", cursor: "default" }}
                >
                  <td style={{ padding: "14px 20px", fontSize: "13.5px", color: T.text1, fontWeight: 500 }}>{exam.title}</td>
                  <td style={{ padding: "14px 20px", fontSize: "12px", color: T.text2, fontFamily: "Geist Mono, monospace", whiteSpace: "nowrap" }}>{exam.uploaded}</td>
                  <td style={{ padding: "14px 20px", fontSize: "13px", color: T.text2, fontFamily: "Geist Mono, monospace" }}>{exam.scripts}</td>
                  <td style={{ padding: "14px 20px", fontSize: "13px", color: T.text2, fontFamily: "Geist Mono, monospace" }}>{exam.graded}</td>
                  <td style={{ padding: "14px 20px" }}><StatusBadge status={exam.status} /></td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ fontSize: "12px", color: T.text3, fontFamily: "Geist Mono, monospace" }}>—</span>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* 
   SECTION 2 — EXAMS
 */
function SectionExams({ exams, onUploadSuccess }) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [rubricJson, setRubricJson] = useState(RUBRIC_PLACEHOLDER);
  const [jsonValid, setJsonValid] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const [viewingExam, setViewingExam] = useState(null);
  const moreFileInputRef = useRef();
  const [moreFiles, setMoreFiles] = useState([]);
  const [editingRubric, setEditingRubric] = useState(false);
  const [editRubricJson, setEditRubricJson] = useState("");
  const [editRubricValid, setEditRubricValid] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removingExam, setRemovingExam] = useState(false);

  useEffect(() => {
    if (viewingExam) {
      const updatedData = exams.find(e => e.id === viewingExam.id);
      if (updatedData) setViewingExam(updatedData);
    }
  }, [exams]);

  const addFiles = (incoming) => {
    const arr = Array.from(incoming).filter(f => f.type === "application/pdf");
    setFiles(prev => [...prev, ...arr.map(f => ({ file: f, name: f.name, size: f.size, progress: 0, id: Math.random() }))]);
  };

  const validateJson = () => {
    try { JSON.parse(rubricJson); setJsonValid(true); }
    catch { setJsonValid(false); }
  };

  const handleUpload = async () => {
    if (files.length === 0) { alert("Please drop or select PDF files first."); return; }
    let parsedRubric;
    try {
      parsedRubric = JSON.parse(rubricJson);
      setJsonValid(true);
    } catch {
      setJsonValid(false);
      alert("Your rubric JSON is invalid. Please fix syntax errors before uploading.");
      return;
    }
    setUploading(true);
    try {
      const title = parsedRubric.exam || "New Exam Batch";
      const response = await api.post('/exams/', { title, rubric: parsedRubric });
      const exam_id = response.data.id;
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f.file));
      formData.append("exam_id", exam_id);
      await api.post('/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setFiles(prev => prev.map(f => ({ ...f, progress: pct })));
        },
      });
      setFiles([]);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      console.log(err);
      alert(`Error: ${err.response?.data?.detail || "Failed to upload files."}`);
    } finally {
      setUploading(false);
    }
  };

  const openViewExam = (exam) => {
    setViewingExam(exam);
    setMoreFiles([]);
    setEditingRubric(false);
    setEditRubricJson(
      exam.rubric && Object.keys(exam.rubric).length > 0
        ? (typeof exam.rubric === "string" ? exam.rubric : JSON.stringify(exam.rubric, null, 2))
        : RUBRIC_PLACEHOLDER
    );
    setEditRubricValid(null);
    setConfirmRemove(false);
  };

  const closeViewExam = () => {
    setViewingExam(null);
    setMoreFiles([]);
    setEditingRubric(false);
    setConfirmRemove(false);
  };

  const addMoreFiles = (incoming) => {
    const arr = Array.from(incoming).filter(f => f.type === "application/pdf");
    setMoreFiles(prev => [...prev, ...arr.map(f => ({ file: f, name: f.name, size: f.size, progress: 0, id: Math.random() }))]);
  };

  const handleUploadMore = async () => {
    if (moreFiles.length === 0) { alert("Please select PDF files to add."); return; }
    try {
      const formData = new FormData();
      moreFiles.forEach((f) => formData.append("files", f.file));
      formData.append("exam_id", viewingExam.id);
      await api.post('/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setMoreFiles(prev => prev.map(f => ({ ...f, progress: pct })));
        },
      });
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to upload additional files.");
    }
  };

  const handleSaveRubric = async () => {
    let parsed;
    try { parsed = JSON.parse(editRubricJson); setEditRubricValid(true); }
    catch { setEditRubricValid(false); alert("Your rubric JSON is invalid."); return; }
    try {
      await api.patch(`/exams/${viewingExam.id}/`, { rubric: parsed });
      setEditingRubric(false);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save rubric.");
    }
  };

  const handleRemoveExam = async () => {
    setRemovingExam(true);
    try {
      await api.delete(`/exams/${viewingExam.id}/`);
      closeViewExam();
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to remove exam.");
    } finally {
      setRemovingExam(false);
    }
  };

  if (viewingExam) {
    const pct = viewingExam.scripts > 0 ? Math.round((viewingExam.graded / viewingExam.scripts) * 100) : 0;
    return (
      <motion.div key="exam-view" {...sectionTransition}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <motion.button onClick={closeViewExam} whileHover={{ backgroundColor: T.surfaceHigh }} whileTap={{ scale: 0.97 }}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: `1px solid ${T.border}`, borderRadius: "8px", padding: "7px 14px", cursor: "pointer", color: T.text2, fontSize: "13px", fontFamily: "Geist, sans-serif" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to Exams
          </motion.button>
          <div>
            <div style={{ fontWeight: 700, fontSize: "17px", color: T.text1, letterSpacing: "-0.02em" }}>{viewingExam.title}</div>
            <div style={{ fontSize: "11px", color: T.text3, fontFamily: "Geist Mono, monospace", marginTop: "2px" }}>Uploaded {viewingExam.uploaded}</div>
          </div>
          <div style={{ marginLeft: "auto" }}><StatusBadge status={viewingExam.status} /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              {[
                { label: "Scripts Uploaded", value: viewingExam.scripts, color: T.text1 },
                { label: "Graded", value: viewingExam.graded, color: T.cyan },
                { label: "Grading %", value: `${pct}%`, color: pct >= 85 ? T.emerald : pct >= 50 ? "#f59e0b" : T.red, mono: true },
              ].map(({ label, value, color, mono }) => (
                <div key={label} style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "18px 20px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, fontFamily: "Geist Mono, monospace", marginBottom: "8px" }}>{label}</div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color, fontFamily: mono ? "Geist Mono, monospace" : "Geist, sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: T.text1 }}>Grading Progress</span>
                <span style={{ fontFamily: "Geist Mono, monospace", fontSize: "12px", color: T.text3 }}>{viewingExam.graded} / {viewingExam.scripts}</span>
              </div>
              <ProgressBar pct={pct} color={pct >= 85 ? T.emerald : T.cyan} />
            </div>

            <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", color: T.text3, fontFamily: "Geist Mono, monospace", marginBottom: "14px" }}>UPLOAD MORE SCRIPTS</div>
              <motion.div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addMoreFiles(e.dataTransfer.files); }}
                onClick={() => moreFileInputRef.current?.click()}
                whileHover={{ borderColor: T.cyan }}
                style={{ border: `2px dashed ${T.border}`, borderRadius: "12px", padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", transition: "border-color 0.2s" }}
              >
                <input ref={moreFileInputRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={(e) => addMoreFiles(e.target.files)} />
                <Ico.Upload />
                <div style={{ fontSize: "13px", color: T.text2, fontWeight: 500 }}>Drop PDFs to add more scripts</div>
                <div style={{ fontSize: "11px", color: T.text3 }}>or <span style={{ color: T.cyan }}>browse</span> to select</div>
              </motion.div>
              <AnimatePresence>
                {moreFiles.map((f) => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    style={{ backgroundColor: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "12px 14px", marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "12.5px", color: T.text1, fontWeight: 500 }}>{f.name}</div>
                        <div style={{ fontSize: "10.5px", color: T.text3, fontFamily: "Geist Mono, monospace" }}>{(f.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "11px", fontFamily: "Geist Mono, monospace", color: f.progress === 100 ? T.emerald : T.cyan }}>{f.progress}%</span>
                        <motion.button onClick={() => setMoreFiles(p => p.filter(x => x.id !== f.id))} whileHover={{ color: T.red }} whileTap={{ scale: 0.9 }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: T.text3, display: "flex" }}>
                          <Ico.X />
                        </motion.button>
                      </div>
                    </div>
                    <ProgressBar pct={f.progress} color={f.progress === 100 ? T.emerald : T.cyan} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {moreFiles.length > 0 && (
                <div style={{ marginTop: "14px" }}>
                  <MagBtn variant="primary" size="md" onClick={handleUploadMore} style={{ width: "100%", justifyContent: "center" }}>
                    Add {moreFiles.length} file{moreFiles.length > 1 ? "s" : ""} to this exam
                  </MagBtn>
                </div>
              )}
            </div>

            <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", color: T.text3, fontFamily: "Geist Mono, monospace" }}>RUBRIC</div>
                <MagBtn variant="ghost" size="md" onClick={() => { setEditingRubric(v => !v); setEditRubricValid(null); }}>
                  {editingRubric ? "Cancel" : <><Ico.Edit />&nbsp;Change Rubric</>}
                </MagBtn>
              </div>
              <AnimatePresence>
                {!editingRubric ? (
                  <motion.div key="rubric-preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div style={{ backgroundColor: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "14px", fontFamily: "Geist Mono, monospace", fontSize: "11.5px", color: T.text2, lineHeight: 1.7, maxHeight: "160px", overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {viewingExam.rubric && Object.keys(viewingExam.rubric).length > 0
                        ? (typeof viewingExam.rubric === "string" ? viewingExam.rubric : JSON.stringify(viewingExam.rubric, null, 2))
                        : "No rubric attached to this exam."}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="rubric-editor" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ ...SPRING_LG }} style={{ overflow: "hidden" }}>
                    <textarea value={editRubricJson} onChange={(e) => { setEditRubricJson(e.target.value); setEditRubricValid(null); }}
                      style={{ width: "100%", minHeight: "220px", resize: "vertical", backgroundColor: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "14px", color: T.text1, fontFamily: "Geist Mono, monospace", fontSize: "12px", lineHeight: 1.7, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                      onFocus={(e) => e.target.style.borderColor = T.cyan}
                      onBlur={(e) => e.target.style.borderColor = T.border} />
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "10px" }}>
                      <MagBtn variant="primary" size="md" onClick={handleSaveRubric}>Save Rubric</MagBtn>
                      <AnimatePresence mode="wait">
                        {editRubricValid === true && (
                          <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "12px", color: T.emerald, display: "flex", alignItems: "center", gap: "5px" }}>
                            <Ico.Check />&nbsp;Valid JSON
                          </motion.span>
                        )}
                        {editRubricValid === false && (
                          <motion.span key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "12px", color: T.red }}>
                            Parse error — check syntax
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", color: T.text3, fontFamily: "Geist Mono, monospace", marginBottom: "14px" }}>EXAM INFO</div>
              {[
                { label: "Title", value: viewingExam.title },
                { label: "Upload Date", value: viewingExam.uploaded },
                { label: "Total Scripts", value: viewingExam.scripts },
                { label: "Status", value: <StatusBadge status={viewingExam.status} /> },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: "12px", color: T.text3 }}>{label}</span>
                  <span style={{ fontSize: "12.5px", color: T.text1, fontWeight: 500, fontFamily: typeof value === "string" && /^\d/.test(value) ? "Geist Mono, monospace" : "Geist, sans-serif" }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", color: T.text3, fontFamily: "Geist Mono, monospace", marginBottom: "14px" }}>DANGER ZONE</div>
              <AnimatePresence mode="wait">
                {!confirmRemove ? (
                  <motion.div key="remove-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div style={{ fontSize: "12px", color: T.text3, marginBottom: "12px", lineHeight: 1.5 }}>Permanently remove this exam and all associated scripts and grades. This cannot be undone.</div>
                    <MagBtn variant="danger" size="md" onClick={() => setConfirmRemove(true)} style={{ width: "100%", justifyContent: "center" }}>Remove Exam</MagBtn>
                  </motion.div>
                ) : (
                  <motion.div key="remove-confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: T.red, marginBottom: "8px" }}>Are you sure?</div>
                    <div style={{ fontSize: "12px", color: T.text3, marginBottom: "14px", lineHeight: 1.5 }}>
                      This will permanently delete <strong style={{ color: T.text1 }}>{viewingExam.title}</strong> and all {viewingExam.scripts} scripts.
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <MagBtn variant="danger" size="md" onClick={handleRemoveExam} style={{ flex: 1, justifyContent: "center" }}>
                        {removingExam ? <><LoadingSpinner />&nbsp;Removing…</> : "Yes, Remove"}
                      </MagBtn>
                      <MagBtn variant="ghost" size="md" onClick={() => setConfirmRemove(false)}>Cancel</MagBtn>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key="exams" {...sectionTransition}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            animate={{ scale: dragOver ? 1.01 : 1, borderColor: dragOver ? T.cyan : T.border, backgroundColor: dragOver ? T.cyanDim : "transparent" }}
            transition={{ ...SPRING }}
            style={{ border: `2px dashed ${T.border}`, borderRadius: "16px", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", cursor: "pointer", color: T.text3 }}
          >
            <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
            <Ico.Upload />
            <div style={{ fontSize: "14px", color: T.text2, fontWeight: 500 }}>Drop PDF files here</div>
            <div style={{ fontSize: "12px", color: T.text3 }}>or <span style={{ color: T.cyan }}>browse</span> to select</div>
          </motion.div>

          <AnimatePresence>
            {files.map((f) => (
              <motion.div key={f.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "13px", color: T.text1, fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontSize: "11px", color: T.text3, fontFamily: "Geist Mono, monospace" }}>{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "11px", fontFamily: "Geist Mono, monospace", color: f.progress === 100 ? T.emerald : T.cyan }}>{f.progress}%</span>
                    <motion.button onClick={() => setFiles(p => p.filter(x => x.id !== f.id))} whileHover={{ color: T.red }} whileTap={{ scale: 0.9 }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: T.text3, display: "flex" }}>
                      <Ico.X />
                    </motion.button>
                  </div>
                </div>
                <ProgressBar pct={f.progress} color={f.progress === 100 ? T.emerald : T.cyan} />
              </motion.div>
            ))}
          </AnimatePresence>

          <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", color: T.text3, fontFamily: "Geist Mono, monospace", marginBottom: "12px" }}>RUBRIC DEFINITION</div>
            <textarea value={rubricJson} onChange={(e) => { setRubricJson(e.target.value); setJsonValid(null); }}
              style={{ width: "100%", minHeight: "220px", resize: "vertical", backgroundColor: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "14px", color: T.text1, fontFamily: "Geist Mono, monospace", fontSize: "12px", lineHeight: 1.7, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              onFocus={(e) => e.target.style.borderColor = T.cyan}
              onBlur={(e) => e.target.style.borderColor = T.border} />
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "10px" }}>
              <MagBtn variant="ghost" size="md" onClick={validateJson}>Validate JSON</MagBtn>
              <AnimatePresence mode="wait">
                {jsonValid === true && (
                  <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "12px", color: T.emerald, display: "flex", alignItems: "center", gap: "5px" }}>
                    <Ico.Check />&nbsp;Valid JSON
                  </motion.span>
                )}
                {jsonValid === false && (
                  <motion.span key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: "12px", color: T.red }}>
                    Parse error — check syntax
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <MagBtn variant="primary" size="lg" onClick={handleUpload} style={{ width: "100%", justifyContent: "center" }}>
            {uploading ? <><LoadingSpinner />&nbsp;&nbsp;Processing…</> : "Upload & Start Grading"}
          </MagBtn>
        </div>

        <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: T.text1 }}>Uploaded Batches</span>
            <span style={{ fontFamily: "Geist Mono, monospace", fontSize: "11px", color: T.text3 }}>{exams.length} total</span>
          </div>
          <motion.div variants={rowStagger} initial="hidden" animate="visible" style={{ padding: "12px" }}>
            {exams.map((exam) => {
              const pct = exam.scripts > 0 ? Math.round((exam.graded / exam.scripts) * 100) : 0;
              return (
                <motion.div key={exam.id} variants={rowItem} style={{ padding: "14px", borderRadius: "10px", marginBottom: "8px", backgroundColor: T.surfaceHigh }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: T.text1, marginBottom: "2px" }}>{exam.title}</div>
                      <div style={{ fontSize: "11px", color: T.text3, fontFamily: "Geist Mono, monospace" }}>{exam.uploaded} · {exam.scripts} scripts</div>
                    </div>
                    <StatusBadge status={exam.status} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <div style={{ flex: 1 }}><ProgressBar pct={pct} /></div>
                    <span style={{ fontSize: "11px", fontFamily: "Geist Mono, monospace", color: T.text3, flexShrink: 0 }}>{pct}%</span>
                  </div>
                  <MagBtn variant="ghost" size="md" onClick={() => openViewExam(exam)} style={{ width: "100%", justifyContent: "center" }}>
                    <Ico.Eye />&nbsp;View Exam
                  </MagBtn>
                </motion.div>
              );
            })}
            {exams.length === 0 && (
              <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: T.text3 }}>No exams uploaded yet</div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* 
   SECTION 3 — GRADES
 */
function SectionGrades() {
  const [search, setSearch] = useState("");
  const { user } = useContext(UserContext);
  const [grades, setGrades] = useState([]);

  const fetchGrades = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get('/upload/instructor_exams');
      setGrades(response.data ?? []);
    } catch (err) {
      console.error("Failed to fetch grades", err);
      setGrades([]);
    }
  }, [user]);

  useEffect(() => { fetchGrades(); }, [fetchGrades]);

  const filtered = grades.filter(g =>
    g.id.toLowerCase().includes(search.toLowerCase()) ||
    g.exam.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div key="grades" {...sectionTransition}>
      <div style={{ marginBottom: "20px" }}>
        <div style={{ position: "relative", maxWidth: "400px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: T.text3, pointerEvents: "none" }}><Ico.Search /></span>
          <input placeholder="Search student ID or exam…" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "9px 12px 9px 36px", color: T.text1, fontFamily: "Geist, sans-serif", fontSize: "13px", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
            onFocus={(e) => e.target.style.borderColor = T.cyan}
            onBlur={(e) => e.target.style.borderColor = T.border} />
        </div>
      </div>

      <div style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Student ID", "Exam", "Score", "Max", "Percentage", "Status"].map(h => (
                  <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: T.text3, fontFamily: "Geist Mono, monospace", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <motion.tbody variants={rowStagger} initial="hidden" animate="visible">
              {filtered.map((g) => {
                const pct = g.max > 0 ? Math.round((g.score / g.max) * 100) : 0;
                return (
                  <motion.tr key={`${g.id}-${g.exam}`} variants={rowItem} whileHover={{ backgroundColor: T.surfaceHigh }} style={{ transition: "background-color 0.15s" }}>
                    <td style={{ padding: "13px 20px", fontFamily: "Geist Mono, monospace", fontSize: "12.5px", color: T.cyan }}>{g.id}</td>
                    <td style={{ padding: "13px 20px", fontSize: "13px", color: T.text2 }}>{g.exam}</td>
                    <td style={{ padding: "13px 20px", fontFamily: "Geist Mono, monospace", fontSize: "13px", color: T.text1, fontWeight: 600 }}>{g.score}</td>
                    <td style={{ padding: "13px 20px", fontFamily: "Geist Mono, monospace", fontSize: "13px", color: T.text3 }}>{g.max}</td>
                    <td style={{ padding: "13px 20px" }}>
                      <span style={{ fontFamily: "Geist Mono, monospace", fontSize: "13px", fontWeight: 700, color: PctColor(pct) }}>{pct}%</span>
                    </td>
                    <td style={{ padding: "13px 20px" }}>
                      <StatusBadge status={pct >= 50 ? "completed" : "processing"} />
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* 
   SECTION ROUTING
 */
const SECTION_META = {
  overview: { title: "Overview", sub: "Your grading workspace at a glance" },
  exams: { title: "Exams", sub: "Upload and manage exam batches" },
  grades: { title: "Grades", sub: "Review scores and release to students" },
};

const PATH_TO_SECTION = {
  "/instructor": "overview",
  "/instructor/exams": "exams",
  "/instructor/grades": "grades",
};

/* 
   INSTRUCTOR DASHBOARD
 */
export default function InstructorDashboard() {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const { isMobile } = useBreakpoint();
  const [activeRoute, setActiveRoute] = useState("/instructor");
  const [exams, setExams] = useState([]);

  const section = PATH_TO_SECTION[activeRoute] || "overview";
  const meta = SECTION_META[section];

  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); return; }
    if (user.role !== "instructor") navigate("/ta", { replace: true });
  }, [user, navigate]);

  const fetchExams = useCallback(async () => {
    if (!user) return;
    try {
      const response = await api.get('/exams/');
      setExams(response.data ?? []);
    } catch (err) {
      console.error("Failed to fetch exams", err);
      setExams([]);
    }
  }, [user]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const handleNavigate = (path) => {
    setActiveRoute(path);
    navigate(path, { replace: true });
  };

  return (
    <div style={{ display: "flex", minHeight: "100dvh", backgroundColor: T.bg, fontFamily: "Geist, sans-serif" }}>
      <Sidebar activeRoute={activeRoute} onNavigate={handleNavigate} />

      <div style={{ flex: 1, marginLeft: 220, display: "flex", flexDirection: "column", minHeight: "100dvh", overflow: "hidden" }}>
        <div style={{
          height: "56px", backgroundColor: T.surface, borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `0 ${isMobile ? "64px" : "28px"} 0 28px`, flexShrink: 0,
          position: "sticky", top: 0, zIndex: 40,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: T.text1, letterSpacing: "-0.02em" }}>{meta.title}</div>
            <div style={{ fontSize: "11px", color: T.text3, marginTop: "1px" }}>{meta.sub}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Dot color={T.emerald} />
            <span style={{ fontSize: "12px", color: T.text3, fontFamily: "Geist Mono, monospace" }}>Live</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
          <AnimatePresence mode="wait">
            {section === "overview" && <SectionOverview key="overview" exams={exams} />}
            {section === "exams" && <SectionExams key="exams" exams={exams} onUploadSuccess={fetchExams} />}
            {section === "grades" && <SectionGrades key="grades" />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}