import { useRef, useState, useEffect, Suspense, useMemo, useCallback, useContext } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
} from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import T, { EASE_EXPO, SPRING, SPRING_LG } from "../tokens";
import { MagBtn, Dot, Arrow, LoadingSpinner, FLInput, FLSelect } from "../components/ui";
import { UserContext } from "../context/UserContext";

function Nav({ onAuth }) {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 60], ["rgba(6,8,10,0)", "rgba(6,8,10,0.88)"]);
  const bdr = useTransform(scrollY, [0, 60], ["rgba(255,255,255,0)", T.border]);
  const navigate = useNavigate();

  return (
    <motion.header
      style={{
        backgroundColor: bg, borderBottomColor: bdr,
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        borderBottomWidth: 1, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "0 clamp(20px,5vw,80px)", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div style={{ width: 26, height: 26, background: T.cyan, borderRadius: 6, display: "grid", placeItems: "center" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 6.5h9M6.5 2l4.5 4.5L6.5 11" stroke={T.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text1, letterSpacing: "-0.025em" }}>GradeOps</span>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11, fontFamily: "Geist Mono, monospace", color: T.emerald,
            background: T.emeraldDim, border: `1px solid rgba(52,211,153,0.18)`,
            padding: "3px 9px", borderRadius: 4, letterSpacing: "0.07em",
          }}>BETA</span>
          <MagBtn onClick={() => navigate("/login")} variant="ghost">Sign in</MagBtn>
          <MagBtn onClick={onAuth} variant="primary">Register <Arrow /></MagBtn>
        </motion.div>
      </div>
    </motion.header>
  );
}

function Particles({ count = 2800 }) {
  const ref = useRef();
  const mouse = useRef([0, 0]);

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.cbrt(Math.random()) * 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, [count]);

  useEffect(() => {
    const h = (e) => {
      mouse.current = [(e.clientX / window.innerWidth - 0.5) * 2, -(e.clientY / window.innerHeight - 0.5) * 2];
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.035;
    ref.current.rotation.x += dt * 0.015;
    ref.current.rotation.y += (mouse.current[0] * 0.002 - ref.current.rotation.y * 0.002);
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial transparent color="#22d3ee" size={0.025} sizeAttenuation depthWrite={false} opacity={0.45} />
    </Points>
  );
}

function HorizonGrid() {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.z = ((state.clock.elapsedTime * 0.3) % 2);
  });
  const lines = useMemo(() => {
    const out = [];
    for (let i = -8; i <= 8; i++) {
      out.push(
        <line key={`h${i}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([-12, -3.5, i * 2, 12, -3.5, i * 2])} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color={[0.12, 0.92, 0.64]} transparent opacity={0.06} />
        </line>,
        <line key={`v${i}`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([i * 1.5, -3.5, -20, i * 1.5, -3.5, 20])} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color={[0.12, 0.92, 0.64]} transparent opacity={0.06} />
        </line>
      );
    }
    return out;
  }, []);
  return <group ref={ref}>{lines}</group>;
}

function Scene3D() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <Suspense fallback={null}>
        <Particles />
        <HorizonGrid />
      </Suspense>
    </>
  );
}

function HeroPanel({ children, scrollRef }) {
  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.22, 0.72, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.22], [36, 0]);

  return (
    <motion.div style={{
      opacity, y,
      position: "sticky", top: 0, height: "100dvh",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 clamp(24px,6vw,96px)",
      maxWidth: 1280, margin: "0 auto",
      paddingTop: 52, zIndex: 2,
      pointerEvents: "none",
    }}>
      {children}
    </motion.div>
  );
}

function Hero({ onAuth }) {
  const phase1Ref = useRef();
  const phase2Ref = useRef();
  const phase3Ref = useRef();

  const { scrollYProgress: p1Progress } = useScroll({ target: phase1Ref, offset: ["start start", "end start"] });
  const p1Opacity = useTransform(p1Progress, [0.7, 1], [1, 0]);
  const p1Y = useTransform(p1Progress, [0.7, 1], [0, -24]);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <Canvas camera={{ position: [0, 0, 8], fov: 55 }} dpr={[1, 1.5]} gl={{ antialias: false, powerPreference: "high-performance" }}>
          <Scene3D />
        </Canvas>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 75% 85% at 40% 50%, transparent 0%, rgba(6,8,10,0.82) 100%)" }} />
      </div>

      <section ref={phase1Ref} style={{ position: "relative", height: "115dvh", zIndex: 1 }}>
        <motion.div style={{
          opacity: p1Opacity, y: p1Y,
          position: "sticky", top: 0, height: "100dvh",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 clamp(24px,6vw,96px)",
          maxWidth: 1280, margin: "0 auto",
          paddingTop: 52, zIndex: 2, pointerEvents: "none",
        }}>
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.3 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: T.cyanDim, border: `1px solid rgba(34,211,238,0.18)`,
              borderRadius: 100, padding: "4px 13px 4px 8px",
              width: "fit-content", marginBottom: 36,
            }}
          >
            <Dot color={T.cyan} />
            <span style={{ fontSize: 11, fontFamily: "Geist Mono, monospace", color: T.cyan, letterSpacing: "0.09em" }}>HUMAN-IN-THE-LOOP GRADING</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.45 }}
            style={{ fontSize: "clamp(52px,8vw,108px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.048em", color: T.text1 }}
          >
            Tired of bulk<br />
            <span style={{ color: T.text3 }}>exam sheets?</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} transition={{ delay: 1.4 }}
            style={{ position: "absolute", bottom: 32, left: "50%", translateX: "-50%", pointerEvents: "none" }}>
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v12M3 9l6 6 6-6" stroke={T.text2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      <section ref={phase2Ref} style={{ position: "relative", height: "115dvh", zIndex: 1 }}>
        <HeroPanel scrollRef={phase2Ref}>
          <div style={{ fontSize: 11, fontFamily: "Geist Mono, monospace", color: T.text3, letterSpacing: "0.1em", marginBottom: 28 }}>THE SOLUTION</div>
          <h2 style={{ fontSize: "clamp(52px,8vw,108px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: "-0.048em", color: T.text1 }}>
            Meet <span style={{ color: T.cyan, textShadow: `0 0 60px rgba(34,211,238,0.35)` }}>GradeOps.</span>
          </h2>
        </HeroPanel>
      </section>

      <section ref={phase3Ref} style={{ position: "relative", height: "115dvh", zIndex: 1 }}>
        <HeroPanel scrollRef={phase3Ref}>
          <p style={{ fontSize: "clamp(15px,1.7vw,19px)", lineHeight: 1.78, color: T.text2, maxWidth: "56ch", marginBottom: 36 }}>
            Grading handwritten exams is time-consuming, inconsistent, and prone to fatigue-induced bias.
            We built a <span style={{ color: T.text1, fontWeight: 500 }}>Human-in-the-Loop (HITL) grading pipeline</span> that uses{" "}
            <span style={{ color: T.cyan, fontWeight: 500 }}>Vision-Language Models (VLMs)</span> and{" "}
            <span style={{ color: T.emerald, fontWeight: 500 }}>Agentic LLMs</span> to evaluate scanned exams against strict rubrics.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", pointerEvents: "all" }}>
            <MagBtn onClick={onAuth} variant="primary" size="lg">Request access <Arrow /></MagBtn>
          </div>
        </HeroPanel>
      </section>
    </>
  );
}

function TerminalVisual() {
  const LOG = [
    "SCAN_PAGE_03.jpg → tokenizer",
    'vision_encoder: extracting features...',
    'field: "Q2a" → "∫f(x)dx from 0 to π"',
    "rubric_match: partial_credit [0.6]",
    'justification: "limits swapped — sign error"',
    "similarity_check: 3 papers flagged",
    "pipeline: GRADING 47 / 120",
  ];
  const [lines, setLines] = useState([0]);
  useEffect(() => {
    const t = setInterval(() => setLines(p => p.length >= LOG.length ? [0] : [...p, p.length]), 820);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", boxShadow: `0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)` }}>
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 7 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.65 }} />)}
        <span style={{ marginLeft: 8, fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.text3 }}>gradeops-pipeline</span>
        <Dot color={T.emerald} />
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 5 }}>
        <AnimatePresence>
          {lines.map(idx => (
            <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24, ease: EASE_EXPO }} style={{ display: "flex", gap: 10 }}>
              <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.text3, minWidth: 20 }}>{String(idx + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, lineHeight: 1.6, wordBreak: "break-all", color: idx === lines.length - 1 ? T.cyan : idx % 3 === 2 ? T.emerald : T.text2 }}>{LOG[idx]}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 5, height: 12, background: T.cyan, borderRadius: 1, marginLeft: 30 }} />
      </div>
      <motion.div animate={{ x: ["-100%", "120%"] }} transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }} style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.cyan}, transparent)`, opacity: 0.5 }} />
    </div>
  );
}

function MiniCard({ children }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)", maxWidth: 400, width: "100%" }}>{children}</div>;
}
function CardLabel({ children, color }) {
  return <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color, letterSpacing: "0.1em", marginBottom: 14, opacity: 0.75 }}>{children}</div>;
}
function ProgressBar({ value, color }) {
  return (
    <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", marginTop: 14 }}>
      <motion.div animate={{ width: `${value * 100}%` }} transition={{ duration: 0.7, ease: EASE_EXPO }} style={{ height: "100%", background: color, borderRadius: 2 }} />
    </div>
  );
}

function UploadVisual() {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep(s => (s + 1) % 4), 1500); return () => clearInterval(t); }, []);
  const msgs = ["Awaiting upload...", "Parsing PDF structure...", "Extracting 32 pages...", "Pages queued — ready"];
  return (
    <MiniCard>
      <CardLabel color={T.cyan}>PDF INGESTION</CardLabel>
      <div style={{ height: 52, position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }} style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, color: T.cyan, position: "absolute" }}>
            &gt; {msgs[step]}
          </motion.div>
        </AnimatePresence>
      </div>
      <ProgressBar value={step / 3} color={T.cyan} />
    </MiniCard>
  );
}

function RBACVisual() {
  const roles = [
    { name: "Dr. Adeyemi", tag: "Instructor", perms: ["Edit rubric"], c: T.cyan },
    { name: "Priya Krishnamurthy", tag: "TA", perms: ["Review queue", "Override"], c: T.emerald },
  ];
  return (
    <MiniCard>
      <CardLabel color={T.emerald}>ACCESS CONTROL</CardLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {roles.map(r => (
          <div key={r.name} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.025)", borderRadius: 9, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text1 }}>{r.name}</span>
              <span style={{ fontSize: 10, fontFamily: "Geist Mono, monospace", padding: "2px 8px", borderRadius: 4, background: r.c + "20", color: r.c }}>{r.tag}</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {r.perms.map(p => <span key={p} style={{ fontSize: 10, color: T.text3, background: "rgba(255,255,255,0.03)", padding: "2px 7px", borderRadius: 4, border: `1px solid ${T.border}` }}>{p}</span>)}
            </div>
          </div>
        ))}
      </div>
    </MiniCard>
  );
}

function PipelineVisual() {
  const stages = ["OCR Extraction", "VLM Parsing", "Rubric Match", "Partial Credit", "Justification", "Similarity Check"];
  const [active, setActive] = useState(0);
  useEffect(() => { const t = setInterval(() => setActive(a => (a + 1) % stages.length), 950); return () => clearInterval(t); }, []);
  return (
    <MiniCard>
      <CardLabel color={T.cyan}>AGENTIC PIPELINE</CardLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stages.map((s, i) => (
          <motion.div key={s} animate={{ opacity: i <= active ? 1 : 0.22 }} transition={{ duration: 0.3 }} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <motion.div animate={{ background: i === active ? T.cyan : i < active ? T.emerald : "rgba(255,255,255,0.08)" }} transition={{ duration: 0.3 }} style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontFamily: "Geist Mono, monospace", color: i === active ? T.cyan : T.text2 }}>{s}</span>
            {i === active && <Dot color={T.cyan} />}
          </motion.div>
        ))}
      </div>
    </MiniCard>
  );
}

function DashboardVisual() {
  const items = [{ id: "Q3b", status: "approved", score: "8/10" }, { id: "Q2a", status: "override", score: "6/10" }, { id: "Q4c", status: "pending", score: "—" }];
  const sc = { approved: T.emerald, override: "#fbbf24", pending: T.text3 };
  return (
    <MiniCard>
      <CardLabel color={T.emerald}>REVIEW QUEUE</CardLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "rgba(255,255,255,0.025)", borderRadius: 8, border: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, color: T.text1 }}>{item.id}</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 12, color: T.text2 }}>{item.score}</span>
              <span style={{ fontSize: 10, fontFamily: "Geist Mono, monospace", color: sc[item.status], background: sc[item.status] + "18", padding: "2px 8px", borderRadius: 4 }}>{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </MiniCard>
  );
}

const FEATURES = [
  { num: "01", title: "Bulk PDF ingestion & JSON rubrics", body: "Web portal to upload bulk exam scans (PDFs) and define JSON rubrics. Structured rubric schemas ensure every question's weighting, expected concepts, and partial credit brackets are machine-readable from the start.", accent: T.cyan, Visual: UploadVisual },
  { num: "02", title: "Role-Based Access Control", body: "Instructors own rubric authorship, grade release, and audit logs. TAs operate within a scoped review queue. RBAC is enforced at the API layer — not just the UI.", accent: T.emerald, Visual: RBACVisual },
  { num: "03", title: "OCR & Vision model extraction", body: "Specialized OCR/Vision models extract messy handwritten answers from scanned pages. Multi-column layouts, crossed-out text, and margin annotations are handled as discrete tokens.", accent: T.cyan, Visual: TerminalVisual },
  { num: "04", title: "Agentic LLM grading pipeline", body: "Awards partial credit, generates structured justifications, and flags highly similar logic structures for plagiarism. Each decision includes a confidence score and a cited rubric clause.", accent: T.emerald, Visual: PipelineVisual },
  { num: "05", title: "High-throughput review dashboard", body: "Allows TAs to rapidly review, approve, or override decisions. Keyboard-first design means a trained TA can process a verdict in under four seconds without lifting their hands.", accent: T.cyan, Visual: DashboardVisual },
];

function FeatRow({ f, i }) {
  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 44 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...SPRING_LG, delay: i * 0.06 }}
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(32px,6vw,100px)", alignItems: "center", padding: "clamp(52px,7vw,88px) 0", borderBottom: `1px solid ${T.border}` }}
      className="feat-row"
    >
      <div style={{ order: i % 2 === 0 ? 0 : 1 }}>
        <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: f.accent, letterSpacing: "0.1em", marginBottom: 16, opacity: 0.7 }}>{f.num}</div>
        <h3 style={{ fontSize: "clamp(18px,2.2vw,26px)", fontWeight: 700, letterSpacing: "-0.03em", color: T.text1, lineHeight: 1.2, marginBottom: 16 }}>{f.title}</h3>
        <p style={{ fontSize: 15, lineHeight: 1.78, color: T.text2, maxWidth: "52ch" }}>{f.body}</p>
      </div>
      <div style={{ order: i % 2 === 0 ? 1 : 0, display: "flex", justifyContent: i % 2 === 0 ? "flex-end" : "flex-start" }}>
        <f.Visual />
      </div>
    </motion.div>
  );
}

function Features() {
  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  return (
    <section style={{ background: T.bg, padding: "0 0 clamp(80px,12vw,140px)", position: "relative", zIndex: 10 }}>
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.border}, transparent)` }} />
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(24px,6vw,96px)" }}>
        <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={SPRING_LG} style={{ padding: "clamp(56px,8vw,96px) 0 clamp(32px,4vw,56px)" }}>
          <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.emerald, letterSpacing: "0.1em", marginBottom: 16, opacity: 0.75 }}>PIPELINE OVERVIEW</div>
          <h2 style={{ fontSize: "clamp(30px,4.5vw,56px)", fontWeight: 900, letterSpacing: "-0.045em", color: T.text1, lineHeight: 1.02, maxWidth: "20ch" }}>Five stages. One coherent workflow.</h2>
        </motion.div>
        {FEATURES.map((f, i) => <FeatRow key={f.num} f={f} i={i} />)}
      </div>
    </section>
  );
}

// ─── Eye icon SVG (show/hide password toggle) ────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─── Password input with show/hide toggle ────────────────────────────────────
function PasswordInput({ id, label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <FLInput
        id={id}
        label={label}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        required
        autoComplete={autoComplete}
        style={{ paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: T.text3,
          display: "flex",
          alignItems: "center",
          padding: 4,
          borderRadius: 4,
          transition: "color 0.15s",
          lineHeight: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = T.cyan}
        onMouseLeave={e => e.currentTarget.style.color = T.text3}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  );
}

// ─── Password strength meter (register only) ─────────────────────────────────
function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: T.red || "#f87171" };
  if (score === 2) return { score: 2, label: "Fair", color: "#fbbf24" };
  if (score === 3) return { score: 3, label: "Good", color: T.cyan };
  return { score: 4, label: "Strong", color: T.emerald };
}

function PasswordStrengthMeter({ password }) {
  const { score, label, color } = getPasswordStrength(password);
  if (!password) return null;

  const segments = 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ marginTop: -4 }}
    >
      {/* Segmented bar */}
      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ background: i < score ? color : "rgba(255,255,255,0.06)" }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            style={{ flex: 1, height: 3, borderRadius: 2 }}
          />
        ))}
      </div>
      {/* Label row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: T.text3, letterSpacing: "0.05em" }}>
          Password strength
        </span>
        <motion.span
          key={label}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
          style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color, letterSpacing: "0.06em", fontWeight: 600 }}
        >
          {label}
        </motion.span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const SLIDE = {
  initial: d => ({ opacity: 0, x: d * 28, scale: 0.98 }),
  animate: { opacity: 1, x: 0, scale: 1, transition: { ...SPRING } },
  exit: d => ({ opacity: 0, x: d * -28, scale: 0.98, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }),
};

function AuthSection({ id }) {
  const [mode, setMode] = useState("login");
  const {login} = useContext(UserContext)
  const [dir, setDir] = useState(1);
  const [lem, setLem] = useState(""); const [lpw, setLpw] = useState("");
  const [lLoading, setLLoading] = useState(false); const [lOk, setLOk] = useState(false);
  const [rem, setRem] = useState(""); const [rpw, setRpw] = useState("");
  const [rcp, setRcp] = useState(""); const [rol, setRol] = useState("");
  const [rLoading, setRLoading] = useState(false); const [rOk, setROk] = useState(false);
  const [rErr, setRErr] = useState("");
  const navigate = useNavigate();

  const doLogin = async (e) => {
    e.preventDefault();
    setLLoading(true);

    try {
      await api.post('/login/', {
        email: lem,
        password: lpw
      });

      const response = await api.get('/users/me')
      const userData = response.data;

      login(userData);
      setTimeout(() => {
        navigate(userData.role === "instructor" ? "/instructor" : "/ta");
      }, 600);
    } catch (err) {
      console.log(err);
    }
    setTimeout(() => { setLLoading(false); setLOk(true); }, 600);
  };

  const doRegister = async (e) => {
    e.preventDefault(); setRErr("");
    if (rpw !== rcp) { setRErr("Passwords do not match."); return; }
    if (!rol) { setRErr("Please select a role."); return; }
    if (rpw.length() < 6) { setRErr("Password must be at least 6 characters.")}
    setRLoading(true);

    try {
      const response = await api.post('/register/', {
        email: rem,
        password: rpw,
        role: rol
      });
      setTimeout(() => {
        setROk(true);
        navigate("/login");
      }, 600);
    } catch (error) {
      setRErr(error.response?.data?.detail || "Registration failed")
      setROk(false)
    }

    setTimeout(() => { setRLoading(false) }, 600);
  };

  const switchMode = (next) => {
    setDir(next === "register" ? 1 : -1);
    setMode(next);
    setLOk(false); setROk(false); setRErr("");
  };

  const ref = useRef();
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section id={id} style={{ background: T.bg, padding: "clamp(80px,12vw,140px) 0 clamp(60px,8vw,100px)", position: "relative", zIndex: 10 }}>
      <div style={{ position: "absolute", width: 500, height: 500, background: `radial-gradient(circle, ${T.cyanDim} 0%, transparent 70%)`, left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
      <div ref={ref} style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(24px,6vw,96px)", position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={SPRING_LG}
          style={{ marginBottom: "clamp(48px,6vw,72px)", textAlign: "center" }}>
          <div style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: T.cyan, letterSpacing: "0.1em", marginBottom: 14, opacity: 0.75 }}>ACCESS</div>
          <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.045em", color: T.text1, lineHeight: 1.04, marginBottom: 16 }}>
            {mode === "login" ? "Welcome back." : "Join GradeOps."}
          </h2>
          <p style={{ fontSize: 15, color: T.text2, maxWidth: "46ch", margin: "0 auto", lineHeight: 1.72 }}>
            {mode === "login" ? "Your grading queue is waiting. Sign in to access the HITL review dashboard." : "Request beta access. Instructor accounts are verified against your institution."}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 36 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ ...SPRING_LG, delay: 0.08 }}
          style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 20, padding: "clamp(28px,4vw,44px)", boxShadow: `0 40px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: `linear-gradient(90deg, transparent, ${T.cyan}, transparent)`, opacity: 0.55 }} />

            <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`, borderRadius: 10, padding: 3, marginBottom: 28, gap: 3 }}>
              {["login", "register"].map(m => (
                <motion.button key={m} onClick={() => switchMode(m)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "Geist, sans-serif", background: "transparent", color: mode === m ? T.text1 : T.text3, position: "relative", outline: "none", transition: "color 0.2s" }}
                  whileTap={{ scale: 0.97 }}>
                  {m === "login" ? "Sign in" : "Register"}
                  {mode === m && <motion.div layoutId="tab" transition={SPRING} style={{ position: "absolute", inset: 0, borderRadius: 8, background: T.surfaceHigh, border: `1px solid ${T.border}`, zIndex: -1 }} />}
                </motion.button>
              ))}
            </div>

            <div style={{ minHeight: mode === "login" ? 240 : 420, position: "relative" }}>
              <AnimatePresence mode="wait" custom={dir}>
                {mode === "login" && (
                  <motion.form key="login" custom={dir} variants={SLIDE} initial="initial" animate="animate" exit="exit" onSubmit={doLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <FLInput id="l-em" label="Email address" type="email" value={lem} onChange={e => setLem(e.target.value)} required autoComplete="email" />
                    {/* Password field with show/hide toggle */}
                    <PasswordInput
                      id="l-pw"
                      label="Password"
                      value={lpw}
                      onChange={e => setLpw(e.target.value)}
                      autoComplete="current-password"
                    />
                    <motion.button type="submit" disabled={lLoading || lOk} whileTap={{ scale: 0.97 }}
                      style={{ marginTop: 8, height: 50, borderRadius: 10, border: "none", cursor: lLoading ? "wait" : "pointer", background: lOk ? T.emerald : T.cyan, color: T.bg, fontSize: 14, fontWeight: 700, fontFamily: "Geist, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.3s ease", boxShadow: lOk ? `0 0 28px ${T.emeraldGlow}` : `0 0 28px ${T.cyanGlow}`, letterSpacing: "-0.01em" }}>
                      {lLoading ? <LoadingSpinner /> : lOk ? "Signed in" : "Sign in"}
                    </motion.button>
                    <p style={{ textAlign: "center", fontSize: 13, color: T.text3, marginTop: 6 }}>
                      New to GradeOps?{" "}
                      <button type="button" onClick={() => switchMode("register")} style={{ background: "none", border: "none", color: T.cyan, cursor: "pointer", fontSize: 13, fontFamily: "Geist, sans-serif", padding: 0, fontWeight: 500 }}>Register here</button>
                    </p>
                  </motion.form>
                )}
                {mode === "register" && (
                  <motion.form key="register" custom={dir} variants={SLIDE} initial="initial" animate="animate" exit="exit" onSubmit={doRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <FLInput id="r-em" label="Email address" type="email" value={rem} onChange={e => { setRem(e.target.value); setROk(false) }} required autoComplete="email" />
                    {/* Password field with show/hide toggle */}
                    <PasswordInput
                      id="r-pw"
                      label="Password"
                      value={rpw}
                      onChange={e => { setRpw(e.target.value); setROk(false); }}
                      autoComplete="new-password"
                    />
                    {/* Password strength meter */}
                    <AnimatePresence>
                      {rpw && <PasswordStrengthMeter password={rpw} />}
                    </AnimatePresence>
                    {/* Confirm password with show/hide toggle */}
                    <PasswordInput
                      id="r-cp"
                      label="Confirm password"
                      value={rcp}
                      onChange={e => { setRcp(e.target.value); setROk(false); }}
                      autoComplete="new-password"
                    />
                    <FLSelect id="r-role" label="Role" value={rol} onChange={e => setRol(e.target.value)} required options={[{ value: "instructor", label: "Instructor" }, { value: "ta", label: "TA" }]} />
                    <AnimatePresence>
                      {rErr && <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ fontSize: 12, color: T.red, background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", borderRadius: 7, padding: "8px 12px", fontFamily: "Geist Mono, monospace" }}>{rErr}</motion.p>}
                    </AnimatePresence>
                    <motion.button type="submit" disabled={rLoading || rOk} whileTap={{ scale: 0.97 }}
                      style={{ marginTop: 4, height: 50, borderRadius: 10, border: "none", cursor: rLoading ? "wait" : "pointer", background: rOk ? T.emerald : T.cyan, color: T.bg, fontSize: 14, fontWeight: 700, fontFamily: "Geist, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.3s ease", boxShadow: rOk ? `0 0 28px ${T.emeraldGlow}` : `0 0 28px ${T.cyanGlow}`, letterSpacing: "-0.01em" }}>
                      {rLoading ? <LoadingSpinner /> : rOk ? "Request sent" : "Create account"}
                    </motion.button>
                    <p style={{ textAlign: "center", fontSize: 13, color: T.text3, marginTop: 6 }}>
                      Already have an account?{" "}
                      <button type="button" onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: T.cyan, cursor: "pointer", fontSize: 13, fontFamily: "Geist, sans-serif", padding: 0, fontWeight: 500 }}>Login here</button>
                    </p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
              {["Privacy first", "End-to-end encrypted", "Beta access"].map(t => (
                <span key={t} style={{ fontSize: 11, color: T.text3, display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L1.5 3v3.5C1.5 8.9 3.2 10.5 5.5 11c2.3-.5 4-2.1 4-4.5V3L5.5 1z" stroke={T.text3} strokeWidth="1" strokeLinejoin="round" /></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${T.border}`, padding: "clamp(28px,4vw,44px) 0", background: T.bg, position: "relative", zIndex: 10 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(24px,6vw,96px)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 22, height: 22, background: T.cyan, borderRadius: 5, display: "grid", placeItems: "center" }}>
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M6.5 2l4.5 4.5L6.5 11" stroke={T.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text1, letterSpacing: "-0.02em" }}>GradeOps</span>
          <span style={{ fontSize: 11, fontFamily: "Geist Mono, monospace", color: T.text3 }}>© 2025</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {["Privacy"].map(l => (
            <a key={l} href="#" style={{ fontSize: 13, color: T.text3, textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => e.target.style.color = T.text1} onMouseLeave={e => e.target.style.color = T.text3}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  const authRef = useRef();
  const scrollToAuth = () => authRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <Nav onAuth={scrollToAuth} />
      <main>
        <Hero onAuth={scrollToAuth} />
        <Features />
        <div ref={authRef}>
          <AuthSection id="auth" />
        </div>
      </main>
      <Footer />
    </>
  );
}