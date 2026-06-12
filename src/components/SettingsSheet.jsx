import React from "react";
import { TP_FONTS, TP_ACCENTS } from "../theme.js";
import { Body, Pill, Btn, Seg, Row, Col, Sheet } from "./atoms.jsx";

// In-app settings — replaces the prototype's floating Tweaks panel.
// Exposes the same options: theme, accent, type pairing, home order, density,
// host-console mode, replay onboarding.

function Label({ children }) {
  return <Body size={11} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</Body>;
}

export function SettingsSheet({ open, t, setT, A }) {
  return (
    <Sheet open={open} onClose={A.closeSettings} title="Settings">
      <Col gap={14}>
        <Col gap={7}>
          <Label>Appearance</Label>
          <Seg options={["dark", "light"]} value={t.theme} onChange={(v) => setT("theme", v)} />
        </Col>
        <Col gap={7}>
          <Label>Accent</Label>
          <Row gap={8}>
            {TP_ACCENTS.map((c) => (
              <button key={c} onClick={() => setT("accent", c)} style={{
                width: 40, height: 40, borderRadius: "50%", background: c, cursor: "pointer",
                border: t.accent === c ? "3px solid var(--text)" : "3px solid transparent",
                boxShadow: "0 0 0 1px var(--line)",
              }} />
            ))}
          </Row>
        </Col>
        <Col gap={7}>
          <Label>Type pairing</Label>
          <Row gap={7} style={{ flexWrap: "wrap" }}>
            {Object.keys(TP_FONTS).map((k) => (
              <Pill key={k} small on={t.font === k} onClick={() => setT("font", k)}>{TP_FONTS[k].label}</Pill>
            ))}
          </Row>
        </Col>
        <Col gap={7}>
          <Label>Home order</Label>
          <Seg options={["matchday", "feed"]} value={t.homeLayout} onChange={(v) => setT("homeLayout", v)} />
        </Col>
        <Col gap={7}>
          <Label>Density</Label>
          <Seg options={["comfy", "compact"]} value={t.density} onChange={(v) => setT("density", v)} />
        </Col>
        <Col gap={7}>
          <Label>Hosting</Label>
          <Btn full ghost onClick={A.enterHost}>▤ Open host console (for community hosts)</Btn>
        </Col>
        <Col gap={7}>
          <Label>Account</Label>
          <Btn full ghost onClick={A.replayOnboarding}>Replay onboarding</Btn>
        </Col>
      </Col>
    </Sheet>
  );
}
