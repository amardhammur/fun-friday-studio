export function Rules({ points }: { points: number }) {
  return <ol className="rr-rules">
    <li><b>Spot our fiction.</b> Two documented inventions. One pitch we wrote.</li>
    <li><b>Talk in pairs, then as a team.</b> Agree on A, B or C. Vote together.</li>
    <li><b>One more clue.</b> Stick or switch, then vote together again.</li>
    <li><b>Discover the truth.</b> Correct final vote: {points} points. No penalties or speed bonus.</li>
  </ol>;
}
