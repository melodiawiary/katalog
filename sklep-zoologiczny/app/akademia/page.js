import AcademyForm from '@/components/AcademyForm';

export const metadata = {
  title: 'Akademia: kursy pielęgnacji psów i kotów',
  description: 'Zapisz się na listę chętnych na kursy pielęgnacji psów i kotów. Damy znać o terminach.',
};

export default function AcademyPage() {
  return (
    <div className="academy-box" style={{ maxWidth: 560, margin: '24px auto' }}>
      <h1>Akademia</h1>
      <p>Kursy pielęgnacji psów i kotów: dla właścicieli, którzy chcą radzić sobie sami, i dla przyszłych groomerów. Zapisz się na listę, a damy znać o terminach. Zapis do niczego nie zobowiązuje.</p>
      <AcademyForm />
    </div>
  );
}
