import React from "react";
import { Disp, Body, Num, Card, Ava, Pill, Btn, Row, Col, SecHead, Spark, Sheet } from "../components/atoms.jsx";
import { CourtBadge } from "../components/BrandMark.jsx";

// Profile / career screen, share-card overlay, create-match sheet, onboarding.

export function ProfileScreen({ S, A }) {
  const me = S.me || { name: "Player", user: "", skill: "", side: "", memberSince: "", initials: "" };
  const badges = S.badges || [];
  const seasons = S.seasons || [];
  return (
    <Col gap={12} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
      <Row gap={12}>
        <Ava ini={me.initials} d={56} ring />
        <Col gap={2} style={{ flex: 1 }}>
          <Disp size={20}>{me.name}</Disp>
          <Body size={12.5} dim>{me.user} · {me.skill} · {me.side} side · member since {me.memberSince}</Body>
        </Col>
        <Btn small ghost onClick={A.openEditProfile}>Edit</Btn>
        <Btn small ghost onClick={A.openSettings}>⚙</Btn>
      </Row>

      {me.bio && <Body size={13} style={{ marginTop: -4 }}>{me.bio}</Body>}
      {(me.instagram || me.reclub_url) && (
        <Row gap={14} style={{ marginTop: -2 }}>
          {me.instagram && <a href={`https://instagram.com/${me.instagram}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>📷 @{me.instagram}</a>}
          {me.reclub_url && <a href={me.reclub_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>🎾 reclub</a>}
        </Row>
      )}

      <Row gap={8}>
        {[["Matches", S.matches], ["Wins", S.wins], ["Win rate", S.winRate + "%"], ["Rank", "#" + S.rank]].map(([l, v]) => (
          <Card key={l} pad={"calc(10px * var(--sp))"} style={{ flex: 1, textAlign: "center" }}>
            <Num size={18}>{v}</Num>
            <Body size={10} dim bold style={{ marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</Body>
          </Card>
        ))}
      </Row>

      <Card>
        <SecHead right="Season 3">Ranking history</SecHead>
        <div style={{ marginTop: 8 }}>
          <Spark vals={S.rankHistory.map((v) => -v)} w={330} h={64} stroke={2.5} style={{ width: "100%", height: 64 }} />
        </div>
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <Body size={11} dim>S1 · #19</Body>
          <Body size={11} dim>S2 · #11</Body>
          <Body size={11} bold color="var(--accent-text)">now · #{S.rank}</Body>
        </Row>
      </Card>

      <SecHead right={S.badgesGot + "/" + badges.length}>Badges</SecHead>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {badges.map((b) => {
          const got = b.got || (b.id === "b4" && S.streak >= 10);
          return (
            <Card key={b.id} pad={10} style={{ minWidth: 86, textAlign: "center", opacity: got ? 1 : 0.45 }} accent={got}>
              <div style={{ fontSize: 22 }}>{got ? b.icon : "🔒"}</div>
              <Body size={11} bold style={{ marginTop: 4 }}>{b.name}</Body>
              {b.sub && <Body size={9.5} dim>{b.sub}</Body>}
            </Card>
          );
        })}
      </div>

      <SecHead>Career timeline</SecHead>
      <Col gap={0}>
        {S.timeline.map((t, i) => (
          <Row key={t.id} gap={11} style={{ alignItems: "flex-start", position: "relative", paddingBottom: i === S.timeline.length - 1 ? 0 : 14 }}>
            {i !== S.timeline.length - 1 && <div style={{ position: "absolute", left: 14, top: 30, bottom: 0, width: 2, background: "var(--line)" }} />}
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flex: "0 0 30px", zIndex: 1,
              background: t.kind === "W" ? "color-mix(in oklab, var(--success) 22%, var(--surface))" : t.kind === "L" ? "color-mix(in oklab, var(--danger) 18%, var(--surface))" : "var(--accent-soft)",
              border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 800,
              color: t.kind === "W" ? "var(--success)" : t.kind === "L" ? "var(--danger)" : "var(--accent-text)",
            }}>{t.kind === "badge" ? "🏅" : t.kind === "rank" ? "↑" : t.kind}</div>
            <Col gap={1} style={{ flex: 1 }}>
              <Body size={13.5} bold>{t.title}</Body>
              <Body size={11.5} dim>{t.sub}</Body>
            </Col>
            {t.pts && <Body size={12} bold color="var(--accent-text)">{t.pts}</Body>}
          </Row>
        ))}
      </Col>

      <SecHead>Seasons</SecHead>
      <Row gap={7}>
        {seasons.map((s) => <Pill key={s.id} small on={s.now}>{s.name} · {s.now ? "#" + S.rank : s.rank}</Pill>)}
      </Row>
      <Body size={11.5} dim style={{ textAlign: "center", marginTop: 4 }}>Nothing is deleted. Everything accumulates.</Body>
    </Col>
  );
}

// ---------- Share card overlay ----------

export function ShareOverlay({ S, A }) {
  if (!S.share) return null;
  const victory = S.share === "victory";
  return (
    <div onClick={A.closeShare} style={{
      position: "absolute", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.72)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      animation: "tpFade .18s", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 230, aspectRatio: "9/16", borderRadius: 18, overflow: "hidden",
        background: "linear-gradient(160deg, #18181b 0%, #09090b 60%)",
        border: "1px solid #2b2b2b", position: "relative",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 18, animation: "tpPop .3s cubic-bezier(.2,1.3,.4,1)", boxSizing: "border-box",
      }}>
        <div style={{ position: "absolute", right: -44, top: -44, width: 150, height: 150, borderRadius: "50%", background: "var(--accent)", opacity: 0.22 }} />
        <div style={{ position: "absolute", left: -30, bottom: 60, width: 90, height: 90, borderRadius: "50%", border: "2px solid var(--accent)", opacity: 0.25 }} />
        <Row style={{ justifyContent: "space-between", position: "relative" }}>
          <Body size={10} bold color="#a3a3a3" style={{ letterSpacing: "0.14em" }}>TERNAK PADEL</Body>
          <Body size={10} color="#71717a">SEASON 3</Body>
        </Row>
        {victory ? (
          <Col gap={6} style={{ position: "relative" }}>
            <Body size={11} bold color="var(--accent)" style={{ letterSpacing: "0.12em" }}>VICTORY</Body>
            <Num size={46} color="#fff">{S.matchResult ? S.matchResult.a + "–" + S.matchResult.b : "6–3"}</Num>
            <Body size={12} color="#a3a3a3">{S.shareLine || "Tomy / Dina def. Andre / Sari"}</Body>
            <Body size={11} color="#71717a">{S.shareSub || "Friday Night Americano · +12 pts"}</Body>
          </Col>
        ) : (
          <Col gap={6} style={{ position: "relative" }}>
            <Body size={11} bold color="var(--accent)" style={{ letterSpacing: "0.12em" }}>RANK UP</Body>
            <Num size={52} color="#fff">#{S.rank}</Num>
            <Body size={12} color="#a3a3a3">{S.rankDelta > 0 ? "↑" + S.rankDelta + " this week · " : ""}Win rate {S.winRate}% · W{S.streak} streak</Body>
          </Col>
        )}
        <Row style={{ justifyContent: "space-between", position: "relative" }}>
          <Body size={11} bold color="#fff">{(S.me && S.me.user) || "@tomy"}</Body>
          <Body size={10} color="#71717a">ternakpadel.xyz</Body>
        </Row>
      </div>
      <Row gap={8}>
        {["Instagram Story", "WhatsApp Status"].map((m) => (
          <Btn key={m} small primary={m === "Instagram Story"} ghost={m !== "Instagram Story"}
            onClick={(e) => { e.stopPropagation(); A.toast("Shared to " + m + " ✓"); A.closeShare(); }}>{m}</Btn>
        ))}
      </Row>
      <Body size={12} color="#a3a3a3">Tap outside to close</Body>
    </div>
  );
}

// ---------- Create match sheet (FAB) ----------

export function CreateSheet({ S, A }) {
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState("Americano");
  const [courts, setCourts] = React.useState(4);
  const [max, setMax] = React.useState(16);
  const [when, setWhen] = React.useState("");
  const formats = ["Americano", "Mexicano", "KOTH", "Knockout", "League", "Mixicano"];
  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
    padding: "12px 14px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none",
    colorScheme: "dark light",
  };
  return (
    <Sheet open={S.creating} onClose={() => A.setCreating(false)} title="Create match">
      <Col gap={12}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name — e.g. Sunday Mexicano"
          style={inputStyle} />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={inputStyle} />
        <Body size={12} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: -6 }}>Format</Body>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {formats.map((f) => <Pill key={f} small on={format === f} onClick={() => setFormat(f)}>{f}</Pill>)}
        </div>
        <Row gap={8}>
          {[["Courts", courts, setCourts, 1, 8], ["Max players", max, setMax, 4, 32]].map(([l, v, set, lo, hi]) => (
            <Card key={l} pad={10} style={{ flex: 1 }}>
              <Body size={11} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</Body>
              <Row style={{ justifyContent: "space-between", marginTop: 6 }}>
                <Btn small ghost onClick={() => set(Math.max(lo, v - 1))}>−</Btn>
                <Num size={18}>{v}</Num>
                <Btn small ghost onClick={() => set(Math.min(hi, v + 1))}>+</Btn>
              </Row>
            </Card>
          ))}
        </Row>
        <Body size={11.5} dim>Smart matchmaking will balance pairings by ranking, partner history and social mixing.</Body>
        <Btn primary full onClick={() => A.createEvent(name || ("New " + format), format, courts, max, when)}>Create & open registration</Btn>
      </Col>
    </Sheet>
  );
}

// ---------- Edit profile (bio, Instagram, reclub link) ----------

export function EditProfileSheet({ open, S, A }) {
  const me = S.me || {};
  const [fullName, setFullName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [reclub, setReclub] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) { setFullName(me.name || ""); setBio(me.bio || ""); setInstagram(me.instagram || ""); setReclub(me.reclub_url || ""); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const inputStyle = {
    background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
    padding: "12px 14px", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, outline: "none",
    width: "100%", boxSizing: "border-box",
  };
  const syncReclub = async () => {
    if (!reclub.trim()) return A.toast("Paste your reclub link or @handle first");
    setBusy(true);
    const d = await A.syncReclubPlayer(reclub.trim());
    setBusy(false);
    if (d) { if (d.name) setFullName(d.name); if (d.reclub_url) setReclub(d.reclub_url); }
  };
  return (
    <Sheet open={open} onClose={A.closeEditProfile} title="Edit profile">
      <Col gap={12}>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Name" style={inputStyle} />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280}
          placeholder="Short bio — your padel story (max 280)"
          style={{ ...inputStyle, minHeight: 76, resize: "vertical", fontFamily: "var(--font-body)" }} />
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram @handle" style={inputStyle} />
        <Col gap={6}>
          <Body size={11} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>reclub profile</Body>
          <Row gap={8}>
            <input value={reclub} onChange={(e) => setReclub(e.target.value)} placeholder="reclub.co/players/@handle" style={{ ...inputStyle, flex: 1 }} />
            <Btn small ghost onClick={syncReclub}>{busy ? "…" : "Sync"}</Btn>
          </Row>
          <Body size={11} dim>Syncs your public name &amp; handle from reclub and links your profile.</Body>
        </Col>
        <Btn primary full onClick={() => A.saveProfile({ full_name: fullName, bio, instagram, reclub_url: reclub })}>Save profile</Btn>
      </Col>
    </Sheet>
  );
}

// ---------- Onboarding ----------

export function Onboarding({ A }) {
  const [step, setStep] = React.useState(0); // 0 register, 1 otp, 2-5 questions, 6 done
  const [otp, setOtp] = React.useState("");
  const [answers, setAnswers] = React.useState({});
  React.useEffect(() => {
    if (step === 1 && otp.length < 4) {
      const id = setTimeout(() => setOtp(otp + "4719"[otp.length]), 420);
      return () => clearTimeout(id);
    }
    if (step === 1 && otp.length === 4) {
      const id = setTimeout(() => setStep(2), 500);
      return () => clearTimeout(id);
    }
  }, [step, otp]);
  const qs = [
    ["Your skill level?", ["Beginner", "Intermediate", "Advanced", "Competitive"], "skill"],
    ["Preferred side?", ["Left", "Right", "Both"], "side"],
    ["How often do you play?", ["Weekly", "Monthly", "Competitive"], "freq"],
    ["What are you here for?", ["Social", "Improve skills", "Competitive", "Networking"], "goal"],
  ];
  const field = (ph, val) => (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
      padding: "13px 14px", fontFamily: "var(--font-body)", fontSize: 14,
      color: val ? "var(--text)" : "var(--text2)",
    }}>{val || ph}</div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100, background: "var(--bg)", display: "flex", flexDirection: "column", padding: "calc(18px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))" }}>
      {step === 0 && (
        <Col gap={12} style={{ flex: 1, justifyContent: "center" }}>
          <CourtBadge size={46} />
          <Disp size={28}>Ternak Padel</Disp>
          <Body size={14} dim style={{ marginTop: -6 }}>Your padel career starts here. No passwords — ever.</Body>
          {field("Full name", "Tomy Santoso")}
          {field("WhatsApp number", "+62 812 9000 4123")}
          {field("Email", "tomy@tomspadel.com")}
          <Btn primary full onClick={() => setStep(1)}>Continue with WhatsApp</Btn>
          <Body size={12} dim style={{ textAlign: "center" }}>We'll send a one-time code to your WhatsApp</Body>
        </Col>
      )}
      {step === 1 && (
        <Col gap={14} style={{ flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "color-mix(in oklab, var(--success) 20%, var(--surface))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>💬</div>
          <Disp size={21}>Check WhatsApp</Disp>
          <Body size={13} dim style={{ marginTop: -6 }}>Code sent to +62 812 •••• 4123 — auto-filling for the demo</Body>
          <Row gap={9}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{
                width: 46, height: 54, borderRadius: 12,
                border: "1.5px solid " + (otp.length > i ? "var(--accent)" : "var(--line)"),
                background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text)",
              }}>{otp[i] || ""}</div>
            ))}
          </Row>
          <Body size={12} dim>Didn't get it? Resend in 0:24</Body>
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
                  setAnswers({ ...answers, [key]: o });
                  setTimeout(() => setStep(step + 1), 240);
                }}>
                  <Body size={15} bold>{o}</Body>
                </Card>
              ))}
            </Col>
            <button onClick={() => setStep(step + 1)} style={{ marginTop: "auto", background: "none", border: "none", color: "var(--text2)", fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer" }}>Skip</button>
          </Col>
        );
      })()}
      {step === 6 && (
        <Col gap={13} style={{ flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <Ava ini="TS" d={68} ring />
          <Disp size={24}>@tomy</Disp>
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
          <Btn primary full onClick={A.finishOnboarding}>Find your first match</Btn>
        </Col>
      )}
      {step < 6 && (
        <button onClick={A.finishOnboarding} style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top))", right: 18, background: "none", border: "none", color: "var(--text2)", fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer" }}>Skip demo →</button>
      )}
    </div>
  );
}
