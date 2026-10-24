import { Link, useNavigate } from 'react-router-dom';
import { Bike, Clock, ShieldCheck, Smartphone, Sparkles, Star, Store, Search } from 'lucide-react';
import useApi from '../hooks/useApi';
import SectionHeader from '../components/SectionHeader';
import Carousel from '../components/Carousel';
import FoodCard from '../components/FoodCard';
import FoodImage from '../components/FoodImage';
import RestaurantCard from '../components/RestaurantCard';
import PromoBanner from '../components/PromoBanner';
import NewsletterForm from '../components/NewsletterForm';
import { CardSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { rupee } from '../utils/format';
import '../css/home.css';

const FEATURES = [
  { icon: Clock, title: 'Fast delivery', text: 'Hot food from nearby kitchens in about 30 minutes.' },
  { icon: Bike, title: 'Live tracking', text: 'Follow your order from the kitchen to your door.' },
  { icon: ShieldCheck, title: 'Safe payments', text: 'Cash on delivery, Razorpay test mode or a clearly labelled demo payment.' },
];

function Hero({ data }) {
  const navigate = useNavigate();
  const shots = [...(data.bestsellers || []), ...(data.recommended || [])].filter((f) => f.image).slice(0, 3);
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="hero__eyebrow"><Sparkles size={16} aria-hidden="true" /> {data.stats ? `${data.stats.dishes}+ dishes from ${data.stats.restaurants} restaurants` : 'Fresh food, delivered'}</span>
          <h1 id="hero-title">Food you love,<br />at your door <span>in minutes.</span></h1>
          <p className="hero__lead">Pizza, biryani, dosas, burgers and more from the best kitchens around you. Order in a few taps and track every step.</p>
          <div className="row row--wrap">
            <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate('/food')}><Search size={18} aria-hidden="true" /> Order now</button>
            <Link to="/restaurants" className="btn btn--ghost btn--lg"><Store size={18} aria-hidden="true" /> Browse restaurants</Link>
          </div>
          <ul className="hero__feat">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title}><Icon size={20} aria-hidden="true" /><span><strong>{title}</strong><small className="muted"> {text}</small></span></li>
            ))}
          </ul>
        </div>
        <div className="hero__art">
  {shots.length > 0 ? (
    shots.map((f, i) => (
      <Link
        key={f.id}
        to={`/food/${f.id}`}
        className={`hero__shot hero__shot--${i + 1}`}
        aria-label={`${f.name}, ${rupee(f.unitPrice)}`}
      >
        <FoodImage
          src={f.image}
          alt={f.name}
          ratio="1 / 1"
          label={f.name}
          eager
        />

        <span className="hero__chip">
          {f.name} <b>{rupee(f.unitPrice)}</b>
        </span>
      </Link>
    ))
  ) : (
    <div className="hero__visual">
      <div className="hero__visual-glow" />

      <div className="hero__visual-badge hero__visual-badge--top">
        <span className="hero__badge-icon">★</span>
        <span>
          <strong>Fresh & delicious</strong>
          <small>Made for your cravings</small>
        </span>
      </div>

      <img
  className="hero__main-image"
  src="/images/hero-food.png"
  alt="Delicious food available on FoodieExpress"
  fetchpriority="high"
/>

      <div className="hero__visual-badge hero__visual-badge--bottom">
        <span className="hero__delivery-icon">↗</span>
        <span>
          <strong>Delivered with care</strong>
          <small>Order your favourites today</small>
        </span>
      </div>
    </div>
  )}
</div>
      </div>
    </section>
  );
}

function FoodRow({ id, title, subtitle, foods, to }) {
  if (!foods || foods.length === 0) return null;
  return (
    <section className="home-sec" aria-labelledby={id}>
      <div className="container">
        <SectionHeader id={id} title={title} subtitle={subtitle} to={to} />
        <Carousel label={title}>
          {foods.map((f) => <FoodCard key={f.id} food={f} />)}
        </Carousel>
      </div>
    </section>
  );
}

export default function Home() {
  const { data, loading, error, reload } = useApi('/home');

  if (loading && !data) {
    return (<div className="container page"><CardSkeleton count={8} /></div>);
  }
  if (error) {
    return (
      <div className="container page">
        <EmptyState icon={Store} title="We could not load the homepage" message={error} action={<button type="button" className="btn btn--primary" onClick={reload}>Try again</button>} />
      </div>
    );
  }
  const d = data;
  return (
    <>
      <Hero data={d} />

      {d.coupons && d.coupons.length > 0 ? (
        <section className="home-sec" aria-labelledby="offers-title">
          <div className="container">
            <SectionHeader id="offers-title" title="Offers for you" subtitle="Tap a code to copy it, then paste it in your cart." />
            <div className="promo-grid">{d.coupons.slice(0, 3).map((c) => <PromoBanner key={c.code} coupon={c} />)}</div>
          </div>
        </section>
      ) : null}

      <section className="home-sec" aria-labelledby="cats-title">
        <div className="container">
          <SectionHeader id="cats-title" title="What are you craving?" to="/categories" linkLabel="All categories" />
          <Carousel label="Food categories" itemWidth={150}>
            {d.categories.map((c) => (
              <Link key={c.id} to={`/category/${c.slug}`} className="cat-tile">
                <FoodImage src={c.image} alt={`${c.name} dishes`} ratio="1 / 1" label={c.name} className="cat-tile__img" />
                <span>{c.name}</span>
              </Link>
            ))}
          </Carousel>
        </div>
      </section>

      <section className="home-sec" aria-labelledby="pop-title">
        <div className="container">
          <SectionHeader id="pop-title" title="Popular restaurants" subtitle="Top rated kitchens near you" to="/restaurants" />
          <Carousel label="Popular restaurants" itemWidth={300}>
            {d.popularRestaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
          </Carousel>
        </div>
      </section>

      <FoodRow id="best-title" title="Bestselling dishes" subtitle="What everyone is ordering" foods={d.bestsellers} to="/food?bestseller=true" />
      <FoodRow id="rec-title" title="Recommended for you" subtitle="Highly rated by other customers" foods={d.recommended} to="/food?sort=rating" />
      <FoodRow id="veg-title" title="Pure vegetarian" subtitle="Fresh, flavourful and meat-free" foods={d.vegetarian} to="/food?diet=veg" />
      <FoodRow id="deal-title" title="Today's special offers" subtitle="Limited-time discounts on popular dishes" foods={d.offers} to="/food?discount=true" />

      {d.reviews && d.reviews.length > 0 ? (
        <section className="home-sec home-sec--tint" aria-labelledby="rev-title">
          <div className="container">
            <SectionHeader id="rev-title" title="Loved by customers" subtitle="Recent reviews from real orders" />
            <div className="rev-grid">
              {d.reviews.slice(0, 6).map((r) => (
                <figure key={r.id} className="rev">
                  <div className="rev__stars" aria-label={`${r.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={16} fill={i < r.rating ? '#f5a524' : 'none'} color="#f5a524" aria-hidden="true" />)}</div>
                  <blockquote>{r.comment}</blockquote>
                  <figcaption><strong>{r.user}</strong>{r.restaurant ? <span className="muted"> on {r.restaurant}</span> : null}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="home-sec" aria-labelledby="app-title">
        <div className="container">
          <div className="app-promo">
            <div>
              <h2 id="app-title">Get FoodieExpress on your phone</h2>
              <p>FoodieExpress works as an installable web app: open the site on your phone, choose "Add to Home screen" and order in one tap. Native store apps are not available for this demo.</p>
              <div className="row row--wrap">
                <Link to="/register" className="btn btn--primary"><Smartphone size={18} aria-hidden="true" /> Create a free account</Link>
                <Link to="/help" className="btn btn--ghost">How it works</Link>
              </div>
            </div>
            <ul className="app-promo__list">
              <li>Live order tracking on a map</li>
              <li>Saved addresses and one-tap reorder</li>
              <li>Order updates in your notification centre</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="home-sec" aria-labelledby="news-title">
        <div className="container">
          <div className="news">
            <div>
              <h2 id="news-title">Get tasty deals in your inbox</h2>
              <p className="muted">New restaurants and offers, at most once a week. Unsubscribe anytime.</p>
            </div>
            <NewsletterForm idPrefix="home-nl" />
          </div>
        </div>
      </section>
    </>
  );
}
