import FoodBrowser from '../components/FoodBrowser';

const FIXED = {};
export default function FoodListing() {
  return (
    <div className="container page">
      <div className="page-head"><h1>All dishes</h1><p className="muted">Search and filter across every restaurant.</p></div>
      <FoodBrowser fixed={FIXED} />
    </div>
  );
}
