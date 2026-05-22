/** public/Batch/*.svg shared canvas size (matches file width/height) */
export const ACTIVITY_BADGE_SVG_SIZE_PX = 84;

/** Maps public/Batch/01.svg ~ 14.svg to on-screen badge names */
export const ACTIVITY_BADGE_DEFINITIONS = [
  { id: '01', label: 'First deal' },
  { id: '02', label: 'Chat starter' },
  { id: '03', label: 'Word of mouth' },
  { id: '04', label: 'First stroke' },
  { id: '05', label: 'Wordsmith' },
  { id: '06', label: 'Power writer' },
  { id: '07', label: 'Sharing newbie' },
  { id: '08', label: 'Warm hands' },
  { id: '09', label: 'Kind neighbor' },
  { id: '10', label: 'Sharing angel' },
  { id: '11', label: 'Giveaway champ' },
  { id: '12', label: 'Badge rookie' },
  { id: '13', label: 'Badge fan' },
  { id: '14', label: 'Excitement alert' },
] as const;

export type ActivityBadgeId = (typeof ACTIVITY_BADGE_DEFINITIONS)[number]['id'];
