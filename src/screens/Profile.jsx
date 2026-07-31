import React from "react";
import { Disp, Body, Num, Card, Ava, Pill, Btn, Row, Col, SecHead, Spark, Sheet, Input, MicroLabel, StatTile, Icon } from "../components/atoms.jsx";

// Profile / career screen, share-card overlay, create-match sheet.

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
        <Btn small ghost ariaLabel="Settings" onClick={A.openSettings}><Icon name="settings" size={16} /></Btn>
      </Row>

      {me.bio && <Body size={13} style={{ marginTop: -4 }}>{me.bio}</Body>}
      {me.instagram && (
        <Row gap={14} style={{ marginTop: -2 }}>
          <a href={`https://instagram.com/${me.instagram}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)", fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="camera" size={13} /> @{me.instagram}</a>
        </Row>
      )}

      <Row gap={8}>
        {[["Matches", S.matches], ["Wins", S.wins], ["Win rate", S.winRate + "%"], ["Rank", "#" + S.rank]].map(([l, v]) => (
          <StatTile key={l} label={l} value={v} size={18} center />
        ))}
      </Row>

      <Card>
        <SecHead right={(seasons.find((s) => s.now) || {}).name}>Ranking history</SecHead>
        <div style={{ marginTop: 8 }}>
          <Spark vals={S.rankHistory.map((v) => -v)} w={330} h={64} stroke={2.5} style={{ width: "100%", height: 64 }} />
        </div>
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <Body size={11} dim>start · #{S.rankHistory[0]}</Body>
          <Body size={11} bold color="var(--accent-text)">now · #{S.rank}</Body>
        </Row>
      </Card>

      <SecHead right={S.badgesGot + "/" + badges.length}>Badges</SecHead>
      {badges.length === 0 && (
        <Body size={12.5} dim>Badges you earn appear here — your first session unlocks Rookie.</Body>
      )}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {badges.map((b) => {
          const got = b.got || (b.id === "b4" && S.streak >= 10);
          return (
            <Card key={b.id} pad={10} style={{ minWidth: 86, textAlign: "center", opacity: got ? 1 : 0.45 }} accent={got}>
              <div style={{ fontSize: 22, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)" }}>{got ? b.icon : <Icon name="lock" size={19} />}</div>
              <Body size={11} bold style={{ marginTop: 4 }}>{b.name}</Body>
              {b.sub && <Body size={9.5} dim>{b.sub}</Body>}
            </Card>
          );
        })}
      </div>

      <SecHead>Career timeline</SecHead>
      {S.timeline.length === 0 && (
        <Body size={12.5} dim>Every match, badge and rank move lands here — nothing resets, everything accumulates.</Body>
      )}
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

      {seasons.length > 0 && (
        <React.Fragment>
          <SecHead>Seasons</SecHead>
          <Row gap={7} style={{ flexWrap: "wrap" }}>
            {seasons.map((s) => <Pill key={s.id} small on={s.now}>{s.name}{s.now ? " · #" + S.rank : ""}</Pill>)}
          </Row>
        </React.Fragment>
      )}
      <Body size={11.5} dim style={{ textAlign: "center", marginTop: 4 }}>Nothing is deleted. Everything accumulates.</Body>
    </Col>
  );
}

// ---------- Share card overlay ----------

export function ShareOverlay({ S, A }) {
  if (!S.share) return null;
  const victory = S.share === "victory";
  const season = (S.seasons || []).find((s) => s.now);
  const score = S.matchResult ? S.matchResult.a + "–" + S.matchResult.b : "";
  const caption = victory
    ? ["Victory " + score, S.shareLine, S.shareSub, "ternakpadel.xyz"].filter(Boolean).join(" · ")
    : ["Rank #" + S.rank, "Win rate " + S.winRate + "%", S.streak > 0 ? "W" + S.streak + " streak" : "", "ternakpadel.xyz"].filter(Boolean).join(" · ");
  const doShare = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.share) { await navigator.share({ text: caption }); A.closeShare(); }
      else { await navigator.clipboard.writeText(caption); A.toast("Caption copied — paste it anywhere 📋"); }
    } catch { /* share sheet dismissed */ }
  };
  // fixed brand-navy palette on purpose: this is an exported-look story card,
  // not a themed surface
  return (
    <div onClick={A.closeShare} style={{
      position: "absolute", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.72)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      animation: "tpFade .18s", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 230, aspectRatio: "9/16", borderRadius: 18, overflow: "hidden",
        background: "linear-gradient(160deg, #141C3D 0%, #0A0F26 60%)",
        border: "1px solid rgba(99,116,255,0.30)", position: "relative",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: 18, animation: "tpPop .3s cubic-bezier(.2,1.3,.4,1)", boxSizing: "border-box",
      }}>
        <div style={{ position: "absolute", right: -44, top: -44, width: 150, height: 150, borderRadius: "50%", background: "var(--accent)", opacity: 0.22 }} />
        <div style={{ position: "absolute", left: -30, bottom: 60, width: 90, height: 90, borderRadius: "50%", border: "2px solid var(--accent)", opacity: 0.25 }} />
        <Row style={{ justifyContent: "space-between", position: "relative" }}>
          <Body size={10} bold color="#94A0C8" style={{ letterSpacing: "0.14em" }}>TERNAK PADEL</Body>
          {season && <Body size={10} color="#5C6892" style={{ textTransform: "uppercase" }}>{season.name}</Body>}
        </Row>
        {victory ? (
          <Col gap={6} style={{ position: "relative" }}>
            <Body size={11} bold color="var(--accent)" style={{ letterSpacing: "0.12em" }}>VICTORY</Body>
            {score && <Num size={46} color="#fff">{score}</Num>}
            {S.shareLine && <Body size={12} color="#94A0C8">{S.shareLine}</Body>}
            {S.shareSub && <Body size={11} color="#5C6892">{S.shareSub}</Body>}
          </Col>
        ) : (
          <Col gap={6} style={{ position: "relative" }}>
            <Body size={11} bold color="var(--accent)" style={{ letterSpacing: "0.12em" }}>RANK UP</Body>
            <Num size={52} color="#fff">#{S.rank}</Num>
            <Body size={12} color="#94A0C8">{S.rankDelta > 0 ? "↑" + S.rankDelta + " this week · " : ""}Win rate {S.winRate}% · W{S.streak} streak</Body>
          </Col>
        )}
        <Row style={{ justifyContent: "space-between", position: "relative" }}>
          {S.me?.user && <Body size={11} bold color="#fff">{S.me.user}</Body>}
          <Body size={10} color="#5C6892" style={{ marginLeft: "auto" }}>ternakpadel.xyz</Body>
        </Row>
      </div>
      <Btn small primary onClick={doShare}>Share</Btn>
      <Body size={12} color="#94A0C8">Tap outside to close</Body>
    </div>
  );
}

// ---------- Create match sheet (FAB) ----------

export function CreateSheet({ S, A }) {
  const [mode, setMode] = React.useState("manual");
  const [name, setName] = React.useState("");
  const [format, setFormat] = React.useState("Americano");
  const [courts, setCourts] = React.useState(4);
  const [max, setMax] = React.useState(16);
  const [when, setWhen] = React.useState("");
  const [link, setLink] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [creatingBusy, setCreatingBusy] = React.useState(false);
  const [src, setSrc] = React.useState(null); // reclub provenance once generated
  const formats = ["Americano", "Mexicano", "KOTH", "Knockout", "League", "Mixicano"];
  const generate = async () => {
    setBusy(true);
    const d = await A.fetchReclub(link);
    setBusy(false);
    if (!d) return;
    if (d.title) setName(d.title);
    if (d.type) setFormat(d.type);
    if (d.courts) setCourts(d.courts);
    if (d.max) setMax(d.max);
    if (d.when) setWhen(d.when);
    setSrc({ source: d.source || "reclub", source_ref: d.source_ref || null, source_url: d.source_url || link.trim(), fee: d.fee, desc: d.desc, players: Array.isArray(d.players) ? d.players : [] });
    A.toast(`Generated — ${(d.players || []).length} confirmed player(s) pulled in`);
  };
  const create = async () => {
    if (creatingBusy) return; // guard against double-taps while the insert is in flight
    const extra = {};
    if (mode === "reclub" && src) {
      extra.source = src.source; extra.source_ref = src.source_ref; extra.source_url = src.source_url;
      if (typeof src.fee === "number") extra.fee = src.fee;
      if (src.desc) extra.desc = src.desc;
      // confirmed reclub participants → placeholder players an admin can fulfill with real emails
      extra.roster = (src.players || []).map((n) => ({ name: n, email: null }));
    }
    setCreatingBusy(true);
    try { await A.createEvent(name || ("New " + format), format, courts, max, when, extra); }
    finally { setCreatingBusy(false); }
  };
  return (
    <Sheet open={S.creating} onClose={() => A.setCreating(false)} title="Add match">
      <Col gap={12}>
        <Row gap={7}>
          <Pill small on={mode === "manual"} onClick={() => setMode("manual")}><Icon name="pencil" size={12} /> Manual</Pill>
          <Pill small on={mode === "reclub"} onClick={() => setMode("reclub")}><Icon name="link" size={12} /> From reclub link</Pill>
        </Row>
        {mode === "reclub" && (
          <Col gap={8}>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste reclub event link (https://reclub.co/…)" />
            <Btn ghost full disabled={busy} onClick={generate}>{busy ? "Generating…" : <React.Fragment><Icon name="zap" size={14} /> Generate from reclub</React.Fragment>}</Btn>
            <Body size={11.5} dim>Auto-fills the details below and pulls in the confirmed participants as placeholder players — an admin can fill real emails later.</Body>
          </Col>
        )}
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name — e.g. Sunday Mexicano" />
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <MicroLabel size={12} style={{ marginBottom: -6 }}>Format</MicroLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {formats.map((f) => <Pill key={f} small on={format === f} onClick={() => setFormat(f)}>{f}</Pill>)}
          {!formats.includes(format) && <Pill small on>{format}</Pill>}
        </div>
        <Row gap={8}>
          {[["Courts", courts, setCourts, 1, 8], ["Max players", max, setMax, 4, 64]].map(([l, v, set, lo, hi]) => (
            <Card key={l} pad={10} style={{ flex: 1 }}>
              <MicroLabel style={{ marginBottom: 6 }}>{l}</MicroLabel>
              <Row style={{ justifyContent: "space-between" }}>
                <Btn small ghost ariaLabel={"Fewer " + l.toLowerCase()} onClick={() => set(Math.max(lo, v - 1))}>−</Btn>
                <Num size={18}>{v}</Num>
                <Btn small ghost ariaLabel={"More " + l.toLowerCase()} onClick={() => set(Math.min(hi, v + 1))}>+</Btn>
              </Row>
            </Card>
          ))}
        </Row>
        <Body size={11.5} dim>Smart matchmaking will balance pairings by ranking, partner history and social mixing.</Body>
        <Btn primary full disabled={creatingBusy} onClick={create}>
          {creatingBusy ? "Creating…" : "Create & open registration"}
        </Btn>
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
  React.useEffect(() => {
    if (open) { setFullName(me.name || ""); setBio(me.bio || ""); setInstagram(me.instagram || ""); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={A.closeEditProfile} title="Edit profile">
      <Col gap={12}>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Name" />
        <Input multiline value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280}
          placeholder="Short bio — your padel story (max 280)"
          style={{ minHeight: 76, resize: "vertical" }} />
        <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram @handle" />
        <Btn primary full onClick={() => A.saveProfile({ full_name: fullName, bio, instagram })}>Save profile</Btn>
      </Col>
    </Sheet>
  );
}
