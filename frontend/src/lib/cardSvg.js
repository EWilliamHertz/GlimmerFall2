import { FACTIONS, CARDBACK, factionCfg } from "@/lib/factions";

// 69 x 94 mm bleed artboard (63x88 trim + 3mm bleed) at 10 units/mm
export const BLEED_W = 690;
export const BLEED_H = 940;

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const wrap = (text, max) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
};

export async function toDataURL(url) {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return url; // fall back to remote href
  }
}

export function buildCardSVG(card, imgHref) {
  const f = factionCfg(card.faction);
  const type = card.card_type || card.cardType;
  const isEntity = type === "Entity";
  const kws = (card.keywords && card.keywords !== "None" ? String(card.keywords).split(",") : []).map((k) => k.trim()).filter(Boolean);
  const lines = wrap(card.description, 42);
  const W = BLEED_W, H = BLEED_H;

  const kwSvg = kws
    .slice(0, 3)
    .map((k, i) => `<g transform="translate(30,${330 + i * 44})"><rect width="${18 + k.length * 12}" height="34" rx="6" fill="${f.color}"/><text x="8" y="24" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#000">${esc(k)}</text></g>`)
    .join("");

  const descSvg = lines
    .map((l, i) => `<text x="34" y="${792 + i * 26}" font-family="Arial, sans-serif" font-size="21" fill="#f2f2f5">${esc(l)}</text>`)
    .join("");

  const phSvg = isEntity && card.power != null && card.power !== "None"
    ? `<g transform="translate(${W - 158},${H - 78})">
         <rect width="124" height="52" rx="8" fill="${f.color}" stroke="#000" stroke-width="4"/>
         <text x="62" y="37" text-anchor="middle" font-family="Arial" font-size="32" font-weight="800" fill="#000">${esc(card.power)} / ${esc(card.health)}</text>
       </g>`
    : "";

  const typeLabel = `${card.faction} - ${type}`.toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="69mm" height="94mm" viewBox="0 0 ${W} ${H}">
  <defs><clipPath id="rc"><rect x="0" y="0" width="${W}" height="${H}" rx="26"/></clipPath></defs>
  <g clip-path="url(#rc)">
    <image xlink:href="${imgHref}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="540" width="${W}" height="${H - 540}" fill="${f.color}" opacity="0.16"/>
    <rect x="0" y="690" width="${W}" height="${H - 690}" fill="#06070C" opacity="0.68"/>
    <text x="34" y="726" font-family="Georgia, serif" font-size="34" font-weight="700" fill="${f.soft}">${esc(card.name)}</text>
    <g transform="translate(34,740)"><rect width="${24 + typeLabel.length * 12}" height="30" rx="5" fill="${f.color}"/><text x="9" y="22" font-family="Arial" font-size="19" font-weight="700" fill="#000">${esc(typeLabel)}</text></g>
    ${descSvg}
    ${kwSvg}
    <circle cx="74" cy="74" r="48" fill="${f.color}" stroke="#000" stroke-width="6"/>
    <text x="74" y="92" text-anchor="middle" font-family="Arial" font-size="52" font-weight="800" fill="#000">${esc(card.cost)}</text>
    ${phSvg}
  </g>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="26" fill="none" stroke="${f.color}" stroke-width="4"/>
</svg>`;
}

export function buildBackSVG(imgHref) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="69mm" height="94mm" viewBox="0 0 ${BLEED_W} ${BLEED_H}">
  <image xlink:href="${imgHref}" x="0" y="0" width="${BLEED_W}" height="${BLEED_H}" preserveAspectRatio="xMidYMid slice"/>
</svg>`;
}

export { CARDBACK };
