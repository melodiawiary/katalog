'use client';

import { OPEN_EVENT } from '@/lib/consent';

export default function CookieSettingsLink() {
  return (
    <button type="button" className="link-btn" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Ustawienia cookies
    </button>
  );
}
