import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import T, { SPRING } from "../tokens";
import { MagBtn, FLInput, FLSelect, LoadingSpinner, Dot } from "../components/ui";
import { UserContext } from "../context/UserContext";
import api from "../services/api";

const IconLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="4" fill={T.cyan} />
    <path d="M8 12h8M12 8l4 4-4 4" stroke={T.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Eye icon for show/hide password ─────────────────────────────────────────
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

const PIPELINE_STEPS = [
  { label: "Upload", sub: "Bulk PDF ingestion & rubric JSON", color: T.cyan },
  { label: "OCR", sub: "Vision model handwriting extraction", color: T.emerald },
  { label: "AI Grade", sub: "Agentic LLM partial-credit scoring", color: T.cyan },
  { label: "TA Review", sub: "Human-in-the-loop override queue", color: T.emerald },
];

const ROLE_OPTIONS = [
  { value: "instructor", label: "Instructor" },
  { value: "ta", label: "Teaching Assistant (TA)" },
];

function getStrength(pw) {
  if (!pw) return { level: 0, label: "", color: T.border };
  if (pw.length < 6) return { level: 1, label: "Weak", color: T.red };
  if (pw.length < 10) return { level: 2, label: "Fair", color: "#f59e0b" };
  if (pw.length < 14) return { level: 3, label: "Strong", color: T.cyan };
  return { level: 4, label: "Very strong", color: T.emerald };
}

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { ...SPRING, delay } },
});

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fieldVariant = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { ...SPRING } },
};

const stepVariant = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { ...SPRING } },
};

const staggerSteps = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
};

const fieldErrorVariant = {
  hidden: { opacity: 0, y: -6, height: 0 },
  visible: { opacity: 1, y: 0, height: "auto" },
  exit: { opacity: 0, y: -4, height: 0, transition: { duration: 0.14 } },
};

export default function Register() {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState("");
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  const [errors, setErrors] = useState({
    email: "", password: "", confirm: "", role: "",
  });

  useEffect(() => {
    if (user?.role) navigate(user.role === "instructor" ? "/instructor" : "/ta", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const handler = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const strength = getStrength(password);

  const validate = () => {
    const e = { email: "", password: "", confirm: "", role: "" };
    let ok = true;

    if (!email.includes("@")) {
      e.email = "Enter a valid email address."; ok = false;
    }
    if (password.length < 6) {
      e.password = "Password must be at least 6 characters."; ok = false;
    }
    if (password !== confirm) {
      e.confirm = "Passwords do not match."; ok = false;
    }
    if (!role) {
      e.role = "Please select a role."; ok = false;
    }

    setErrors(e);
    return ok;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || success) return;
    setApiError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post('/register/', {
        email,
        password,
        role,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/login", { state: { registered: true } });
      }, 600);
    } catch (err) {
      setApiError(err.response?.data?.detail || "Registration failed");
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const field = (setter, key) => (e) => {
    setter(e.target.value);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const S = {
    root: {
      display: "flex",
      minHeight: "100dvh",
      backgroundColor: T.bg,
      fontFamily: "Geist, sans-serif",
      overflow: "hidden",
    },

    left: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "clamp(24px, 4vw, 48px)",
      backgroundColor: T.surface,
      overflowY: "auto",
    },

    card: {
      width: "100%",
      maxWidth: "420px",
      display: "flex",
      flexDirection: "column",
      paddingTop: "clamp(16px, 3vw, 32px)",
      paddingBottom: "clamp(16px, 3vw, 32px)",
    },

    cardLogoRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "28px",
    },
    cardLogoText: {
      fontWeight: 700,
      fontSize: "16px",
      color: T.text1,
      letterSpacing: "-0.02em",
    },
    heading: {
      fontWeight: 900,
      fontSize: "clamp(28px, 4vw, 36px)",
      color: T.text1,
      letterSpacing: "-0.04em",
      lineHeight: 1.1,
      marginBottom: "8px",
    },
    subtext: {
      fontSize: "14px",
      color: T.text2,
      marginBottom: "32px",
      lineHeight: 1.5,
    },

    fieldsWrap: {
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      marginBottom: "24px",
    },

    strengthWrap: {
      marginTop: "8px",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
    },
    strengthTrack: {
      display: "flex",
      gap: "4px",
      height: "3px",
    },
    strengthLabel: {
      fontSize: "11px",
      fontFamily: "Geist Mono, monospace",
      letterSpacing: "0.06em",
      color: T.text3,
      transition: "color 0.3s",
    },

    fieldError: {
      fontSize: "12px",
      color: T.red,
      marginTop: "5px",
      fontFamily: "Geist, sans-serif",
      overflow: "hidden",
    },

    apiErrorBox: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "12px 14px",
      borderRadius: "10px",
      backgroundColor: "rgba(248,113,113,0.08)",
      border: `1px solid rgba(248,113,113,0.22)`,
      color: T.red,
      fontSize: "13px",
      marginBottom: "16px",
      overflow: "hidden",
    },

    signInRow: {
      textAlign: "center",
      fontSize: "13px",
      color: T.text2,
      marginTop: "24px",
    },
    signInLink: {
      color: T.cyan,
      cursor: "pointer",
      background: "none",
      border: "none",
      padding: 0,
      fontFamily: "Geist, sans-serif",
      fontSize: "13px",
      fontWeight: 600,
    },

    right: {
      flex: "0 0 45%",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "clamp(28px, 4vw, 64px)",
      borderLeft: `1px solid ${T.border}`,
      overflow: "hidden",
    },
    rightGlow: {
      position: "absolute",
      top: "40%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "400px",
      height: "400px",
      borderRadius: "50%",
      background: `radial-gradient(circle, ${T.emeraldGlow} 0%, transparent 70%)`,
      pointerEvents: "none",
    },
    rightGlow2: {
      position: "absolute",
      top: "-60px",
      left: "-60px",
      width: "260px",
      height: "260px",
      borderRadius: "50%",
      background: `radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)`,
      pointerEvents: "none",
    },
    panelLabel: {
      fontSize: "11px",
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: T.text3,
      marginBottom: "36px",
      position: "relative",
      zIndex: 1,
    },

    pipelineWrap: {
      position: "relative",
      zIndex: 1,
      display: "flex",
      flexDirection: "column",
    },
    stepRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: "16px",
      position: "relative",
    },
    stepLeft: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: "14px",
      flexShrink: 0,
      paddingTop: "2px",
    },
    stepLine: {
      width: "1px",
      flex: 1,
      minHeight: "36px",
      backgroundColor: T.border,
      margin: "6px 0",
    },
    stepContent: {
      paddingBottom: "32px",
      flex: 1,
    },
    stepLabel: {
      fontWeight: 700,
      fontSize: "15px",
      color: T.text1,
      letterSpacing: "-0.02em",
      marginBottom: "4px",
    },
    stepSub: {
      fontSize: "12.5px",
      color: T.text2,
      lineHeight: 1.5,
    },
  };

  const StrengthBar = () => (
    <div style={S.strengthWrap}>
      <div style={S.strengthTrack}>
        {[1, 2, 3, 4].map((seg) => (
          <motion.div
            key={seg}
            style={{ flex: 1, borderRadius: "2px", backgroundColor: T.border }}
            animate={{
              backgroundColor: seg <= strength.level ? strength.color : T.border,
            }}
            transition={{ duration: 0.25 }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        {strength.label && (
          <motion.span
            key={strength.label}
            style={{ ...S.strengthLabel, color: strength.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {strength.label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );

  const FieldError = ({ msg }) => (
    <AnimatePresence>
      {msg && (
        <motion.div
          style={S.fieldError}
          variants={fieldErrorVariant}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div style={S.root}>

      <div style={S.left}>
        <motion.div
          style={S.card}
          variants={fadeUp(0.2)}
          initial="hidden"
          animate="visible"
        >
          <div style={S.cardLogoRow}>
            <IconLogo />
            <span style={S.cardLogoText}>GradeOps</span>
          </div>

          <h1 style={S.heading}>Join GradeOps.</h1>
          <p style={S.subtext}>Create your account to access the grading pipeline.</p>

          <form onSubmit={handleSubmit} noValidate>

            <motion.div
              style={S.fieldsWrap}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >

              <motion.div variants={fieldVariant}>
                <FLInput
                  id="email"
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={field(setEmail, "email")}
                  required
                  autoComplete="email"
                />
                <FieldError msg={errors.email} />
              </motion.div>

              {/* Password field with show/hide toggle */}
              <motion.div variants={fieldVariant}>
                <PasswordInput
                  id="password"
                  label="Password"
                  value={password}
                  onChange={field(setPassword, "password")}
                  autoComplete="new-password"
                />
                <StrengthBar />
                <FieldError msg={errors.password} />
              </motion.div>

              {/* Confirm password field with show/hide toggle */}
              <motion.div variants={fieldVariant}>
                <PasswordInput
                  id="confirm"
                  label="Confirm Password"
                  value={confirm}
                  onChange={field(setConfirm, "confirm")}
                  autoComplete="new-password"
                />
                <FieldError msg={errors.confirm} />
              </motion.div>

              <motion.div variants={fieldVariant}>
                <FLSelect
                  id="role"
                  label="Role"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    if (errors.role) setErrors((prev) => ({ ...prev, role: "" }));
                  }}
                  required
                  options={ROLE_OPTIONS}
                />
                <FieldError msg={errors.role} />
              </motion.div>

            </motion.div>

            <AnimatePresence>
              {apiError && (
                <motion.div
                  style={S.apiErrorBox}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {apiError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              style={{ marginTop: "8px" }}
              animate={success ? { scale: [1, 0.97, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <MagBtn
                type="submit"
                variant={success ? "ghost" : "primary"}
                size="lg"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  ...(success ? {
                    backgroundColor: T.emeraldDim,
                    border: `1px solid ${T.emerald}`,
                    color: T.emerald,
                  } : {}),
                }}
              >
                {loading ? (
                  <>
                    <LoadingSpinner />
                    <span style={{ marginLeft: "8px" }}>Creating account…</span>
                  </>
                ) : success ? (
                  <>
                    <IconCheck />
                    <span style={{ marginLeft: "6px" }}>Account created!</span>
                  </>
                ) : (
                  "Create account"
                )}
              </MagBtn>
            </motion.div>

          </form>

          <div style={S.signInRow}>
            Already have an account?{" "}
            <motion.button
              type="button"
              style={S.signInLink}
              whileHover={{ opacity: 0.8 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/login")}
            >
              Sign in
            </motion.button>
          </div>

        </motion.div>
      </div>

      {!isNarrow && (
        <div style={S.right}>
          <div style={S.rightGlow} />
          <div style={S.rightGlow2} />

          <motion.p
            style={S.panelLabel}
            variants={fadeUp(0.2)}
            initial="hidden"
            animate="visible"
          >
            How it works
          </motion.p>

          <motion.div
            style={S.pipelineWrap}
            variants={staggerSteps}
            initial="hidden"
            animate="visible"
          >
            {PIPELINE_STEPS.map((step, i) => (
              <motion.div key={step.label} style={S.stepRow} variants={stepVariant}>
                <div style={S.stepLeft}>
                  <Dot color={step.color} />
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div style={S.stepLine} />
                  )}
                </div>

                <div style={S.stepContent}>
                  <div style={S.stepLabel}>{step.label}</div>
                  <div style={S.stepSub}>{step.sub}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

    </div>
  );
}