import type { ReactNode } from 'react';
import type { Product } from './types';

const drawings: Record<Product['illustration'], ReactNode> = {
  stapler: <><path d="M30 103h139v18H30z"/><path d="m30 91 8-33 130 28-4 17Z"/><path d="m42 66 107 23"/><circle cx="42" cy="98" r="7"/></>,
  umbrella: <><path d="M28 66a72 52 0 0 1 144 0q-18-18-36 0-18-18-36 0-18-18-36 0-18-18-36 0Z"/><path d="M100 15v106q0 21-20 21-14 0-14-14M100 18Q71 34 64 66M100 18q29 16 36 48"/></>,
  notes: <><path d="M44 28h110v83l-31 27H44Z"/><path d="M154 111h-31v27M57 42h81M64 67h63M64 87h47"/></>,
  lunchbox: <><rect x="31" y="47" width="138" height="86" rx="16"/><path d="M71 47V30q0-9 9-9h40q9 0 9 9v17M31 72h138M54 83v35M142 83v35"/><rect x="87" y="64" width="26" height="17" rx="4"/></>,
  band: <><ellipse cx="100" cy="75" rx="75" ry="41" transform="rotate(-16 100 75)"/><ellipse cx="100" cy="75" rx="66" ry="30" transform="rotate(-16 100 75)"/></>,
  torch: <><path d="m48 38 96 43-17 37-96-43Z"/><path d="m126 72 23-12 20 9-27 59-20-9-4-27M48 39 32 74"/><path d="m168 55 13-14m-3 51h16m-36 45 7 13"/></>,
  tape: <><ellipse cx="87" cy="69" rx="49" ry="47"/><ellipse cx="87" cy="69" rx="23" ry="22"/><path d="M41 82q11 42 64 40h54l17-26h-52"/></>,
  comb: <><rect x="27" y="49" width="147" height="18" rx="6"/><path d="M35 67v38m12-38v38m12-38v38m12-38v38m12-38v38m12-38v38m12-38v38m12-38v38m12-38v38m12-38v38m12-38v38m12-38v38"/></>,
  key: <><circle cx="62" cy="62" r="33"/><circle cx="62" cy="62" r="11"/><path d="m85 85 63 46 18-23-14-11-11 14-13-10 11-14-31-23"/></>,
  bottle: <><rect x="83" y="13" width="34" height="19" rx="4"/><path d="M83 32v15q-19 11-19 26v56q0 11 11 11h50q11 0 11-11V73q0-15-19-26V32Z"/><path d="M64 85h72M64 112h72"/></>,
  peg: <><path d="m57 23 34-4 54 108-26 12-39-72-7 1-12 66-27-5Z"/><path d="m71 43 53 87M79 80l-37 45"/><circle cx="80" cy="66" r="12"/><path d="M69 66h22"/></>,
  whisk: <><path d="m94 88-7 53h20l-7-53"/><ellipse cx="97" cy="53" rx="37" ry="39"/><ellipse cx="97" cy="53" rx="20" ry="39"/><path d="M97 14v78"/></>,
};
export function ProductPicture({ product }: { product: Product }) {
  return <svg viewBox="0 0 200 155" role="img" aria-label={product.name} className="pid-product-picture"><g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">{drawings[product.illustration]}</g></svg>;
}
