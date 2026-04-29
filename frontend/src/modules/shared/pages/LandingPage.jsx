import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Clock, Gift, Map, Car } from 'lucide-react';
import './LandingPage.css';
import { useSettings } from '../../../shared/context/SettingsContext';

// Using the existing project images
import heroImg from '@/assets/landing/hero.png';
import rideImg from '@/assets/landing/ride.png';
import parcelImg from '@/assets/landing/parcel.png';
import bikeImg from '@/assets/landing/bike.png';
import heroBgImg from '@/assets/landing/hero-bg.png';
import newHeroTaxiImg from '@/assets/ride-removebg-preview.png';

function LandingPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'easytaxi';
  
  // Custom logo rendering to match 'easytaxi' style (first part yellow, second part white)
  const renderLogo = () => {
    const nameStr = appName.toString();
    if (nameStr.toLowerCase() === 'easytaxi' || nameStr.length > 4) {
      const mid = Math.floor(nameStr.length / 2);
      return (
        <>
          {nameStr.substring(0, mid)}
          <span className="text-white">{nameStr.substring(mid)}</span>
        </>
      );
    }
    return nameStr;
  };

  const handleRedirect = (path) => (e) => {
    e?.preventDefault();
    if (path.startsWith('#')) {
      const element = document.querySelector(path);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
    }
  };

  return (
    <div className="landing-page">
      {/* New Header & Hero Wrapper */}
      <div className="new-hero-wrapper">
        <div className="new-hero-background" style={{ backgroundImage: `url(${heroBgImg})` }}></div>
        
        {/* Top Info Bar */}
        <div className="new-top-bar">
          <div className="new-logo-container">
             <a href="/" className="new-logo">
               <span style={{color: '#333'}}>Rydon24</span>
             </a>
          </div>
          <div className="new-top-contacts">
             <div className="top-contact-item">
               <span>+234 80 1000 000</span>
             </div>
             <div className="top-contact-item">
               <span>info@rydon24.com</span>
             </div>
          </div>
        </div>

        {/* Main Header / Nav */}
        <header className="new-main-header">
          <div className="new-nav-bg-slant"></div>
          <div className="new-nav-container">
            <nav className="new-nav-links">
              <a href="/" className="new-nav-link active">Home</a>
              <a href="/about" className="new-nav-link" onClick={handleRedirect('/about')}>Company</a>
              <a href="/services" className="new-nav-link" onClick={handleRedirect('/services')}>Our Taxi</a>
              <a href="/faq" className="new-nav-link" onClick={handleRedirect('/faq')}>FAQs</a>
              <a href="/blog" className="new-nav-link" onClick={handleRedirect('/blog')}>Blog</a>
              <a href="/contact" className="new-nav-link" onClick={handleRedirect('/contact')}>Contact</a>
            </nav>
            <div className="new-nav-actions">
              <button className="new-book-btn" onClick={handleRedirect('/login')}>Book a Taxi</button>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <section id="home" className="new-hero-section">
          <div className="new-hero-left">
            <span className="new-hero-subtitle">Travel securely with us!</span>
            <h1 className="new-hero-title">Book your taxi from<br/>anywhare today!</h1>
            <p className="new-hero-desc">Everything your taxi business needs is already here!<br/>Ridek made for taxi service companies!</p>
            <button className="new-hero-action-btn" onClick={handleRedirect('/login')}>Book Your Ride</button>
          </div>
          
          <div className="new-hero-graphic">
             <div className="new-hero-ribbon"></div>
             <img src={newHeroTaxiImg} alt="Taxi" className="new-hero-taxi" />
          </div>


        </section>
      </div>

      {/* Services Section */}
      <section id="services" className="subscriptions-section">
        <div className="section-header">
          <h2 className="section-title">OUR SERVICES</h2>
          <div className="section-triangle"></div>
        </div>
        
        <div className="subscriptions-grid">
          {/* Card 1 */}
          <div className="sub-card yellow">
            <h3>TAXI SERVICE</h3>
            <p>Comfortable and safe city rides to any destination you want to go with our professional drivers.</p>
            <div className="sub-card-image">
              <img src={rideImg} alt="City Taxi" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="sub-card grey">
            <h3>BIKE RIDE</h3>
            <p>Beat the traffic and reach your destination faster with our quick and affordable bike taxi service.</p>
            <div className="sub-card-image">
              <img src={bikeImg} alt="Bike Ride" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="sub-card grey">
            <h3>PARCEL DELIVERY</h3>
            <p>Fast and reliable parcel delivery services to send packages across the city securely.</p>
            <div className="sub-card-image">
              <img src={parcelImg} alt="Parcel Delivery" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="benefits-container">
          <div className="section-header">
            <h2 className="section-title">SOME BENEFITS</h2>
            <div className="section-triangle"></div>
          </div>

          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">
                <Home strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>HOME PICKUP</h3>
                <p>We run do home pickup to serve you more better and to your convenience</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Gift strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>BONUSES FOR RIDE</h3>
                <p>When you book us frequently we give you different bonuses that can put a smile on your face</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Clock strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>FAST BOOKING</h3>
                <p>Our book method is very fast and easy. It won't stress you.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Map strokeWidth={2.5} />
              </div>
              <div className="benefit-content">
                <h3>GPS SEARCHING</h3>
                <p>We run GPS searching incase you aren't sure of your destination. So you don't have to worry.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section (New) */}
      <footer id="contact" className="new-landing-footer">
        <div className="footer-newsletter-banner">
          <div className="newsletter-image">
            <img src={heroImg} alt="Subscribe" />
          </div>
          <div className="newsletter-content">
            <div className="newsletter-bg-slant"></div>
            <div className="newsletter-text">
              <h4 className="newsletter-subtitle"><Car size={16} /> GET TO ACCESS</h4>
              <h3 className="newsletter-title">Subscribe Our Newsletter.</h3>
              <form className="newsletter-form">
                <input type="email" placeholder="Email" />
                <button type="submit" onClick={(e) => e.preventDefault()}>Book Now →</button>
              </form>
            </div>
          </div>
        </div>

        <div className="footer-main-content">
          <div className="footer-col-1">
            <a href="/" className="footer-logo">
               <span style={{color: '#FFB300', fontSize: '2.5rem', fontWeight: 800}}>Rydon</span><span style={{color: '#fff', fontSize: '2.5rem', fontWeight: 800}}>24</span>
            </a>
            <p>We provide the best taxi and ride services in the region. Reliable, fast, and secure rides at your fingertips.</p>
            <p>Our fleet consists of well-maintained vehicles driven by professional drivers to ensure a comfortable journey.</p>
            <div className="footer-socials">
              <a href="#" className="social-icon">f</a>
              <a href="#" className="social-icon">t</a>
              <a href="#" className="social-icon">in</a>
              <a href="#" className="social-icon">y</a>
            </div>
            <div className="footer-website">www.Rydon24.com</div>
          </div>
          <div className="footer-col-2">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="/about" onClick={handleRedirect('/about')}>About Us</a></li>
              <li><a href="/services" onClick={handleRedirect('/services')}>Service</a></li>
              <li><a href="/contact" onClick={handleRedirect('/contact')}>Contact</a></li>
              <li><a href="/faq" onClick={handleRedirect('/faq')}>FAQs</a></li>
            </ul>
          </div>
          <div className="footer-col-3">
            <h3>Our Services</h3>
            <ul>
              <li><a href="/services" onClick={handleRedirect('/services')}>City Rides</a></li>
              <li><a href="/services" onClick={handleRedirect('/services')}>Airport transfers</a></li>
              <li><a href="/services" onClick={handleRedirect('/services')}>Outstation Trips</a></li>
              <li><a href="/services" onClick={handleRedirect('/services')}>Parcel Delivery</a></li>
              <li><a href="/services" onClick={handleRedirect('/services')}>Bike Taxis</a></li>
              <li><a href="/contact" onClick={handleRedirect('/contact')}>24/7 Customer Support</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-legal">
            <a href="/privacy" onClick={handleRedirect('/privacy')}>Privacy Policy</a>
            <a href="/terms" onClick={handleRedirect('/terms')}>Terms & Service</a>
          </div>
          <div className="footer-copyright">
            Copyright 2026 © All Right Reserved Design by Rydon24
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
