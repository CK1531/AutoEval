import { useState, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import T, { EASE_EXPO, SPRING } from "../tokens";
import { MagBtn, FLInput, LoadingSpinner, Dot } from "../components/ui";
import { UserContext } from "../context/UserContext";
import api from "../services/api";

const IconShield = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

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
// ─────────────────────────────────────────────────────────────────────────────

const CALLOUTS = [
];

const TRUST = [
    { icon: <IconShield />, label: "Secure" },
    { icon: <IconShield />, label: "Private" },
    { icon: <IconShield />, label: "Beta" },
];

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

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, login } = useContext(UserContext);
    const registered = location.state?.registered ?? false;

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isNarrow, setIsNarrow] = useState(
        typeof window !== "undefined" && window.innerWidth < 768
    );

    useEffect(() => {
        if (user?.role) navigate(user.role === "instructor" ? "/instructor" : "/ta", { replace: true });
    }, [user, navigate]);

    useEffect(() => {
        const handler = () => setIsNarrow(window.innerWidth < 768);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading || success) return;
        setError("");
        setLoading(true);

        try {
            await api.post('/login/', {
                email: email,
                password: password
            });

            const response = await api.get('/users/me')
            const userData = response.data;

            setSuccess(true);

            login(userData);
            setTimeout(() => {
                navigate(userData.role === "instructor" ? "/instructor" : "/ta");
            }, 6000);
        } catch (err) {
            setError(err.response?.data?.detail || "Login failed");
        } finally {
            setLoading(false);
        }
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
            flex: "0 0 45%",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "clamp(28px, 4vw, 48px)",
            borderRight: `1px solid ${T.border}`,
            overflow: "hidden",
        },
        leftGlow: {
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${T.cyanGlow} 0%, transparent 70%)`,
            pointerEvents: "none",
        },
        leftGlow2: {
            position: "absolute",
            bottom: "-80px",
            right: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)`,
            pointerEvents: "none",
        },
        logoRow: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            position: "relative",
            zIndex: 1,
        },
        logoText: {
            fontFamily: "Geist, sans-serif",
            fontWeight: 700,
            fontSize: "17px",
            color: T.text1,
            letterSpacing: "-0.02em",
        },
        calloutsWrap: {
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "20px",
        },
        calloutLabel: {
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.text3,
            marginBottom: "20px",
        },
        calloutItem: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
        },
        calloutStat: {
            fontFamily: "Geist Mono, monospace",
            fontSize: "clamp(22px, 2.5vw, 30px)",
            fontWeight: 700,
            color: T.text1,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            minWidth: "80px",
        },
        calloutText: {
            fontSize: "13px",
            color: T.text2,
            lineHeight: 1.4,
        },

        right: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(24px, 4vw, 48px)",
            backgroundColor: T.surface,
        },

        card: {
            width: "100%",
            maxWidth: "420px",
            display: "flex",
            flexDirection: "column",
            gap: "0px",
        },
        cardLogoRow: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "32px",
        },
        cardLogoText: {
            fontFamily: "Geist, sans-serif",
            fontWeight: 700,
            fontSize: "16px",
            color: T.text1,
            letterSpacing: "-0.02em",
        },
        heading: {
            fontFamily: "Geist, sans-serif",
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
            marginBottom: "36px",
            lineHeight: 1.5,
        },
        fieldsWrap: {
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            marginBottom: "8px",
        },
        forgotRow: {
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "28px",
            marginTop: "4px",
        },
        forgotLink: {
            fontSize: "12px",
            color: T.text3,
            cursor: "pointer",
            textDecoration: "none",
            transition: "color 0.2s",
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "Geist, sans-serif",
        },
        dividerWrap: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "24px 0",
        },
        dividerLine: {
            flex: 1,
            height: "1px",
            backgroundColor: T.border,
        },
        dividerText: {
            fontSize: "12px",
            color: T.text3,
            fontFamily: "Geist Mono, monospace",
        },
        registerRow: {
            textAlign: "center",
            fontSize: "13px",
            color: T.text2,
            marginBottom: "32px",
        },
        registerLink: {
            color: T.cyan,
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "Geist, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
        },
        trustRow: {
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            paddingTop: "20px",
            borderTop: `1px solid ${T.border}`,
        },
        trustItem: {
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: T.text3,
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.04em",
        },
        errorBox: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "10px",
            backgroundColor: "rgba(248,113,113,0.08)",
            border: `1px solid rgba(248,113,113,0.22)`,
            color: T.red,
            fontSize: "13px",
            fontFamily: "Geist, sans-serif",
            marginBottom: "16px",
        },
        successBtn: {
            backgroundColor: T.emerald,
            color: T.bg,
        },
    };

    return (
        <div style={S.root}>

            {!isNarrow && (
                <div style={S.left}>
                    <div style={S.leftGlow} />
                    <div style={S.leftGlow2} />

                    <motion.div
                        style={S.logoRow}
                        variants={fadeUp(0.2)}
                        initial="hidden"
                        animate="visible"
                    >
                        <IconLogo />
                        <span style={S.logoText}>GradeOps</span>
                    </motion.div>

                    <div style={S.calloutsWrap}>
                        <motion.p
                            style={S.calloutLabel}
                            variants={fadeUp(0.35)}
                            initial="hidden"
                            animate="visible"
                        >
                        
                        </motion.p>

                        {CALLOUTS.map((c, i) => (
                            <motion.div
                                key={c.stat}
                                style={S.calloutItem}
                                variants={fadeUp(0.4 + i * 0.15)}
                                initial="hidden"
                                animate="visible"
                            >
                                <Dot color={T.cyan} />
                                <span style={S.calloutStat}>{c.stat}</span>
                                <span style={S.calloutText}>{c.label}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            <div style={S.right}>
                <motion.div
                    style={S.card}
                    variants={fadeUp(0.3)}
                    initial="hidden"
                    animate="visible"
                >
                    <div style={S.cardLogoRow}>
                        <IconLogo />
                        <span style={S.cardLogoText}>GradeOps</span>
                    </div>

                    <AnimatePresence>
                        {registered && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ ...SPRING }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "11px 14px",
                                    borderRadius: "10px",
                                    backgroundColor: T.emeraldDim,
                                    border: `1px solid ${T.emeraldGlow}`,
                                    color: T.emerald,
                                    fontSize: "13px",
                                    marginBottom: "20px",
                                    overflow: "hidden",
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.emerald} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Account created! Sign in to continue.
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <h1 style={S.heading}>Welcome back.</h1>
                    <p style={S.subtext}>Sign in to your grading workspace.</p>

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
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </motion.div>

                            {/* Password field with show/hide toggle */}
                            <motion.div variants={fieldVariant}>
                                <PasswordInput
                                    id="password"
                                    label="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                            </motion.div>
                        </motion.div>

                        <div style={S.forgotRow}>
                            <motion.button
                                type="button"
                                style={S.forgotLink}
                                whileHover={{ color: T.cyan }}
                                onClick={() => { }}
                            >
                                Forgot password?
                            </motion.button>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    key="error"
                                    style={S.errorBox}
                                    initial={{ opacity: 0, y: -6, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: "auto" }}
                                    exit={{ opacity: 0, y: -4, height: 0 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.div
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
                                onClick={handleSubmit}
                            >
                                {loading ? (
                                    <>
                                        <LoadingSpinner />
                                        <span style={{ marginLeft: "8px" }}>Signing in…</span>
                                    </>
                                ) : success ? (
                                    <>
                                        <IconCheck />
                                        <span style={{ marginLeft: "6px" }}>Signed in</span>
                                    </>
                                ) : (
                                    "Sign in"
                                )}
                            </MagBtn>
                        </motion.div>

                    </form>

                    <div style={S.dividerWrap}>
                        <div style={S.dividerLine} />
                        <span style={S.dividerText}>or</span>
                        <div style={S.dividerLine} />
                    </div>

                    <div style={S.registerRow}>
                        New to GradeOps?{" "}
                        <motion.button
                            type="button"
                            style={S.registerLink}
                            whileHover={{ opacity: 0.8 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate("/register")}
                        >
                            Register here
                        </motion.button>
                    </div>

                    <div style={S.trustRow}>
                        {TRUST.map((t) => (
                            <div key={t.label} style={S.trustItem}>
                                {t.icon}
                                <span>{t.label}</span>
                            </div>
                        ))}
                    </div>

                </motion.div>
            </div>

        </div>
    );
}