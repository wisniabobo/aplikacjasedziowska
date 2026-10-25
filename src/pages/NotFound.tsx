import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';

export default function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Nie ma takiej strony" />
      <p className="muted">Adres mógł się zmienić. Wróć na stronę główną.</p>
      <Link to="/" className="btn primary">
        Strona główna
      </Link>
    </div>
  );
}
