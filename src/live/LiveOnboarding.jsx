import React from "react";
import { supabase } from "../lib/supabase.js";
import { Disp, Body, Card, Ava, Pill, Btn, Row, Col } from "../components/atoms.jsx";

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
  const [busy, setBusy] = React.useState(false);
  const [answers, setAnswers] = React.useState({});

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
        <Col gap={14} style={{ flex: 1, justifyContent: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🎾</div>
          <Disp size={28}>Ternak Padel</Disp>
          <Body size={14} dim style={{ marginTop: -6 }}>Your padel career starts here. One tap to join — no passwords.</Body>
          <Btn primary full onClick={signInWithGoogle}>{busy ? "Opening Google…" : "Continue with Google"}</Btn>
          <Body size={12} dim style={{ textAlign: "center" }}>We use your Google name and email to set up your profile.</Body>
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
