import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import useApi from '../hooks/useApi';
import FoodBrowser from '../components/FoodBrowser';
import EmptyState from '../components/EmptyState';
import { LayoutGrid } from 'lucide-react';

export default function CategoryPage() {
  const { slug } = useParams();
  const { data, loading } = useApi('/categories');
  const fixed = useMemo(() => ({ category: slug }), [slug]);
  const cat = data && data.categories.find((c) => c.slug === slug);
  if (!loading && data && !cat) {
    return (
      <div className="container page">
        <EmptyState icon={LayoutGrid} title="Category not found" message="That category does not exist." action={<Link className="btn btn--primary" to="/categories">All categories</Link>} />
      </div>
    );
  }
  return (
    <div className="container page">
      <nav aria-label="Breadcrumb" className="muted crumbs"><Link to="/categories">Categories</Link> / <span>{cat ? cat.name : slug}</span></nav>
      <div className="page-head"><h1>{cat ? cat.name : 'Loading...'}</h1>{cat ? <p className="muted">{cat.description}</p> : null}</div>
      <FoodBrowser key={slug} fixed={fixed} searchPlaceholder={`Search in ${cat ? cat.name : 'this category'}`} />
    </div>
  );
}
