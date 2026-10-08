import { Search, Sparkles } from 'lucide-react';
export function Preview() {
  return <div className="rr-preview"><div className="rr-preview-seals"><span><Search size={25}/> REAL?</span><span><Sparkles size={25}/> REALLY?</span></div><strong>Somebody<br/>made <em>that?</em></strong><span>2 documented inventions · 1 fictional pitch</span><div className="rr-preview-letters" aria-hidden="true"><b>A</b><b>B</b><b>C</b></div></div>;
}
