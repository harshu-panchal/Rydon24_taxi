import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, Calendar, Package, Bike, Car, ArrowRight, Globe, HelpCircle } from 'lucide-react';
import './LandingPage.css';
import { useSettings } from '../../../shared/context/SettingsContext';

// Using the generated images
import heroImg from '@/assets/landing/hero.png';
import rideImg from '@/assets/landing/ride.png';
import parcelImg from '@/assets/landing/parcel.png';
import bikeImg from '@/assets/landing/bike.png';
import optionsImg from '@/assets/landing/options.png';
import citiesImg from '@/assets/landing/cities.png';
import airportImg from '/airport_illustration.png';

function LandingPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'Appzeto';
  const appLogo = settings.general?.logo || settings.customization?.logo || settings.general?.favicon || '';

  const handleRedirect = (e) => {
    e?.preventDefault();
    navigate('/signup');
  };

  return (
    <div className="landing-page">
      {/* Primary Header */}
      <header className="landing-header">
        <div className="landing-header-left">
          <a href="/" className="landing-logo">
            {appLogo ? (
              <img src={appLogo} alt={`${appName} logo`} className="landing-logo-icon" />
            ) : null}
            <span>{appName}</span>
          </a>
          <a href="#" className="landing-nav-link" onClick={handleRedirect}>Ride</a>
          <a href="#" className="landing-nav-link" onClick={handleRedirect}>Drive</a>
          <a href="#" className="landing-nav-link" onClick={handleRedirect}>Business</a>
          <a href="#" className="landing-nav-link" onClick={handleRedirect}>About</a>
        </div>
        <div className="landing-header-right">
          <a href="#" className="landing-nav-link" onClick={handleRedirect}><Globe size={18} /> EN</a>
          <a href="#" className="landing-nav-link" onClick={handleRedirect}>Help</a>
          <a href="/login" className="landing-nav-link">Log in</a>
          <a href="/signup" className="landing-btn-signup">Sign up</a>
        </div>
      </header>

      {/* Sub Header / Tabs */}
      <div className="landing-sub-header">
        <h2>Ride</h2>
        <nav className="landing-sub-nav">
          <a href="#" className="landing-sub-nav-link" onClick={handleRedirect}>Request a ride</a>
          <a href="#" className="landing-sub-nav-link" onClick={handleRedirect}>Reserve a ride</a>
          <a href="#" className="landing-sub-nav-link" onClick={handleRedirect}>See prices</a>
          <a href="#" className="landing-sub-nav-link" onClick={handleRedirect}>Explore ride options</a>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="landing-hero-container">
        <div className="landing-hero-form">
          <h1>Request a ride for now or later</h1>
          <div className="landing-form-card">
            <div className="landing-input-group">
              <div className="landing-input-wrapper">
                <MapPin size={20} fill="currentColor" />
                <input type="text" placeholder="Pickup location" />
                <Navigation size={18} className="landing-input-icon-right" />
              </div>
            </div>
            <div className="landing-input-group">
              <div className="landing-input-wrapper">
                <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, background: 'black' }}></div>
                </div>
                <input type="text" placeholder="Dropoff location" />
              </div>
            </div>
            <button className="landing-btn-action" onClick={handleRedirect}>See prices</button>
          </div>
        </div>
        <div className="landing-hero-image">
          <img src={heroImg} alt="Ride Hero" />
        </div>
      </section>

      {/* Services Grid */}
      <section className="landing-services-section">
        <h2>Explore what you can do with {appName}</h2>
        <div className="landing-services-grid">
          <div className="landing-service-card" onClick={handleRedirect}>
            <div className="landing-service-content">
              <h3>Ride</h3>
              <p>Go anywhere with {appName}. Request a ride, hop in, and go.</p>
              <span className="landing-service-btn">Details</span>
            </div>
            <div className="landing-service-image">
              <img src={rideImg} alt="Ride" />
            </div>
          </div>

          <div className="landing-service-card" onClick={handleRedirect}>
            <div className="landing-service-content">
              <h3>Reserve</h3>
              <p>Reserve your ride in advance so you can relax on the day of your trip.</p>
              <span className="landing-service-btn">Details</span>
            </div>
            <div className="landing-service-image">
              <Calendar size={48} strokeWidth={1.5} color="#5e5e5e" />
            </div>
          </div>

          <div className="landing-service-card" onClick={handleRedirect}>
            <div className="landing-service-content">
              <h3>Parcel</h3>
              <p>{appName} makes same-day item delivery easier than ever.</p>
              <span className="landing-service-btn">Details</span>
            </div>
            <div className="landing-service-image">
              <img src={parcelImg} alt="Parcel" />
            </div>
          </div>

          <div className="landing-service-card" onClick={handleRedirect}>
            <div className="landing-service-content">
              <h3>Bike</h3>
              <p>Get affordable motorbike rides in minutes at your doorstep.</p>
              <span className="landing-service-btn">Details</span>
            </div>
            <div className="landing-service-image">
              <img src={bikeImg} alt="Bike" />
            </div>
          </div>
        </div>
      </section>

      {/* Travel Your Way Section */}
      <section className="landing-travel-section">
        <h2>Use the {appName} app to help you travel your way</h2>
        <div className="landing-travel-grid">
          <div className="landing-travel-card" onClick={handleRedirect} style={{ cursor: 'pointer' }}>
            <div className="landing-travel-image">
              <img src={optionsImg} alt="Ride options" />
            </div>
            <div className="landing-travel-content">
              <h3>Ride options</h3>
              <p>There's more than one way to move with {appName}, no matter where you are or where you're headed next.</p>
            </div>
          </div>

          <div className="landing-travel-card" onClick={handleRedirect} style={{ cursor: 'pointer' }}>
            <div className="landing-travel-image">
              <img src={airportImg} alt="Airports" />
            </div>
            <div className="landing-travel-content">
              <h3>700+ airports</h3>
              <p>You can request a ride to and from most major airports. Schedule a ride to the airport for one less thing to worry about.</p>
            </div>
          </div>

          <div className="landing-travel-card" onClick={handleRedirect} style={{ cursor: 'pointer' }}>
            <div className="landing-travel-image">
              <img src={citiesImg} alt="Cities" />
            </div>
            <div className="landing-travel-content">
              <h3>15,000+ cities</h3>
              <p>The app is available in thousands of cities worldwide, so you can request a ride even when you're far from home.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-wide-btn-container">
        <a href="/signup" className="landing-btn-full-width">See prices</a>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="landing-footer-top">
            <div className="landing-footer-logo">{appName}</div>
            <div className="landing-footer-grid">
              <div className="landing-footer-column">
                <h4>Company</h4>
                <ul>
                  <li><a href="#">About us</a></li>
                  <li><a href="#">Our offerings</a></li>
                  <li><a href="#">Newsroom</a></li>
                  <li><a href="#">Investors</a></li>
                  <li><a href="#">Blog</a></li>
                  <li><a href="#">Careers</a></li>
                </ul>
              </div>
              <div className="landing-footer-column">
                <h4>Products</h4>
                <ul>
                  <li><a href="#">Ride</a></li>
                  <li><a href="#">Drive</a></li>
                  <li><a href="#">Deliver</a></li>
                  <li><a href="#">Eat</a></li>
                  <li><a href="#">Business</a></li>
                  <li><a href="#">Freight</a></li>
                </ul>
              </div>
              <div className="landing-footer-column">
                <h4>Global citizenship</h4>
                <ul>
                  <li><a href="#">Safety</a></li>
                  <li><a href="#">Diversity and Inclusion</a></li>
                  <li><a href="#">Sustainability</a></li>
                </ul>
              </div>
              <div className="landing-footer-column">
                <h4>Travel</h4>
                <ul>
                  <li><a href="#">Airports</a></li>
                  <li><a href="#">Cities</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="landing-footer-socials">
            <a href="#" className="landing-footer-social-link"><Globe size={20} /></a>
            <a href="#" className="landing-footer-social-link">Facebook</a>
            <a href="#" className="landing-footer-social-link">Twitter</a>
            <a href="#" className="landing-footer-social-link">Instagram</a>
            <a href="#" className="landing-footer-social-link">LinkedIn</a>
          </div>

          <div className="landing-footer-apps">
            <a href="#" className="landing-footer-app-btn">
               <div style={{ fontWeight: 800 }}>App Store</div>
            </a>
            <a href="#" className="landing-footer-app-btn">
               <div style={{ fontWeight: 800 }}>Google Play</div>
            </a>
          </div>

          <div className="landing-footer-bottom">
            <p>© 2026 {appName} Technologies Inc.</p>
            <div className="landing-footer-bottom-links">
              <a href="#" className="landing-footer-social-link">Privacy</a>
              <a href="#" className="landing-footer-social-link">Accessibility</a>
              <a href="#" className="landing-footer-social-link">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
