// Kafelek z ikoną na karcie miejsca: nożyczki i łapka (groomer), krzyż (weterynarz), domek z łapką (hotel)
export default function PlaceTile({ kind = 'salon', category = 'groomer' }) {
  if (category === 'spacerowicz') {
    return (
      <span className="place-tile" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="#9a4a14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 18c0-6 10-6 10 0v8c0 6 8 6 8 0" />
          <path d="M26 26c0 8 6 12 12 12" />
          <g fill="#e07a2f" stroke="none">
            <ellipse cx="42" cy="46" rx="9" ry="7" />
            <circle cx="32" cy="36.500" r="3.400" />
            <circle cx="39" cy="31.500" r="3.500" />
            <circle cx="47.500" cy="32" r="3.400" />
            <circle cx="53" cy="38" r="3.200" />
          </g>
        </svg>
      </span>
    );
  }
  if (category === 'behawiorysta') {
    return (
      <span className="place-tile" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="#12766c" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12h44a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H30l-12 10v-10h-8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" />
          <g fill="#1b9a8e" stroke="none">
            <ellipse cx="32" cy="32" rx="6.500" ry="5" />
            <circle cx="24.500" cy="25.500" r="2.600" />
            <circle cx="30" cy="21.500" r="2.700" />
            <circle cx="36" cy="21.500" r="2.700" />
            <circle cx="41" cy="25.500" r="2.600" />
          </g>
          {kind === 'mobilny' && <path d="M8 60h48" />}
        </svg>
      </span>
    );
  }
  if (category === 'trener') {
    return (
      <span className="place-tile" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="#4d2290" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 12 6 24l26 12 26-12z" fill="#7c3fcf" />
          <path d="M16 31v10c0 4 7 8 16 8s16-4 16-8V31" />
          <path d="M58 24v14" />
          {kind === 'mobilny' && <path d="M8 60h48" />}
        </svg>
      </span>
    );
  }
  if (category === 'petsitter') {
    return (
      <span className="place-tile" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none" stroke="#146428" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 30 32 8l26 22" />
          <path d="M12 27v27h40V27" />
          <path fill="#1f9a3d" stroke="none" d="M32 49c-8-5.500-12-9-12-13.500a6.500 6.500 0 0 1 12-3.300 6.500 6.500 0 0 1 12 3.300c0 4.500-4 8-12 13.500z" />
        </svg>
      </span>
    );
  }
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
