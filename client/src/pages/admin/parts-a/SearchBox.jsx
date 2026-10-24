import { Search } from 'lucide-react';

export default function SearchBox({ value, onChange, placeholder = 'Search', label = 'Search' }) {
  return (
    <div className="toolbar__grow adm-search">
      <Search size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor={`adm-s-${label}`}>{label}</label>
      <input id={`adm-s-${label}`} type="search" className="input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
