// Kafelek z ikoną na karcie miejsca: nożyczki i łapka (groomer), krzyż (weterynarz), domek z łapką (hotel)
export default function PlaceTile({ kind = 'salon', category = 'groomer' }) {
  if (category === 'weterynarz') {
    return (
      <span className="place-tile" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="#00716d" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="22" width="48" height="32" rx="8" />
          <path d="M24 22v-4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" />
          <path fill="#00a39e" stroke="none" d="M28 31h8v5h5v8h-5v5h-8v-5h-5v-8h5z" />
          {kind === 'mobilny' && <path d="M8 60h48" />}
        </svg>
      </span>
    );
  }
  if (category === 'hotel') {
    return (
      <span className="place-tile" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="#9a4a14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 30 32 8l26 22" />
          <path d="M12 27v27h40V27" />
          <g fill="#e07a2f" stroke="none">
            <ellipse cx="32" cy="43" rx="7" ry="5.5" />
            <circle cx="24.5" cy="35.5" r="2.8" />
            <circle cx="30" cy="31.5" r="2.9" />
            <circle cx="36.500" cy="32" r="2.8" />
            <circle cx="41" cy="37.500" r="2.7" />
          </g>
        </svg>
      </span>
    );
  }
  return (
    <span className="place-tile" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none" stroke="#9a4a14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="48" r="6" />
        <circle cx="30" cy="52" r="5" />
        <path d="M20 43 44 12M33 48 48 22" />
        {kind === 'mobilny' && <path d="M8 60h48" />}
        <g fill="#e07a2f" stroke="none">
          <ellipse cx="46" cy="46" rx="7" ry="5.5" />
          <circle cx="38.5" cy="38.5" r="2.8" />
          <circle cx="44" cy="34.5" r="2.9" />
          <circle cx="50.5" cy="35" r="2.8" />
          <circle cx="55" cy="40.5" r="2.7" />
        </g>
      </svg>
    </span>
  );
}
