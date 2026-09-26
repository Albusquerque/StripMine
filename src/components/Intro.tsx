import { Button as DeckyButton } from "@decky/ui";
import type { ButtonProps } from "@decky/ui";
import { useEffect, useState } from "react";
import { STRIPMINE_LOGO_URL } from "../branding";

function Button(props: ButtonProps) { return <DeckyButton {...props} />; }

const TEMPOS = [
  { value: 1, name: "CHILL", estimate: "63 h" },
  { value: 2, name: "NORMAL", estimate: "31 h 30" },
  { value: 3, name: "NERVOUS", estimate: "21 h" },
  { value: 4, name: "COCAINE", estimate: "15 h 45" },
] as const;

export function Intro({ onComplete, tempo, onTempo }: { onComplete: () => void; tempo: number; onTempo: (value: number) => void }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const times = [1400, 2800, 4200, 5600, 9000];
    const timers = times.map((time, index) => window.setTimeout(() => setStage(index + 1), time));
    const finish = window.setTimeout(onComplete, 15000);
    return () => { timers.forEach(window.clearTimeout); window.clearTimeout(finish); };
  }, [onComplete]);
  return <div className={`sm-intro sm-intro-${stage}`}>
    <div className="sm-intro-grain" />
    <div className="sm-intro-copy sm-copy-0"><span>THE EARTH SPLIT OPEN</span><strong>A VEIN OF LIGHT AWOKE.</strong></div>
    <div className="sm-intro-copy sm-copy-1"><span>RICHES SURGED FROM THE DEEP</span><strong>THE SEAM KEPT GROWING.</strong></div>
    <div className="sm-intro-copy sm-copy-2"><span>MINERS TOILED, SHIFT AFTER SHIFT</span><strong>AND RAISED A CITY.</strong></div>
    <div className="sm-intro-scene" aria-label="Three red lights spread to ten, then feed two rising cities">
      <div className="sm-intro-city west">{Array.from({ length: 6 }, (_, index) => <b key={index} />)}</div>
      <div className="sm-intro-city east">{Array.from({ length: 6 }, (_, index) => <b key={index} />)}</div>
      <div className="sm-intro-flow west">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      <div className="sm-intro-flow east">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</div>
      <div className="sm-intro-rail">{Array.from({ length: 17 }, (_, index) => {
        const growth = index >= 7 && index <= 9 ? "seed" : index === 6 || index === 10 ? "grow-1" : index === 5 || index === 11 ? "grow-2" : index >= 4 && index <= 13 ? "grow-3" : "";
        return <i key={index} className={growth} />;
      })}</div>
    </div>
    <div className="sm-intro-title"><span>A 17-LIGHT IDLE EPIC</span><img className="sm-intro-logo" src={STRIPMINE_LOGO_URL} alt="StripMine" /><p>Every journey leaves a light behind.</p>
      <div className="sm-intro-tempo"><b>SHIFT TEMPO</b><div>{TEMPOS.map((option) => <Button key={option.value} className={tempo === option.value ? "active" : ""} onClick={() => onTempo(option.value)}>{option.name} ×{option.value}<small>{option.estimate}</small></Button>)}</div><em>Scoring presentation automatically adapts.</em></div>
      <Button className="sm-enter" onClick={onComplete}>Enter the mine</Button></div>
    <Button className="sm-skip" onClick={onComplete}>Skip intro</Button>
  </div>;
}
