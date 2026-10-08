export function Rules({ points }: { points: number }) {
  return <ol className="pid-rules">
    <li>Make a short commercial for your secret everyday product.</li>
    <li>Communicate both required clues. Keep the product’s name and the real item hidden.</li>
    <li>Other teams submit one guess before the reveal.</li>
    <li>Each correct guessing team earns <b>+{points}</b>. Presenters earn 0 this turn.</li>
    <li>Everyone presents once and has the same number of guessing turns.</li>
  </ol>;
}
