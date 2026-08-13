export type TransitionKind =
  | 'none'
  | 'fade'
  | 'stack-in'
  | 'stack-out'
  | 'sheet-in'
  | 'sheet-out';

const TAB_ROOTS = new Set(['/', '/search', '/community', '/chat', '/my']);

function isNone(path: string): boolean {
  return (
    path === '/welcome' ||
    path === '/signup' ||
    path === '/login-app' ||
    path === '/login' ||
    path === '/admin-auth' ||
    path === '/admin' ||
    path.startsWith('/admin/')
  );
}

function isTab(path: string): boolean {
  return TAB_ROOTS.has(path);
}

function isSheet(path: string): boolean {
  return (
    path === '/register' ||
    path.startsWith('/register/') ||
    path === '/community/write' ||
    path.startsWith('/community/edit/') ||
    path === '/inquiry'
  );
}

function depth(path: string): number {
  if (isNone(path) || isTab(path)) return 0;
  if (path.startsWith('/notices/')) return 2;
  if (isSheet(path)) return 2;
  if (
    path.startsWith('/offer/') ||
    path.startsWith('/review/') ||
    path.startsWith('/dispute/') ||
    path.startsWith('/meetup/') ||
    path.startsWith('/receive/')
  ) {
    return 2;
  }
  return 1;
}

export function resolveTransition(from: string, to: string): TransitionKind {
  if (from === to) return 'none';
  if (isNone(from) || isNone(to)) return 'none';
  if (isTab(from) && isTab(to)) return 'fade';

  const fromSheet = isSheet(from);
  const toSheet = isSheet(to);
  const fromDepth = depth(from);
  const toDepth = depth(to);

  if (toSheet && toDepth >= fromDepth) return 'sheet-in';
  if (fromSheet && toDepth < fromDepth) return 'sheet-out';
  if (toDepth >= fromDepth) return 'stack-in';
  return 'stack-out';
}

export function transitionMs(kind: TransitionKind): number {
  if (kind === 'none') return 0;
  if (kind === 'fade') return 200;
  if (kind === 'sheet-in' || kind === 'sheet-out') return 400;
  return 340;
}
