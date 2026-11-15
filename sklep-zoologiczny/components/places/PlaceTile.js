// Kafelek z ikoną na karcie salonu (nożyczki i łapka na brzoskwiniowym tle)
export default function PlaceTile({ kind = 'salon' }) {
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
