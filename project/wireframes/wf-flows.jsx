// Flow storyboards: onboarding/OTP, events discovery + detail, match engine.

function OnboardingFlow() {
  return (
    <div style={{ padding: 16, display: "flex", gap: 4, alignItems: "center" }}>
      <Phone w={200} h={400} noNav title="1 · Register">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, padding: "0 4px" }}>
          <SText size={16} bold>Ternak Padel</SText>
          <SText size={10} color={WF.faint}>No passwords. Ever.</SText>
          <SBox pad={6}><SText size={10} color={WF.faint}>Full name</SText></SBox>
          <SBox pad={6}><SText size={10} color={WF.faint}>WhatsApp number</SText></SBox>
          <SBox pad={6}><SText size={10} color={WF.faint}>Email</SText></SBox>
          <SBtn primary>Continue with WhatsApp</SBtn>
        </div>
      </Phone>
      <FlowArrow label="OTP via WA"></FlowArrow>
      <Phone w={200} h={400} noNav title="2 · Verify">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, alignItems: "center" }}>
          <SCircle d={36} fill="rgba(0,210,106,0.2)">✓</SCircle>
          <SText size={12} bold>Enter the code we sent to WhatsApp</SText>
          <div style={{ display: "flex", gap: 5 }}>
            {[7, 7, 7, 7].map((_, i) => (
              <SBox key={i} w={26} h={32} pad={0} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SText size={14} bold>{i < 2 ? "4" : ""}</SText>
              </SBox>
            ))}
          </div>
          <SText size={9} color={WF.faint}>resend in 0:24</SText>
        </div>
      </Phone>
      <FlowArrow label="4 quick cards"></FlowArrow>
      <Phone w={200} h={400} noNav title="3 · Profile setup">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "8px 4px" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4].map((s) => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s === 1 ? WF.marker : "#ddd" }}></div>
            ))}
          </div>
          <SText size={13} bold>Your skill level?</SText>
          {["Beginner", "Intermediate", "Advanced", "Competitive"].map((t, i) => (
            <SBox key={t} pad={6} fill={i === 1 ? "rgba(255,107,0,0.2)" : "transparent"}>
              <SText size={11}>{t}</SText>
            </SBox>
          ))}
          <SText size={9} color={WF.faint} style={{ marginTop: "auto" }}>then: side → frequency → goals</SText>
        </div>
      </Phone>
      <FlowArrow></FlowArrow>
      <Phone w={200} h={400} noNav title="4 · Identity created">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, alignItems: "center" }}>
          <SCircle d={44}></SCircle>
          <SText size={13} bold>@tomy</SText>
          <SPill on>Intermediate · Left side</SPill>
          <SBox pad={6} dashed w="90%">
            <SText size={10} bold>🏅 First badge: Rookie</SText>
            <SText size={9} color={WF.faint}>Your padel career starts now</SText>
          </SBox>
          <SBtn primary w="90%">Find your first match</SBtn>
        </div>
      </Phone>
      <Note style={{ maxWidth: 130 }}>3 fields + OTP = under 60s to join. Career framing starts at signup.</Note>
    </div>
  );
}

function EventsVariantA() {
  // List + filter pills
  return (
    <Phone navActive={1} title="A · Filterable list">
      <SText size={14} bold>Events</SText>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <SPill on>All</SPill><SPill>Tournament</SPill><SPill>Social</SPill><SPill>Clinic</SPill>
      </div>
      {[
        ["FRI 13", "Friday Night Americano", "Rp 100k · 10/16", true],
        ["SAB 14", "Mexicano Social", "Rp 85k · 8/12", false],
        ["MIN 15", "Summer League W7", "Rp 150k · full", false],
      ].map(([d, t, m, hot]) => (
        <SBox key={t} pad={6} fill={hot ? "rgba(255,107,0,0.12)" : "transparent"}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SBox w={38} h={38} pad={2} style={{ textAlign: "center" }}>
              <SText size={9} color={WF.faint}>{String(d).split(" ")[0]}</SText>
              <SText size={13} bold>{String(d).split(" ")[1]}</SText>
            </SBox>
            <div style={{ flex: 1 }}>
              <SText size={11} bold>{t}</SText>
              <SText size={9} color={WF.faint}>{m}</SText>
            </div>
            <SAvatars n={2} d={16}></SAvatars>
          </div>
        </SBox>
      ))}
    </Phone>
  );
}

function EventsVariantB() {
  // Calendar-first
  return (
    <Phone navActive={1} title="B · Calendar-first">
      <SText size={14} bold>June</SText>
      <SBox pad={5}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} style={{
              height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Patrick Hand', cursive", fontSize: 9,
              background: [12, 13, 14].includes(i) ? "rgba(255,107,0,0.3)" : "transparent",
              border: i === 11 ? `1.4px solid ${WF.ink}` : "1px solid #e5e3dc",
            }}>{i + 1}</div>
          ))}
        </div>
      </SBox>
      <SHead>Fri 13</SHead>
      <SBox pad={6} fill="rgba(255,107,0,0.12)">
        <SText size={11} bold>Friday Night Americano</SText>
        <SText size={9} color={WF.faint}>19:00 · Padel Pro SCBD · Rp 100k</SText>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, alignItems: "center" }}>
          <SAvatars n={3} d={16}></SAvatars>
          <SBtn primary small>Join</SBtn>
        </div>
      </SBox>
      <SBox pad={6} dashed>
        <SText size={10} color={WF.faint}>+ KOTH Night · 21:00</SText>
      </SBox>
    </Phone>
  );
}

function EventDetail() {
  return (
    <Phone navActive={1} title="Event detail (one canonical layout)">
      <SImage h={56} label="event banner + sponsor logos"></SImage>
      <SText size={13} bold>Friday Night Americano</SText>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <SPill on>Americano</SPill><SPill>Rp 100k</SPill><SPill>+10 pts</SPill>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <SBox pad={5} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>when</SText>
          <SText size={10} bold>Fri 19:00</SText>
        </SBox>
        <SBox pad={5} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>where</SText>
          <SText size={10} bold>SCBD · 4 courts</SText>
        </SBox>
      </div>
      <SHead right="10/16">Players</SHead>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SAvatars n={6} d={20}></SAvatars>
        <SText size={9} color={WF.faint}>+4 · 6 slots left</SText>
      </div>
      <SHead>Schedule & results</SHead>
      <Scribble lines={2}></Scribble>
      <div style={{ marginTop: "auto" }}>
        <SBtn primary>Join — pay with QRIS</SBtn>
      </div>
    </Phone>
  );
}

function MatchCreate() {
  return (
    <Phone w={220} h={440} noNav title="Create match (admin, 1 screen)">
      <SText size={13} bold>New event</SText>
      <SBox pad={5}><SText size={10} color={WF.faint}>Event name</SText></SBox>
      <div style={{ display: "flex", gap: 5 }}>
        <SBox pad={5} style={{ flex: 1 }}><SText size={10} color={WF.faint}>Date</SText></SBox>
        <SBox pad={5} style={{ flex: 1 }}><SText size={10} color={WF.faint}>Venue</SText></SBox>
      </div>
      <SText size={10} bold>Format</SText>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <SPill on>Americano</SPill><SPill>Mexicano</SPill><SPill>KOTH</SPill><SPill>more…</SPill>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <SBox pad={5} style={{ flex: 1 }}><SText size={10} color={WF.faint}>Courts: 4</SText></SBox>
        <SBox pad={5} style={{ flex: 1 }}><SText size={10} color={WF.faint}>Max: 16</SText></SBox>
      </div>
      <SBox pad={5}><SText size={10} color={WF.faint}>Fee: Rp 100.000</SText></SBox>
      <div style={{ marginTop: "auto", paddingBottom: 8 }}>
        <SBtn primary>Create & open registration</SBtn>
      </div>
    </Phone>
  );
}

function LiveScoringA() {
  // Scorer view
  return (
    <Phone w={220} h={440} noNav title="A · Scorer (court view)">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <SPill on>Court 2 · R3</SPill>
        <SText size={10} color={WF.faint}>● live</SText>
      </div>
      <SBox pad={8} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SText size={11}>Tomy / Dina</SText>
          <SText size={26} bold>14</SText>
        </div>
        <div style={{ borderTop: `1.4px dashed ${WF.faint}` }}></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SText size={11}>Andre / Sari</SText>
          <SText size={26} bold>10</SText>
        </div>
      </SBox>
      <div style={{ display: "flex", gap: 6 }}>
        <SBtn w="50%">− point</SBtn>
        <SBtn w="50%" primary>+ point</SBtn>
      </div>
      <SBtn>End match → next round</SBtn>
    </Phone>
  );
}

function LiveScoringB() {
  // Spectator multi-court
  return (
    <Phone w={220} h={440} noNav title="B · Spectator (all courts)">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <SText size={12} bold>Friday Americano</SText>
        <SText size={10} color={WF.faint}>R3/7 ● live</SText>
      </div>
      {[
        ["Court 1", "Bayu/Rina", 16, "Eko/Maya", 12],
        ["Court 2", "Tomy/Dina", 14, "Andre/Sari", 10],
      ].map(([c, t1, s1, t2, s2]) => (
        <SBox key={c} pad={6}>
          <SText size={9} color={WF.faint}>{c}</SText>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <SText size={10}>{t1}</SText><SText size={12} bold>{s1}</SText>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <SText size={10}>{t2}</SText><SText size={12} bold>{s2}</SText>
          </div>
        </SBox>
      ))}
      <SHead right="live ↻">Standings</SHead>
      <SRankRow pos="1" name="Rina" pts="86"></SRankRow>
      <SRankRow pos="2" name="Tomy" pts="81" me></SRankRow>
      <SRankRow pos="3" name="Bayu" pts="77"></SRankRow>
    </Phone>
  );
}

function FlowsSections() {
  return (
    <React.Fragment>
      <DCSection id="onboarding" title="2 · Registration & onboarding" subtitle="WhatsApp OTP, no passwords — 60-second path from stranger to member with a padel identity">
        <DCArtboard id="onb-flow" label="Storyboard · register → OTP → setup → identity" width={1080} height={500}>
          <OnboardingFlow></OnboardingFlow>
        </DCArtboard>
      </DCSection>
      <DCSection id="events" title="3 · Events — discovery & detail" subtitle="Two discovery models; one canonical detail page with QRIS payment">
        <DCArtboard id="ev-a" label="A · Filterable list" width={290} height={580}>
          <div style={{ padding: 16 }}><EventsVariantA></EventsVariantA></div>
        </DCArtboard>
        <DCArtboard id="ev-b" label="B · Calendar-first" width={290} height={580}>
          <div style={{ padding: 16 }}><EventsVariantB></EventsVariantB></div>
        </DCArtboard>
        <DCArtboard id="ev-detail" label="Event detail" width={290} height={580}>
          <div style={{ padding: 16 }}><EventDetail></EventDetail></div>
        </DCArtboard>
      </DCSection>
      <DCSection id="match" title="4 · Match engine — create, score, standings" subtitle="Admin creates in one screen; live scoring has a scorer mode and a spectator mode">
        <DCArtboard id="m-create" label="Create match" width={260} height={520}>
          <div style={{ padding: 16 }}><MatchCreate></MatchCreate></div>
        </DCArtboard>
        <DCArtboard id="m-score-a" label="Live scoring A · scorer" width={260} height={520}>
          <div style={{ padding: 16 }}><LiveScoringA></LiveScoringA></div>
        </DCArtboard>
        <DCArtboard id="m-score-b" label="Live scoring B · spectator" width={260} height={520}>
          <div style={{ padding: 16 }}><LiveScoringB></LiveScoringB></div>
        </DCArtboard>
      </DCSection>
    </React.Fragment>
  );
}

window.FlowsSections = FlowsSections;
