import { Link } from 'react-router-dom';
import { Mail, Phone, UtensilsCrossed } from 'lucide-react';
import '../css/footer.css';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="container">
        <div className="foot__grid">
          <div className="foot__brand">
            <Link to="/" className="nav__brand"><span className="nav__logo" aria-hidden="true"><UtensilsCrossed size={20} /></span><span className="nav__name">Foodie<b>Express</b></span></Link>
            <p>Order from local restaurants, track your delivery live and pay your way. FoodieExpress is a demo platform: payments run in test or simulated mode only.</p>
          </div>
          <nav aria-label="Explore">
            <h3>Explore</h3>
            <ul>
              <li><Link to="/restaurants">Restaurants</Link></li>
              <li><Link to="/categories">Food categories</Link></li>
              <li><Link to="/food?bestseller=true">Bestsellers</Link></li>
              <li><Link to="/food?diet=veg">Vegetarian</Link></li>
              <li><Link to="/food?discount=true">Offers</Link></li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <h3>Company</h3>
            <ul>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/careers">Careers</Link></li>
              <li><Link to="/partner">Partner with us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </nav>
          <nav aria-label="Help">
            <h3>Help</h3>
            <ul>
              <li><Link to="/help">Help centre</Link></li>
              <li><Link to="/support">Report a problem</Link></li>
              <li><Link to="/terms">Terms of use</Link></li>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><a href="mailto:support@foodieexpress.demo"><Mail size={14} aria-hidden="true" /> support@foodieexpress.demo</a></li>
              <li><a href="tel:+918000000000"><Phone size={14} aria-hidden="true" /> +91 80000 00000</a></li>
            </ul>
          </nav>
        </div>
        <div className="foot__bottom">
          <span>&copy; {new Date().getFullYear()} FoodieExpress. Demo project: restaurants, prices and addresses are illustrative.</span>
          <span>Photos credited on each dish page where available.</span>
        </div>
      </div>
    </footer>
  );
}
