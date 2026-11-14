// Gwiazdki oceny (tylko wygląd). value: 0-5, także ułamki (zaokrąglane do pełnych gwiazdek)
export default function Stars({ value, size = '1em' }) {
  const full = Math.round(Number(value) || 0);
  return (
    <span className="stars" role="img" aria-label={`Ocena ${Number(value).toFixed(1).replace('.', ',')} na 5`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= full ? 'star on' : 'star'}>★</span>)}
    </span>
  );
}
