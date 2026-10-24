import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import '../css/section.css';

export default function SectionHeader({ title, subtitle, to, linkLabel = 'See all', id }) {
  return (
    <div className="sec-head">
      <div>
        <h2 id={id} className="sec-head__title">{title}</h2>
        {subtitle ? <p className="sec-head__sub muted">{subtitle}</p> : null}
      </div>
      {to ? (
        <Link to={to} className="sec-head__link">
          {linkLabel} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
