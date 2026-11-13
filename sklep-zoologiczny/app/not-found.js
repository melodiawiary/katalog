import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="center">
      <h1>Nie znaleziono strony</h1>
      <Link href="/" className="btn">Wróć do sklepu</Link>
    </div>
  );
}
