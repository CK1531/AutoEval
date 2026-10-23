import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import T, { EASE_EXPO, SPRING } from "../tokens";

export function Dot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 7, height: 7, flexShrink: 0 }}>
      <motion.span
        animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }}
      />
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  );
}

export function Arrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MagBtn({ children, onClick, variant = "primary", size = "md", type = "button", style }) {
  const ref = useRef();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - r.left - r.width / 2) * 0.22,
      y: (e.clientY - r.top - r.height / 2) * 0.22,
    });
  };
  const onLeave = () => setPos({ x: 0, y: 0 });

  const pad = size === "lg" ? "11px 28px" : "7px 16px";
  const fs = size === "lg" ? 15 : 13;

  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: pad, borderRadius: 8, cursor: "pointer",
    fontSize: fs, fontWeight: 600, fontFamily: "Geist, sans-serif",
    letterSpacing: "-0.01em", outline: "none", border: "none", whiteSpace: "nowrap",
  };

  const vs = {
    primary: { ...base, background: T.cyan, color: T.bg, boxShadow: `0 0 22px ${T.cyanGlow}` },
    ghost: { ...base, background: "transparent", color: T.text2, border: `1px solid ${T.border}` },
    white: { ...base, background: "rgba(255,255,255,0.07)", color: T.text1, border: `1px solid ${T.borderMid}` },
    danger: { ...base, background: "rgba(248,113,113,0.12)", color: T.red, border: `1px solid rgba(248,113,113,0.2)` },
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      style={{ ...vs[variant], ...style, x: pos.x, y: pos.y }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.12 }}
    >
      {children}
    </motion.button>
  );
}

export function LoadingSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
      style={{ width: 16, height: 16, border: `2px solid rgba(6,8,10,0.3)`, borderTopColor: T.bg, borderRadius: "50%" }}
    />
  );
}

export function FLInput({ id, label, type = "text", value, onChange, required, autoComplete }) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div style={{ position: "relative" }}>
      <motion.label
        htmlFor={id}
        animate={{
          top: lifted ? 9 : "50%",
          y: lifted ? 0 : "-50%",
          fontSize: lifted ? 10 : 14,
          color: focused ? T.cyan : T.text3,
          letterSpacing: lifted ? "0.07em" : "0",
        }}
        transition={{ duration: 0.18, ease: EASE_EXPO }}
        style={{
          position: "absolute", left: 14, pointerEvents: "none",
          fontFamily: lifted ? "Geist Mono, monospace" : "Geist, sans-serif",
          zIndex: 1,
        }}
      >
        {label}
      </motion.label>
      <input
        id={id} type={type} value={value} onChange={onChange}
        required={required} autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 56,
          background: "rgba(255,255,255,0.035)",
          border: `1px solid ${focused ? T.cyan : T.border}`,
          borderRadius: 10,
          padding: lifted ? "18px 14px 6px" : "0 14px",
          fontSize: 14, color: T.text1, outline: "none",
          fontFamily: "Geist, sans-serif",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease",
          boxShadow: focused
            ? `0 0 0 3px ${T.cyanDim}, inset 0 1px 0 rgba(255,255,255,0.04)`
            : "inset 0 1px 0 rgba(255,255,255,0.02)",
        }}
      />
    </div>
  );
}

export function FLSelect({ id, label, value, onChange, required, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const lifted = open || value.length > 0;
  const selected = options.find((o) => o.value === value);

  const handleOutside = (e) => {
    if (ref.current && !ref.current.contains(e.target)) setOpen(false);
  };

  useState(() => {
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  });

  const pick = (o) => {
    onChange({ target: { value: o.value } });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", zIndex: open ? 20 : 1 }}>
      <motion.label
        htmlFor={id}
        animate={{
          top: lifted ? 9 : "50%",
          y: lifted ? 0 : "-50%",
          fontSize: lifted ? 10 : 14,
          color: open ? T.cyan : T.text3,
          letterSpacing: lifted ? "0.07em" : "0",
        }}
        transition={{ duration: 0.18, ease: EASE_EXPO }}
        style={{
          position: "absolute", left: 14, pointerEvents: "none",
          fontFamily: lifted ? "Geist Mono, monospace" : "Geist, sans-serif",
          zIndex: 2,
        }}
      >
        {label}
      </motion.label>

      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", height: 56, cursor: "pointer", textAlign: "left",
          background: "rgba(255,255,255,0.035)",
          border: `1px solid ${open ? T.cyan : T.border}`,
          borderRadius: open ? "10px 10px 0 0" : 10,
          padding: lifted ? "18px 36px 6px 14px" : "0 36px 0 14px",
          fontSize: 14, color: T.text1, outline: "none",
          fontFamily: "Geist, sans-serif",
          transition: "border-color 0.18s ease, box-shadow 0.18s ease, border-radius 0.12s ease",
          boxShadow: open
            ? `0 0 0 3px ${T.cyanDim}, inset 0 1px 0 rgba(255,255,255,0.04)`
            : "inset 0 1px 0 rgba(255,255,255,0.02)",
        }}
      >
        {selected?.label ?? ""}
      </button>

      <motion.svg
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.2, ease: EASE_EXPO }}
        style={{ position: "absolute", right: 14, top: "50%", translateY: "-50%", pointerEvents: "none", opacity: 0.5 }}
        width="14" height="14" viewBox="0 0 14 14" fill="none"
      >
        <path d="M3 5l4 4 4-4" stroke={T.text2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: EASE_EXPO }}
            style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: "#0e1318",
              border: `1px solid ${T.cyan}`,
              borderTop: `1px solid rgba(34,211,238,0.25)`,
              borderRadius: "0 0 10px 10px",
              overflow: "hidden",
              boxShadow: `0 16px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,211,238,0.08)`,
            }}
          >
            {options.map((o, i) => (
              <motion.button
                key={o.value}
                type="button"
                onClick={() => pick(o)}
                whileHover={{ background: "rgba(34,211,238,0.08)" }}
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer",
                  padding: "13px 14px",
                  fontSize: 14, fontFamily: "Geist, sans-serif",
                  color: value === o.value ? T.cyan : T.text1,
                  background: value === o.value ? "rgba(34,211,238,0.06)" : "transparent",
                  border: "none", outline: "none",
                  borderTop: i > 0 ? `1px solid rgba(255,255,255,0.05)` : "none",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "background 0.12s ease",
                }}
              >
                {o.label}
                {value === o.value && (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2.5 6.5l3 3 5-5" stroke={T.cyan} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}