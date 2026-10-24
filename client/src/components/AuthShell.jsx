import FoodImage from './FoodImage';
import '../css/auth.css';

/** Two-column auth layout: form on the left, a food-photo panel on the right (hidden on mobile). */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__panel">
        <h1 className="auth__title">{title}</h1>
        {subtitle ? <p className="muted auth__sub">{subtitle}</p> : null}
        {children}
        {footer ? <div className="auth__footer">{footer}</div> : null}
      </div>
      <aside className="auth__aside" aria-hidden="true">
        <FoodImage className="auth__photo" ratio="4 / 5" eager label="FoodieExpress" src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=70" alt="" />
        <div className="auth__aside-text">
          <strong>Hot, fast, tracked.</strong>
          <span>Order from 15+ restaurants and follow your food live.</span>
        </div>
      </aside>
    </div>
  );
}
