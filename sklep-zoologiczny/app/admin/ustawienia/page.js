import { getSettings } from '@/lib/settings';
import SettingsForm from './SettingsForm';

export const metadata = { title: 'Ustawienia sklepu' };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <h1>Ustawienia sklepu</h1>
      {!settings.id && (
        <p className="alert">
          Brak tabeli ustawień w bazie. Uruchom w Supabase plik supabase/01_ustawienia.sql.
        </p>
      )}
      <SettingsForm settings={settings} />
    </>
  );
}
