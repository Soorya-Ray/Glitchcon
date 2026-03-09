import { useState } from 'react';
import AuthModal from '../components/AuthModal';

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [defaultMode, setDefaultMode] = useState('login');
  const [defaultRole, setDefaultRole] = useState(null);

  function openLogin() {
    setDefaultMode('login');
    setDefaultRole(null);
    setAuthOpen(true);
  }

  function openCustomerRegister() {
    setDefaultMode('register');
    setDefaultRole('customer');
    setAuthOpen(true);
  }

  function openDriverRegister() {
    setDefaultMode('register');
    setDefaultRole('driver');
    setAuthOpen(true);
  }

  return (
    <div className="landing-page">
      <div className="landing-container">
        <section className="landing-navbar">
          <div className="landing-logo">EscrowPay</div>
          <div className="landing-nav-actions">
            <button className="btn btn-outline" onClick={openLogin}>Login</button>
            <button className="btn btn-primary" onClick={openCustomerRegister}>Get Started</button>
          </div>
        </section>

        <section className="landing-hero">
          <h1>Secure escrow payments for every delivery workflow.</h1>
          <p>Track orders, protect funds, and settle only when delivery is confirmed.</p>
          <div className="landing-hero-actions">
            <button className="btn btn-primary" onClick={openCustomerRegister}>Get Started as Customer</button>
            <button className="btn btn-outline" onClick={openDriverRegister}>Join as Driver</button>
          </div>
        </section>

        <section className="landing-how">
          <h2>How It Works</h2>
          <div className="landing-steps">
            <article className="landing-step">
              <span className="landing-step-badge">1</span>
              <h3>Place Order</h3>
              <p>Create your shipment request and lock funds into escrow.</p>
            </article>
            <article className="landing-step">
              <span className="landing-step-badge">2</span>
              <h3>Track Delivery</h3>
              <p>Assign drivers and monitor status updates in real time.</p>
            </article>
            <article className="landing-step">
              <span className="landing-step-badge">3</span>
              <h3>Confirm & Release Payment</h3>
              <p>Approve delivery and automatically release escrowed funds.</p>
            </article>
          </div>
        </section>

        <section className="landing-trust">
          <h2>Trusted by teams that move goods daily</h2>
          <div className="landing-testimonials">
            <article className="landing-testimonial-card">
              <p>"Payments held safely until delivery confirmed"</p>
              <span>— Arjun M., Customer</span>
            </article>
            <article className="landing-testimonial-card">
              <p>"Fair dispute resolution, fast payouts"</p>
              <span>— Ravi K., Driver</span>
            </article>
            <article className="landing-testimonial-card">
              <p>"Full audit trail on every order"</p>
              <span>— TransCo Logistics, Supplier</span>
            </article>
          </div>
        </section>

        <footer className="landing-footer">© 2025 EscrowPay. All rights reserved.</footer>
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultMode={defaultMode}
        defaultRole={defaultRole}
      />
    </div>
  );
}
