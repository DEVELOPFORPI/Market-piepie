/** public/Batch/*.svg shared canvas size (matches file width/height) */
export const ACTIVITY_BADGE_SVG_SIZE_PX = 84;

/** Maps public/Batch/01.svg ~ 14.svg to on-screen badge names and Pi unlock price */
export const ACTIVITY_BADGE_DEFINITIONS = [
  { id: '01', label: 'First deal', pricePi: 15 },
  { id: '02', label: 'Chat starter', pricePi: 75 },
  { id: '03', label: 'Word of mouth', pricePi: 150 },
  { id: '04', label: 'First stroke', pricePi: 10 },
  { id: '05', label: 'Wordsmith', pricePi: 50 },
  { id: '06', label: 'Power writer', pricePi: 100 },
  { id: '07', label: 'Sharing newbie', pricePi: 12 },
  { id: '08', label: 'Warm hands', pricePi: 60 },
  { id: '09', label: 'Kind neighbor', pricePi: 120 },
  { id: '10', label: 'Sharing angel', pricePi: 180 },
  { id: '11', label: 'Giveaway champ', pricePi: 240 },
  { id: '12', label: 'Badge rookie', pricePi: 80 },
  { id: '13', label: 'Badge fan', pricePi: 200 },
  { id: '14', label: 'Excitement alert', pricePi: 10 },
] as const;

export type ActivityBadgeId = (typeof ACTIVITY_BADGE_DEFINITIONS)[number]['id'];

export function getActivityBadgePricePi(id: string): number | null {
  const found = ACTIVITY_BADGE_DEFINITIONS.find((b) => b.id === id);
  return found ? found.pricePi : null;
}
