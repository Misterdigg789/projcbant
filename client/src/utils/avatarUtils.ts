// Static avatar files available
const AVATAR_FILES = [
  'bantah-guys-2-2d (1).png',
  'bantah-guys-2-2d 1.png',
  'bantah-guys-2-2d 2.png',
  'bantah-guys-2-2d 3.png',
  'bantah-guys-avatar (1).png',
  'bantah-guys-avatar 1.png',
  'bantah-guys-avatar 1.svg',
  'bantah-guys-avatar 2.png',
  'bantah-guys-avatar 3.png',
  'bantah-guys-avatar 4.png',
  'bantah-guys-avatar 5.svg',
  'bantah-guys-avatar 6 (1).svg',
  'bantah-guys-avatar 6.svg'
];

export const generateAvatar = (seed: string, size: number = 128) => {
  // Simple hash function to select avatar based on seed
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % AVATAR_FILES.length;
  return `/assets/avatar/${AVATAR_FILES[index]}`;
};

export function getAvatarUrl(userId: string, username?: string, size: number = 128): string {
  const seed = userId || username || 'default';
  return generateAvatar(seed, size);
}