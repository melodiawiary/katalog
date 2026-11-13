'use client';

import { useEffect, useRef, useState } from 'react';

// Galeria na karcie produktu: przesuwanie palcem (telefon), miniatury i strzałki (komputer),
// powiększenie po kliknięciu (Esc / strzałki na klawiaturze).
export default function Gallery({ images, name, emoji = '🐾' }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(null);
  const touch = useRef(null);

  function go(i) {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(i, images.length - 1));
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    setIndex(n);
  }

  function onScroll() {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  useEffect(() => {
    if (zoom == null) return;
    document.body.classList.add('no-scroll');
    function key(e) {
      if (e.key === 'Escape') setZoom(null);
      if (e.key === 'ArrowRight') setZoom((z) => Math.min(z + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setZoom((z) => Math.max(z - 1, 0));
    }
    window.addEventListener('keydown', key);
    return () => {
      document.body.classList.remove('no-scroll');
      window.removeEventListener('keydown', key);
    };
  }, [zoom, images.length]);

  if (images.length === 0) {
    return (
      <div className="gallery">
        <div className="product-img placeholder gallery-empty" aria-hidden="true">{emoji}</div>
      </div>
    );
  }

  const many = images.length > 1;

  return (
    <div className="gallery">
      <div className="gallery-main">
        <div className="gallery-track" ref={track} onScroll={onScroll}>
          {images.map((img, i) => (
            <button key={img.url + i} type="button" className="gallery-slide" onClick={() => setZoom(i)}
              aria-label={`Powiększ zdjęcie ${i + 1} z ${images.length}`}>
              <img src={img.url} alt={img.alt || (i === 0 ? name : `${name} - zdjęcie ${i + 1}`)}
                loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : undefined} />
            </button>
          ))}
        </div>
        {many && (
          <>
            <button type="button" className="gallery-arrow prev desktop-only" onClick={() => go(index - 1)}
              disabled={index === 0} aria-label="Poprzednie zdjęcie">‹</button>
            <button type="button" className="gallery-arrow next desktop-only" onClick={() => go(index + 1)}
              disabled={index === images.length - 1} aria-label="Następne zdjęcie">›</button>
            <div className="gallery-dots mobile-only" aria-hidden="true">
              {images.map((_, i) => <span key={i} className={i === index ? 'on' : ''} />)}
            </div>
          </>
        )}
      </div>
      {many && (
        <div className="gallery-thumbs desktop-only">
          {images.map((img, i) => (
            <button key={img.url + i} type="button" className={i === index ? 'on' : ''} onClick={() => go(i)}
              aria-label={`Zdjęcie ${i + 1}`}>
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {zoom != null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={() => setZoom(null)}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX);
            if (Math.abs(dx) > 50) setZoom((z) => Math.max(0, Math.min(z + (dx < 0 ? 1 : -1), images.length - 1)));
          }}>
          <img src={images[zoom].url} alt={images[zoom].alt || name} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lightbox-close" onClick={() => setZoom(null)} aria-label="Zamknij">×</button>
          {many && (
            <>
              <button type="button" className="lightbox-arrow prev" disabled={zoom === 0}
                onClick={(e) => { e.stopPropagation(); setZoom(zoom - 1); }} aria-label="Poprzednie">‹</button>
              <button type="button" className="lightbox-arrow next" disabled={zoom === images.length - 1}
                onClick={(e) => { e.stopPropagation(); setZoom(zoom + 1); }} aria-label="Następne">›</button>
              <span className="lightbox-count">{zoom + 1} / {images.length}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
