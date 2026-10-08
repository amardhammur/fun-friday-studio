export function BottleGraphic({ animated = false }: { animated?: boolean }) {
  return <svg className="bottle-graphic" data-animated={animated} viewBox="0 0 420 240" role="img" aria-label="A phone selfie preview and a toothpick dropping into a bottle">
    <circle className="bottle-graphic-glow" cx="259" cy="137" r="89"/>
    <ellipse className="bottle-graphic-shadow" cx="253" cy="210" rx="62" ry="8"/>
    <path className="bottle-graphic-table" d="M47 211H373"/>

    <g className="bottle-graphic-phone" transform="rotate(-10 117 131)">
      <rect className="bottle-graphic-phone-body" x="72" y="47" width="88" height="163" rx="17"/>
      <rect className="bottle-graphic-screen" x="80" y="65" width="72" height="123" rx="10"/>
      <circle className="bottle-graphic-camera" cx="116" cy="56" r="3"/>
      <path className="bottle-graphic-phone-line" d="M105 199H127"/>
      <path className="bottle-graphic-focus" d="M91 98V90H99M133 90H141V98M91 154V162H99M133 162H141V154"/>
      <path className="bottle-graphic-preview-bottle" d="M109 105H123V123L132 132V154Q132 160 126 160H106Q100 160 100 154V132L109 123Z"/>
      <path className="bottle-graphic-preview-pick" d="M116 113L118 144"/>
      <circle className="bottle-graphic-preview-dot" cx="139" cy="76" r="3"/>
    </g>

    <path className="bottle-graphic-glass" d="M239 78H267V116L284 135Q290 142 290 152V194Q290 208 276 208H230Q216 208 216 194V152Q216 142 222 135L239 116Z"/>
    <path className="bottle-graphic-shine" d="M229 148V186Q229 195 237 195M250 92V112"/>
    <path className="bottle-graphic-picks" d="M241 194L249 155M251 195L255 160M266 193L262 155"/>
    <path className="bottle-graphic-falling" d="M255 14L251 42"/>
    <ellipse className="bottle-graphic-rim" cx="253" cy="78" rx="15" ry="5"/>
    <circle className="bottle-graphic-ripple" cx="253" cy="80" r="15"/>
    <path className="bottle-graphic-spark" d="M194 59V73M187 66H201M329 115V125M324 120H334"/>
    <path className="bottle-graphic-spares" d="M322 201L344 186M327 205L353 196M322 208L347 210"/>
  </svg>;
}
