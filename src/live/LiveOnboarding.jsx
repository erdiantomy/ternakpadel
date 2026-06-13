import React from "react";
import { supabase } from "../lib/supabase.js";
import { Disp, Body, Card, Ava, Pill, Btn, Row, Col } from "../components/atoms.jsx";

// Real onboarding: WhatsApp OTP via Supabase phone auth (delivered by the
// send-otp-whatsapp edge function → Fonnte), then profile setup questions.

const normalizePhone = (raw) => {
  let p = raw.replace(/[\s\-().]/g, "");
  if (p.startsWith("08")) p = "+62" + p.slice(1);
  else if (p.startsWith("62")) p = "+" + p;
  else if (!p.startsWith("+")) p = "+62" + p;
  return p;
};

const initialsOf = (name) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

// A hung auth request must never look like "nothing happening": race it
// against a timeout so the user always gets a visible message.
const withTimeout = (p, ms = 15000) =>
  Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("request timed out — is Supabase phone auth enabled?")), ms)),
  ]);

export function LiveOnboarding({ session, profile, onDone, toast }) {
  // session may already exist (returning user with incomplete profile)
  const [step, setStep] = React.useState(session ? 2 : 0);
  const [name, setName] = React.useState(profile?.full_name || "");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [answers, setAnswers] = React.useState({});
  const otpRef = React.useRef(null);

  const qs = [
    ["Your skill level?", ["Beginner", "Intermediate", "Advanced", "Competitive"], "skill"],
    ["Preferred side?", ["Left", "Right", "Both"], "side"],
    ["How often do you play?", ["Weekly", "Monthly", "Competitive"], "play_freq"],
    ["What are you here for?", ["Social", "Improve skills", "Competitive", "Networking"], "goal"],
  ];

  const sendOtp = async () => {
    if (!name.trim()) return toast("Enter your name first");
    const p = normalizePhone(phone);
    if (!/^\+\d{9,15}$/.test(p)) return toast("Enter a valid WhatsApp number");
    setBusy(true);
    try {
      const { error } = await withTimeout(supabase.auth.signInWithOtp({ phone: p }));
      if (error) { toast(error.message); return; }
      setPhone(p);
      setStep(1);
      setOtp("");
    } catch (e) {
      toast("Couldn't reach server: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (token) => {
    setBusy(true);
    try {
      const { error } = await withTimeout(supabase.auth.verifyOtp({ phone, token, type: "sms" }));
      if (error) { setOtp(""); toast(error.message || "Wrong code — try again"); return; }
      setStep(2);
    } catch (e) {
      setOtp(""); toast("Verification failed: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (step === 1 && otp.length === 6 && !busy) verify(otp);
  }, [otp, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishQuestions = async (finalAnswers) => {
    const { data: { user } } = await supabase.auth.getUser();
    const username = "@" + (name.trim().split(/\s+/)[0] || "player").toLowerCase()
      + Math.floor(100 + Math.random() * 900);
    const { error } = await supabase.from("profiles").update({
      full_name: name.trim() || profile?.full_name || "Player",
      username: profile?.username || username,
      skill: finalAnswers.skill || "Intermediate",
      side: finalAnswers.side || "Left",
      play_freq: finalAnswers.play_freq || null,
      goal: finalAnswers.goal || null,
    }).eq("id", user.id);
    if (error) return toast(error.message);
    setStep(6);
  };

  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
    padding: "13px 14px", fontFamily: "var(--font-body)", fontSize: 14,
    color: "var(--text)", outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100, background: "var(--bg)", display: "flex", flexDirection: "column", padding: "calc(18px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))" }}>
      {step === 0 && (
        <Col gap={12} style={{ flex: 1, justifyContent: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🎾</div>
          <Disp size={28}>Ternak Padel</Disp>
          <Body size={14} dim style={{ marginTop: -6 }}>Your padel career starts here. No passwords — ever.</Body>
          <input style={inputStyle} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={inputStyle} placeholder="WhatsApp number — 08xx or +62" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Btn primary full onClick={sendOtp}>{busy ? "Sending…" : "Continue with WhatsApp"}</Btn>
          <Body size={12} dim style={{ textAlign: "center" }}>We'll send a one-time code to your WhatsApp</Body>
        </Col>
      )}
      {step === 1 && (
        <Col gap={14} style={{ flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center" }}
             onClick={() => otpRef.current?.focus()}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "color-mix(in oklab, var(--success) 20%, var(--surface))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>💬</div>
          <Disp size={21}>Check WhatsApp</Disp>
          <Body size={13} dim style={{ marginTop: -6 }}>Code sent to {phone.slice(0, 6)} •••• {phone.slice(-4)}</Body>
          <div style={{ position: "relative" }}>
            <Row gap={7}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{
                  width: 40, height: 50, borderRadius: 12,
                  border: "1.5px solid " + (otp.length > i ? "var(--accent)" : "var(--line)"),
                  background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text)",
                }}>{otp[i] || ""}</div>
              ))}
            </Row>
            {/* A real, tappable input sits invisibly over the boxes so a direct
                tap opens the keyboard reliably on iOS (programmatic focus does not). */}
            <input ref={otpRef} autoFocus value={otp} inputMode="numeric" autoComplete="one-time-code"
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                opacity: 0, fontSize: 16, border: "none", background: "transparent", cursor: "pointer" }} />
          </div>
          {busy
            ? <Body size={12} dim>Verifying…</Body>
            : <button onClick={sendOtp} style={{ background: "none", border: "none", color: "var(--text2)", fontFamily: "var(--font-body)", fontSize: 12, cursor: "pointer" }}>Didn't get it? Resend code</button>}
        </Col>
      )}
      {step >= 2 && step <= 5 && (() => {
        const [q, opts, key] = qs[step - 2];
        return (
          <Col gap={12} style={{ flex: 1, paddingTop: 16 }}>
            <Row gap={5}>
              {qs.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i <= step - 2 ? "var(--accent)" : "var(--line)" }} />
              ))}
            </Row>
            <Disp size={23} style={{ marginTop: 10 }}>{q}</Disp>
            <Col gap={9} style={{ marginTop: 6 }}>
              {opts.map((o) => (
                <Card key={o} accent={answers[key] === o} onClick={() => {
                  const next = { ...answers, [key]: o };
                  setAnswers(next);
                  setTimeout(() => (step === 5 ? finishQuestions(next) : setStep(step + 1)), 240);
                }}>
                  <Body size={15} bold>{o}</Body>
                </Card>
              ))}
            </Col>
            <button onClick={() => (step === 5 ? finishQuestions(answers) : setStep(step + 1))}
              style={{ marginTop: "auto", background: "none", border: "none", color: "var(--text2)", fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer" }}>Skip</button>
          </Col>
        );
      })()}
      {step === 6 && (
        <Col gap={13} style={{ flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <Ava ini={initialsOf(name || "P")} d={68} ring />
          <Disp size={24}>{name.trim().split(/\s+/)[0] || "Welcome"}</Disp>
          <Row gap={6}>
            <Pill small on>{answers.skill || "Intermediate"}</Pill>
            <Pill small on>{answers.side || "Left"} side</Pill>
          </Row>
          <Card accent style={{ width: "100%", boxSizing: "border-box" }}>
            <Row gap={10}>
              <div style={{ fontSize: 26 }}>🏅</div>
              <Col gap={1} style={{ textAlign: "left" }}>
                <Body size={14} bold>First badge: Rookie</Body>
                <Body size={12} dim>Your padel career starts now. Nothing is deleted — everything accumulates.</Body>
              </Col>
            </Row>
          </Card>
          <Btn primary full onClick={onDone}>Find your first match</Btn>
        </Col>
      )}
    </div>
  );
}
