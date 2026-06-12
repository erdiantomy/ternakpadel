// Profile/Career variants, Rankings, Shareable cards, Admin dashboard.

function ProfileA() {
  // Career timeline (Strava profile)
  return (
    <Phone navActive={4} title="A · Career timeline">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SCircle d={36}></SCircle>
        <div style={{ flex: 1 }}>
          <SText size={13} bold>Tomy S.</SText>
          <SText size={9} color={WF.faint}>@tomy · member since 2024</SText>
        </div>
        <SPill on>#8</SPill>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[["47", "matches"], ["30", "wins"], ["64%", "win rate"]].map(([v, l]) => (
          <SBox key={l} pad={4} style={{ flex: 1, textAlign: "center" }}>
            <SText size={14} bold>{v}</SText>
            <SText size={8} color={WF.faint}>{l}</SText>
          </SBox>
        ))}
      </div>
      <SHead>Career timeline</SHead>
      {[
        ["W 6-3", "vs Andre/Sari · Fri Americano", true],
        ["🏅", "Earned 'Undefeated' badge", false],
        ["L 4-6", "vs Bayu/Rina · KOTH Night", false],
        ["↑", "Moved to Rank #8", false],
      ].map(([w, t], i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <SCircle d={24} fill={String(w).startsWith("W") ? "rgba(0,210,106,0.2)" : String(w).startsWith("L") ? "rgba(255,77,77,0.15)" : "rgba(255,107,0,0.2)"}>
            <span style={{ fontSize: 8 }}>{w}</span>
          </SCircle>
          <SText size={10} style={{ flex: 1 }}>{t}</SText>
        </div>
      ))}
      <SText size={9} color={WF.faint}>nothing is deleted — everything accumulates ↓</SText>
    </Phone>
  );
}

function ProfileB() {
  // Stats dashboard (Garmin)
  return (
    <Phone navActive={4} title="B · Stats dashboard">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SCircle d={30}></SCircle>
        <SText size={13} bold>Tomy S.</SText>
        <div style={{ marginLeft: "auto" }}><SPill>share ↗</SPill></div>
      </div>
      <SBox pad={6}>
        <SHead right="season 3">Ranking history</SHead>
        <SLine h={50}></SLine>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <SText size={8} color={WF.faint}>S1</SText>
          <SText size={8} color={WF.faint}>S2</SText>
          <SText size={8} color={WF.faint}>S3 · #8</SText>
        </div>
      </SBox>
      <div style={{ display: "flex", gap: 6 }}>
        <SBox pad={5} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>by side</SText>
          <SText size={11} bold>L 78% · R 52%</SText>
        </SBox>
        <SBox pad={5} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>streak</SText>
          <SText size={11} bold>W3 🔥</SText>
        </SBox>
      </div>
      <SHead>Matches / month</SHead>
      <SBars vals={[3, 6, 4, 8, 5, 9]} h={36} hi={5}></SBars>
      <SHead right="12/30">Badges</SHead>
      <div style={{ display: "flex", gap: 5 }}>
        {["🏅", "⚔️", "👑", "🔒", "🔒"].map((b, i) => (
          <SCircle key={i} d={26} fill={b === "🔒" ? "transparent" : "rgba(255,107,0,0.15)"}>
            <span style={{ fontSize: 11, opacity: b === "🔒" ? 0.4 : 1 }}>{b}</span>
          </SCircle>
        ))}
      </div>
    </Phone>
  );
}

function ProfileC() {
  // Trophy case / gamified
  return (
    <Phone navActive={4} title="C · Trophy case">
      <div style={{ textAlign: "center" }}>
        <SCircle d={44} style={{ margin: "0 auto" }}></SCircle>
        <SText size={13} bold>Tomy S.</SText>
        <SText size={9} color={WF.faint}>Intermediate · Left · Jakarta</SText>
      </div>
      <SBox pad={6} fill="rgba(255,107,0,0.15)" style={{ textAlign: "center" }}>
        <SText size={10} color={WF.faint}>career level</SText>
        <SText size={15} bold>⚔️ Warrior — 47/100 matches</SText>
        <div style={{ height: 6, border: `1.3px solid ${WF.ink}`, borderRadius: 4, marginTop: 3 }}>
          <div style={{ width: "47%", height: "100%", background: "rgba(255,107,0,0.6)", borderRadius: 3 }}></div>
        </div>
      </SBox>
      <SHead>Trophy shelf</SHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {["Champion S2", "Undefeated x10", "Social Butterfly", "First Match", "KOTH Winner", "???"].map((t) => (
          <SBox key={t} pad={4} dashed={t === "???"} style={{ textAlign: "center" }}>
            <SText size={14}>{t === "???" ? "🔒" : "🏆"}</SText>
            <SText size={8} color={WF.faint}>{t}</SText>
          </SBox>
        ))}
      </div>
      <SHead>Seasons</SHead>
      <div style={{ display: "flex", gap: 5 }}>
        <SPill on>S3 · #8</SPill><SPill>S2 · #11</SPill><SPill>S1 · #19</SPill>
      </div>
    </Phone>
  );
}

function RankingsScreen() {
  return (
    <Phone navActive={3} title="Rankings (one layout, many filters)">
      <SText size={14} bold>Leaderboard</SText>
      <div style={{ display: "flex", gap: 5 }}>
        <SPill on>Season</SPill><SPill>Monthly</SPill><SPill>All time</SPill>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <SPill>Men</SPill><SPill>Women</SPill><SPill on>Intermediate</SPill>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 6, padding: "6px 0" }}>
        {[["2", 34], ["1", 46], ["3", 28]].map(([p, h]) => (
          <div key={p} style={{ textAlign: "center" }}>
            <SCircle d={24} style={{ margin: "0 auto 2px" }}></SCircle>
            <SBox w={44} h={h} pad={2} fill={p === "1" ? "rgba(255,107,0,0.3)" : "rgba(0,0,0,0.04)"} style={{ textAlign: "center" }}>
              <SText size={12} bold>{p}</SText>
            </SBox>
          </div>
        ))}
      </div>
      <SRankRow pos="4" name="Eko" pts="455"></SRankRow>
      <SRankRow pos="5" name="Maya" pts="431"></SRankRow>
      <SRankRow pos="6" name="Bayu" pts="412"></SRankRow>
      <SBox pad={3} fill="rgba(255,107,0,0.18)" style={{ position: "sticky", bottom: 0 }}>
        <SRankRow pos="8" name="Tomy (you) ↑2" pts="380" me></SRankRow>
      </SBox>
    </Phone>
  );
}

function ShareCards() {
  const card = (title, body, label) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <SBox w={120} h={210} pad={8} fill="#1c1c1c" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <SText size={9} color="#888">TERNAK PADEL</SText>
        {body}
        <SText size={8} color="#666">@tomy · season 3</SText>
      </SBox>
      <SText size={11} color={WF.faint} style={{ fontFamily: "'Caveat', cursive" }}>{label}</SText>
    </div>
  );
  return (
    <div style={{ padding: 16, display: "flex", gap: 18, alignItems: "flex-start" }}>
      {card("victory", (
        <div>
          <SText size={11} bold color="#fff">VICTORY</SText>
          <SText size={18} bold color="#FF8A3D">6-3</SText>
          <SText size={8} color="#aaa">vs Andre / Sari</SText>
        </div>
      ), "Victory card")}
      {card("rank", (
        <div>
          <SText size={9} color="#aaa">new rank</SText>
          <SText size={22} bold color="#FF8A3D">#8</SText>
          <SText size={8} color="#aaa">↑2 this week</SText>
        </div>
      ), "Rank-up card")}
      {card("badge", (
        <div style={{ textAlign: "center" }}>
          <SText size={20}>🏅</SText>
          <SText size={10} bold color="#fff">UNDEFEATED</SText>
          <SText size={8} color="#aaa">10 wins in a row</SText>
        </div>
      ), "Achievement card")}
      {card("champ", (
        <div style={{ textAlign: "center" }}>
          <SText size={20}>🏆</SText>
          <SText size={10} bold color="#fff">CHAMPION</SText>
          <SText size={8} color="#aaa">Summer League S3</SText>
        </div>
      ), "Champion card")}
      <Note>9:16 IG-story-first. Dark, brand-stamped, auto-generated after every result. The virality loop.</Note>
    </div>
  );
}

function AdminDash() {
  const stat = (l, v, spark) => (
    <SBox pad={8} style={{ flex: 1 }}>
      <SText size={10} color={WF.faint}>{l}</SText>
      <SText size={18} bold>{v}</SText>
      {spark && <SBars vals={spark} h={22} hi={spark.length - 1}></SBars>}
    </SBox>
  );
  return (
    <div style={{ padding: 16 }}>
      <SBox w={760} pad={0} style={{ display: "flex", overflow: "hidden", borderRadius: 14 }}>
        {/* sidebar */}
        <div style={{ width: 120, borderRight: `1.5px solid ${WF.ink}`, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <SText size={12} bold>TP Admin</SText>
          {["Overview", "Events", "Members", "Courts", "Payments", "Sponsors"].map((t, i) => (
            <SText key={t} size={10} color={i === 0 ? WF.ink : WF.faint} style={{ background: i === 0 ? "rgba(255,107,0,0.2)" : "none", padding: "2px 6px", borderRadius: 5 }}>{t}</SText>
          ))}
        </div>
        {/* main */}
        <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SText size={13} bold>Overview — Juni 2026</SText>
            <SPill on>Season 3</SPill>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {stat("revenue", "Rp 42.5jt", [4, 5, 7, 6, 9])}
            {stat("active members", "128", [6, 7, 7, 8, 9])}
            {stat("avg attendance", "86%", null)}
            {stat("churn risk", "7 ⚠", null)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SBox pad={8} style={{ flex: 2 }}>
              <SText size={10} color={WF.faint}>court utilization / week</SText>
              <SBars vals={[6, 8, 5, 9, 10, 12, 11]} h={56} hi={5}></SBars>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {["S", "S", "R", "K", "J", "S", "M"].map((d, i) => <SText key={i} size={8} color={WF.faint}>{d}</SText>)}
              </div>
            </SBox>
            <SBox pad={8} style={{ flex: 1 }}>
              <SText size={10} color={WF.faint}>upcoming events</SText>
              <SText size={10}>Fri Americano · 10/16</SText>
              <SText size={10}>Sab Mexicano · 8/12</SText>
              <SText size={10}>Min League W7 · full</SText>
              <SBtn small primary>+ New event</SBtn>
            </SBox>
          </div>
          <SBox pad={6} dashed>
            <SText size={10}>⚠ 7 members haven't played in 30 days — send WhatsApp re-engagement?</SText>
          </SBox>
        </div>
      </SBox>
    </div>
  );
}

function CareerSections() {
  return (
    <React.Fragment>
      <DCSection id="profile" title="5 · Player profile / career — 3 directions" subtitle="The most important screen: a permanent padel identity. Timeline vs. analytics vs. trophy case.">
        <DCArtboard id="prof-a" label="A · Career timeline" width={290} height={580}>
          <div style={{ padding: 16 }}><ProfileA></ProfileA></div>
        </DCArtboard>
        <DCArtboard id="prof-b" label="B · Stats dashboard" width={290} height={580}>
          <div style={{ padding: 16 }}><ProfileB></ProfileB></div>
        </DCArtboard>
        <DCArtboard id="prof-c" label="C · Trophy case" width={290} height={580}>
          <div style={{ padding: 16 }}><ProfileC></ProfileC></div>
        </DCArtboard>
        <DCArtboard id="rankings" label="Rankings screen" width={290} height={580}>
          <div style={{ padding: 16 }}><RankingsScreen></RankingsScreen></div>
        </DCArtboard>
      </DCSection>
      <DCSection id="share" title="6 · Shareable cards" subtitle="Auto-generated after every result — IG story / WhatsApp status sized">
        <DCArtboard id="share-cards" label="Card family" width={780} height={300}>
          <ShareCards></ShareCards>
        </DCArtboard>
      </DCSection>
      <DCSection id="admin" title="7 · Admin dashboard" subtitle="Web/tablet view — revenue, retention, utilization, churn nudges">
        <DCArtboard id="admin-dash" label="Overview" width={800} height={480}>
          <AdminDash></AdminDash>
        </DCArtboard>
      </DCSection>
    </React.Fragment>
  );
}

window.CareerSections = CareerSections;
