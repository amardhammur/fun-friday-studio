// Never shows library photos: the home screen is often on the projector, and a real pair would spoil a round.
export function Preview() {
  return <div className="activity-art" aria-label="A childhood portrait beside a current portrait"><span className="art-doodle d1">✧</span><span className="art-doodle d2">✳</span><div className="art-grid"/><div className="mini-polaroid mini-then"><span className="tape"/><div className="placeholder-portrait">☺</div><span className="handwritten">back then</span></div><div className="mini-polaroid mini-now"><div className="placeholder-portrait">☺</div><span className="handwritten">all grown up</span></div><span className="art-arrow handwritten">⤷</span><span className="art-note handwritten">Wait… is that you?</span></div>;
}
