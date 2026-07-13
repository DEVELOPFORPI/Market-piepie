const VIEWER_ID_KEY = 'marketpiepie_anonymous_viewer_id_v1';

export function getAnonymousViewerId(): string {
  try {
    const saved = localStorage.getItem(VIEWER_ID_KEY);
    if (saved) return saved;

    const id =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `viewer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VIEWER_ID_KEY, id);
    return id;
  } catch {
    return `viewer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}
