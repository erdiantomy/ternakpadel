// Five structural directions for the Ternak Padel home screen.
// Each is a distinct philosophy, not a reskin.

function HomeA() {
  // A — Feed-first (Strava-like)
  return (
    <Phone navActive={0} fab>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SText size={14} bold>Ternak Padel</SText>
        <SCircle d={20}>🔔</SCircle>
      </div>
      <SBox pad={6} fill="rgba(255,107,0,0.12)">
        <SText size={11} bold>Next: Friday Night Americano</SText>
        <SText size={10} color={WF.faint}>Jum'at 19:00 · Padel Pro SCBD</SText>
      </SBox>
      <SHead right="feed">Community</SHead>
      {[
        ["Tomy defeated Andre 6-3", "+12 pts"],
        ["Rizky moved to Rank #5", "↑2"],
      ].map(([t, x], i) => (
        <SBox key={i} pad={6}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <SCircle d={22}></SCircle>
            <div style={{ flex: 1 }}>
              <SText size={11}>{t}</SText>
              <SText size={9} color={WF.faint}>2h · {x}</SText>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <SText size={10} color={WF.faint}>♡ 12</SText>
            <SText size={10} color={WF.faint}>💬 3</SText>
            <SText size={10} color={WF.faint}>↗</SText>
          </div>
        </SBox>
      ))}
      <SBox pad={6}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <SCircle d={22}></SCircle>
          <SText size={11}>Dina won Summer League W3</SText>
        </div>
        <SImage h={48} label="match photo"></SImage>
      </SBox>
    </Phone>
  );
}

function HomeB() {
  // B — Match-day-first (agenda)
  return (
    <Phone navActive={0} fab>
      <SText size={14} bold>Selamat pagi, Tomy</SText>
      <SBox pad={8} fill="rgba(255,107,0,0.18)">
        <SText size={10} color={WF.faint}>TODAY · 19:00</SText>
        <SText size={13} bold>Friday Night Americano</SText>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <SAvatars n={4} d={18}></SAvatars>
          <SBtn primary small>Check in</SBtn>
        </div>
      </SBox>
      <SHead>This week</SHead>
      {["Sab · Mexicano Social", "Min · Coaching Clinic"].map((t) => (
        <SBox key={t} pad={6} dashed>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <SText size={11}>{t}</SText>
            <SText size={10} color={WF.faint}>join →</SText>
          </div>
        </SBox>
      ))}
      <SHead right="rank #8">Your form</SHead>
      <div style={{ display: "flex", gap: 8 }}>
        <SBox pad={5} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>streak</SText>
          <SText size={13} bold>W3</SText>
        </SBox>
        <SBox pad={5} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>win rate</SText>
          <SText size={13} bold>64%</SText>
        </SBox>
        <SBox pad={5} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>season</SText>
          <SText size={13} bold>#8</SText>
        </SBox>
      </div>
      <SHead>Feed</SHead>
      <Scribble lines={2}></Scribble>
    </Phone>
  );
}

function HomeC() {
  // C — Stats-first (Garmin-like dashboard)
  return (
    <Phone navActive={0} fab>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SText size={14} bold>Dashboard</SText>
        <SCircle d={22}></SCircle>
      </div>
      <SBox pad={8}>
        <SHead right="season 3">Ranking</SHead>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SText size={26} bold>#8</SText>
          <SLine w="70%" h={36}></SLine>
        </div>
      </SBox>
      <div style={{ display: "flex", gap: 8 }}>
        <SBox pad={6} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>matches</SText>
          <SText size={16} bold>47</SText>
          <SBars vals={[3, 5, 4, 7, 6]} h={22} hi={4}></SBars>
        </SBox>
        <SBox pad={6} style={{ flex: 1 }}>
          <SText size={9} color={WF.faint}>win rate</SText>
          <SText size={16} bold>64%</SText>
          <SBars vals={[5, 4, 6, 6, 8]} h={22} hi={4}></SBars>
        </SBox>
      </div>
      <SBox pad={6} fill="rgba(255,107,0,0.12)">
        <SText size={10} bold>⚡ Insight</SText>
        <SText size={10}>You win 78% on the left side. Play left more.</SText>
      </SBox>
      <SHead right="all →">Upcoming</SHead>
      <SBox pad={6} dashed>
        <SText size={11}>Fri · Americano · SCBD</SText>
      </SBox>
      <SHead right="top 10 →">Community pulse</SHead>
      <Scribble lines={2}></Scribble>
    </Phone>
  );
}

function HomeD() {
  // D — Competition-first (ladder front & center)
  return (
    <Phone navActive={0} fab>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SText size={14} bold>Season 3</SText>
        <SPill on>Week 6</SPill>
      </div>
      <SBox pad={6} fill="rgba(255,107,0,0.15)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <SText size={11} color={WF.faint}>your rank</SText>
            <SText size={20} bold>#8 ↑2</SText>
          </div>
          <div style={{ textAlign: "right" }}>
            <SText size={11} color={WF.faint}>to #7</SText>
            <SText size={13} bold>18 pts</SText>
          </div>
        </div>
      </SBox>
      <SHead right="full ladder →">Leaderboard</SHead>
      <div>
        <SRankRow pos="6" name="Bayu" pts="412"></SRankRow>
        <SRankRow pos="7" name="Sari" pts="398"></SRankRow>
        <SRankRow pos="8" name="Tomy (you)" pts="380" me></SRankRow>
        <SRankRow pos="9" name="Andre" pts="371"></SRankRow>
      </div>
      <SBox pad={6} dashed>
        <SText size={10} bold>🎯 Challenge Andre to defend #8</SText>
      </SBox>
      <SHead>Earn points this week</SHead>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <SPill on>Fri Americano +10</SPill>
        <SPill>Sun Tournament +25</SPill>
      </div>
    </Phone>
  );
}

function HomeE() {
  // E — Club-hub-first (community OS)
  return (
    <Phone navActive={0} fab>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SCircle d={28} fill="rgba(255,107,0,0.3)">TP</SCircle>
        <div>
          <SText size={13} bold>Ternak Padel Jakarta</SText>
          <SText size={9} color={WF.faint}>128 members · Gold member</SText>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {["Events", "Book", "League", "Shop"].map((t) => (
          <SBox key={t} pad={4} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ width: 14, height: 14, border: `1.4px solid ${WF.ink}`, borderRadius: 4, margin: "0 auto 2px" }}></div>
            <SText size={9}>{t}</SText>
          </SBox>
        ))}
      </div>
      <SHead right="carousel →">Happening</SHead>
      <div style={{ display: "flex", gap: 6 }}>
        <SBox pad={5} style={{ flex: 1 }}>
          <SImage h={34} label="banner"></SImage>
          <SText size={10} bold>Summer League</SText>
          <SText size={9} color={WF.faint}>Rp 150k · 12/16</SText>
        </SBox>
        <SBox pad={5} style={{ flex: 1 }}>
          <SImage h={34} label="banner"></SImage>
          <SText size={10} bold>KOTH Night</SText>
          <SText size={9} color={WF.faint}>Rp 100k · 6/8</SText>
        </SBox>
      </div>
      <SHead>Member feed</SHead>
      <SBox pad={6}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <SCircle d={20}></SCircle>
          <SText size={10}>Dina earned "Undefeated" badge 🏅</SText>
        </div>
      </SBox>
      <SBox pad={6}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <SCircle d={20}></SCircle>
          <SText size={10}>Sponsor: Padel Pro SCBD — 20% off Sabtu</SText>
        </div>
      </SBox>
    </Phone>
  );
}

function HomeSection() {
  return (
    <DCSection
      id="home"
      title="1 · Home screen — 5 structural directions"
      subtitle="Each direction answers: what is the FIRST thing a member sees every day?"
    >
      <DCArtboard id="home-a" label="A · Feed-first (Strava)" width={290} height={600}>
        <div style={{ padding: 16, display: "flex", gap: 10 }}>
          <HomeA></HomeA>
          <Note>Social proof drives daily opens. Matches & rank moves become posts.</Note>
        </div>
      </DCArtboard>
      <DCArtboard id="home-b" label="B · Match-day agenda" width={290} height={600}>
        <div style={{ padding: 16, display: "flex", gap: 10 }}>
          <HomeB></HomeB>
          <Note>"When do I play next?" answered in 0 taps. Feed demoted below fold.</Note>
        </div>
      </DCArtboard>
      <DCArtboard id="home-c" label="C · Stats dashboard (Garmin)" width={290} height={600}>
        <div style={{ padding: 16, display: "flex", gap: 10 }}>
          <HomeC></HomeC>
          <Note>Your numbers first. AI insight card teases the coach feature.</Note>
        </div>
      </DCArtboard>
      <DCArtboard id="home-d" label="D · Competition ladder" width={290} height={600}>
        <div style={{ padding: 16, display: "flex", gap: 10 }}>
          <HomeD></HomeD>
          <Note>Rank anxiety as the hook — who's above me, how do I climb. Points CTA ties events to ladder.</Note>
        </div>
      </DCArtboard>
      <DCArtboard id="home-e" label="E · Club hub" width={290} height={600}>
        <div style={{ padding: 16, display: "flex", gap: 10 }}>
          <HomeE></HomeE>
          <Note>Club identity first — memberships, sponsors, multi-club future fits naturally.</Note>
        </div>
      </DCArtboard>
    </DCSection>
  );
}

window.HomeSection = HomeSection;
