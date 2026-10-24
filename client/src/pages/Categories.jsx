import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import useApi from '../hooks/useApi';
import FoodImage from '../components/FoodImage';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/Skeleton';
import '../css/home.css';

export default function Categories() {
  const { data, loading, error, reload } = useApi('/categories');
  return (
    <div className="container page">
      <div className="page-head"><h1>Food categories</h1><p className="muted">Pick a category to browse and filter every dish.</p></div>
      {error ? (
        <div className="alert alert--error" role="alert">{error} <button type="button" className="btn btn--sm btn--ghost" onClick={reload}>Try again</button></div>
      ) : loading ? <CardSkeleton count={10} /> : data.categories.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No categories yet" message="Check back soon." />
      ) : (
        <div className="grid cat-grid">
          {data.categories.map((c) => (
            <Link key={c.id} to={`/category/${c.slug}`} className="cat-card">
              <FoodImage src={c.image} alt={`${c.name} dishes`} ratio="4 / 3" label={c.name} />
              <div className="cat-card__body"><h2>{c.name}</h2><p className="muted">{c.description}</p><span className="badge badge--amber">{c.itemCount} dishes</span></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
