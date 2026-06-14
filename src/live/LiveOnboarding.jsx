import React from "react";
import { supabase } from "../lib/supabase.js";
import { Disp, Body, Card, Ava, Pill, Btn, Row, Col } from "../components/atoms.jsx";
import { BrandLogo } from "../components/BrandMark.jsx";

// Onboarding: Google sign-in (Supabase OAuth), then profile setup questions.
// After Google redirects back, a session exists and we resume at the questions;
// the player's name comes from their Google account.

const initialsOf = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

const googleName = (session) =>
  session?.user?.user_metadata?.full_name ||
  session?.user?.user_metadata?.name ||
  (session?.user?.email ? session.user.email.split("@")[0] : "");

export function LiveOnboarding({ session, profile, onDone, toast }) {
  // session already exists (returning from Google) → skip straight to questions
  const [step, setStep] = React.useState(session ? 2 : 0);
  const [name, setName] = React.useState(profile?.full_name || googleName(session) || "");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [answers, setAnswers] = React.useState({});

  // text-field styling that follows the brand theme, with a lime focus ring
  const field = {
    width: "100%", boxSizing: "border-box", padding: "13px 15px",
    background: "var(--surface)", border: "1.5px solid var(--line)",
    borderRadius: "var(--radius-sm)", color: "var(--text)",
    fontFamily: "var(--font-body)", fontSize: 15, outline: "none",
    transition: "border-color .15s",
  };
  const focusOn = (e) => { e.target.style.borderColor = "var(--accent)"; };
  const focusOff = (e) => { e.target.style.borderColor = "var(--line)"; };

  // if a session arrives while mounted (OAuth completes), advance + grab the name
  React.useEffect(() => {
    if (session) {
      setName((n) => n || googleName(session) || "");
      setStep((s) => (s === 0 ? 2 : s));
    }
  }, [session]);

  const qs = [
    ["Your skill level?", ["Beginner", "Intermediate", "Advanced", "Competitive"], "skill"],
    ["Preferred side?", ["Left", "Right", "Both"], "side"],
    ["How often do you play?", ["Weekly", "Monthly", "Competitive"], "play_freq"],
    ["What are you here for?", ["Social", "Improve skills", "Competitive", "Networking"], "goal"],
  ];

  const signInWithGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    // on success the browser navigates away to Google; only errors return here
    if (error) { setBusy(false); toast(error.message); }
  };

  // Passwordless email sign-in: we email a one-tap magic link. Works with any
  // mailbox (not just Gmail). The name rides along in user_metadata so the
  // profile is pre-filled when they return via the link.
  const sendMagicLink = async () => {
    const mail = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return toast("Enter a valid email address");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: mail,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
        data: name.trim() ? { full_name: name.trim() } : undefined,
      },
    });
    setBusy(false);
    if (error) return toast(error.message);
    setStep(1); // "check your email"
  };

  const finishQuestions = async (finalAnswers) => {
    const { data: { user } } = await supabase.auth.getUser();
    const base = (name.trim().split(/\s+/)[0] || "player").toLowerCase();
    const username = "@" + base + Math.floor(100 + Math.random() * 900);
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

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100, background: "var(--bg)", display: "flex", flexDirection: "column", padding: "calc(18px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))" }}>
      {step === 0 && (
        <Col gap={12} style={{ flex: 1, justifyContent: "center", alignItems: "stretch", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center" }}><BrandLogo width={268} dark /></div>
          <Col gap={3} style={{ marginTop: 2, marginBottom: 6, alignItems: "center" }}>
            <Body size={15} bold>Built for players who want more.</Body>
            <Body size={14} dim>More matches. More competition. More growth.</Body>
          </Col>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your name" autoComplete="name"
            style={field} onFocus={focusOn} onBlur={focusOff}
          />
          <input
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com" type="email" inputMode="email" autoComplete="email"
            style={field} onFocus={focusOn} onBlur={focusOff}
            onKeyDown={(e) => { if (e.key === "Enter") sendMagicLink(); }}
          />
          <Btn primary full onClick={sendMagicLink}>{busy ? "Sending link…" : "Email me a sign-in link"}</Btn>
          <Body size={12} dim>Works with any email — Gmail, Outlook, Yahoo, your own domain.</Body>
          <Row gap={10} style={{ margin: "2px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <Body size={11} dim>or</Body>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </Row>
          <Btn ghost full onClick={signInWithGoogle}>{busy ? "Opening…" : "Continue with Google"}</Btn>
        </Col>
      )}
      {step === 1 && (
        <Col gap={13} style={{ flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 46 }}>📧</div>
          <Disp size={24}>Check your email</Disp>
          <Body size={14} dim>
            We sent a sign-in link to <span style={{ color: "var(--text)", fontWeight: 700 }}>{email}</span>.
            Open it on this device to finish signing in.
          </Body>
          <Body size={12.5} dim style={{ marginTop: 2 }}>Didn’t get it? Check spam — or send it again.</Body>
          <Row gap={8} style={{ marginTop: 6 }}>
            <Btn ghost onClick={() => setStep(0)}>Change email</Btn>
            <Btn primary onClick={sendMagicLink}>{busy ? "Sending…" : "Resend link"}</Btn>
          </Row>
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
