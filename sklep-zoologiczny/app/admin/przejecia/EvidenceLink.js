'use client';

import { useState } from 'react';
import { evidenceUrl } from './actions';

export default function EvidenceLink({ path }) {
  const [err, setErr] = useState('');
  const open = async () => {
    const url = await evidenceUrl(path);
    if (url) window.open(url, '_blank', 'noopener'); else setErr('Nie udało się otworzyć pliku (może został już usunięty).');
  };
  return (
    <>
      <button type="button" className="link-btn" onClick={open}>Zobacz zdjęcie dowodowe</button>
      {err && <span className="small warn"> {err}</span>}
    </>
  );
}
