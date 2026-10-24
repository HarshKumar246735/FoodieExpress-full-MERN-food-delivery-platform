import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import NewsletterForm from '../components/NewsletterForm';
import '../css/static.css';

const PAGES = {
  about: {
    title: 'About FoodieExpress',
    lead: 'FoodieExpress is a demonstration food delivery platform built to show a complete ordering flow.',
    sections: [
      ['What it is', 'Customers browse restaurants and dishes, build a cart, pay with cash on delivery, Razorpay test mode or a simulated demo payment, and follow the order live. Restaurant owners, delivery partners and administrators each have their own dashboard.'],
      ['What it is not', 'Restaurants, menus, prices and addresses are illustrative demo data. No real payments are processed and no real food is delivered.'],
    ],
  },
  help: {
    title: 'Help centre',
    lead: 'Quick answers to common questions.',
    sections: [
      ['How do I place an order?', 'Add dishes to your cart (all items must come from one restaurant), open the cart, apply a coupon if you have one, then continue to checkout and confirm.'],
      ['How do I pay?', 'Choose Cash on Delivery, Razorpay (test mode, when configured) or the clearly labelled DEMO PAYMENT, where you can simulate a successful, failed or cancelled payment.'],
      ['Can I cancel an order?', 'Yes, until the restaurant starts preparing it. Open My orders, choose the order and select Cancel order.'],
      ['Something went wrong with my order', <>Use <Link to="/support">Report a problem</Link> and our team will respond.</>],
    ],
  },
  contact: {
    title: 'Contact us',
    lead: 'We would love to hear from you.',
    sections: [
      ['Customer support', <>Email <a href="mailto:support@foodieexpress.demo">support@foodieexpress.demo</a> or call <a href="tel:+918000000000">+91 80000 00000</a> (10am - 10pm). For an order issue, <Link to="/support">submit a complaint</Link> so it is linked to your account.</>],
      ['Address', 'FoodieExpress Demo Office, MG Road, Bengaluru, Karnataka 560001 (illustrative).'],
    ],
  },
  terms: {
    title: 'Terms of use',
    lead: 'These terms apply to this demonstration application.',
    sections: [
      ['Demo only', 'FoodieExpress is a demo. Payments run in test or simulated mode and no goods are delivered.'],
      ['Your account', 'Keep your password private. You are responsible for activity on your account.'],
      ['Acceptable use', 'Do not attempt to disrupt the service, access other users\' data or submit abusive content.'],
    ],
  },
  privacy: {
    title: 'Privacy policy',
    lead: 'How this demo handles your data.',
    sections: [
      ['What we store', 'Your name, email, phone, saved addresses, orders and notifications are stored in the application database. Passwords are stored only as salted hashes.'],
      ['Cookies', 'A secure HTTP-only cookie keeps you signed in. A local cart is kept in your browser if you are not signed in.'],
      ['Payments', 'We never see or store card details. Razorpay test mode and the demo payment do not move real money.'],
    ],
  },
  careers: {
    title: 'Careers',
    lead: 'Join the team building the future of food delivery.',
    sections: [
      ['Open roles', 'This is a demonstration site, so there are no live vacancies. Interested anyway? Subscribe below and we will let you know when roles open.'],
    ],
    newsletter: true,
  },
  partner: {
    title: 'Partner with us',
    lead: 'Grow your restaurant or deliver with FoodieExpress.',
    sections: [
      ['Restaurants', <>Restaurant owner accounts are created by the platform team so each restaurant can be approved before it goes live. Contact <a href="mailto:partners@foodieexpress.demo">partners@foodieexpress.demo</a>. To explore the owner dashboard, use the demo owner account listed in the README.</>],
      ['Delivery partners', 'Delivery partner accounts are also created by the platform team. You can go online or offline, accept nearby deliveries and track your earnings.'],
      ['Customers', <>Just want to order? <Link to="/register">Create a free account</Link>.</>],
    ],
  },
};

export default function StaticPage({ slug }) {
  const p = PAGES[slug] || PAGES.about;
  useEffect(() => { document.title = `${p.title} - FoodieExpress`; return () => { document.title = 'FoodieExpress - Food delivery, done properly'; }; }, [p.title]);
  return (
    <div className="container page static">
      <h1>{p.title}</h1>
      <p className="static__lead">{p.lead}</p>
      {p.sections.map(([h, body]) => (
        <section key={h}><h2>{h}</h2><p>{body}</p></section>
      ))}
      {p.newsletter ? <NewsletterForm idPrefix={`static-${slug}`} buttonLabel="Notify me" /> : null}
    </div>
  );
}
