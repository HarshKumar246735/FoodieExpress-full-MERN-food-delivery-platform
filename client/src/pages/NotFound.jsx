import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function NotFound() {
  return (
    <div className="container page">
      <EmptyState icon={Compass} title="Page not found" message="The page you are looking for does not exist or has moved." action={<div className="row"><Link to="/" className="btn btn--primary">Go home</Link><Link to="/restaurants" className="btn btn--ghost">Browse restaurants</Link></div>} />
    </div>
  );
}
