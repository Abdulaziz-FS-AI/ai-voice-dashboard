import React from 'react';
import './LandingPage.css';

interface LandingPageProps {
  onGetStarted: () => void;
  onTestLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onTestLogin }) => {

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <div className="logo-icon">🎙️</div>
            <span className="logo-text">Voice Matrix</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#about" className="nav-link">About</a>
            <a href="#contact" className="nav-link">Contact</a>
            <button className="nav-test" onClick={onTestLogin}>🎯 Demo (PIN: 123456)</button>
            <button className="nav-cta" onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>🚀 AI-Powered Voice Technology</span>
            </div>
            <h1 className="hero-title">
              Scale Your Agency with <span className="gradient-text">AI Voice Assistants</span>
            </h1>
            <p className="hero-description">
              <strong>2x faster lead qualification. 70% cost reduction. 24/7 availability.</strong> The only platform agencies need to deploy, manage, and optimize VAPI voice assistants that convert prospects into customers.
            </p>
            <div className="hero-actions">
              <div className="primary-action">
                <button className="cta-primary" onClick={onGetStarted}>
                  Start 14-Day Free Trial
                  <span className="cta-arrow">→</span>
                </button>
                <div className="guarantee-text">
                  ✅ No credit card required • Setup in 5 minutes • Cancel anytime
                </div>
              </div>
              <div className="secondary-actions">
                <button className="cta-secondary" onClick={() => window.location.href = '/demo'}>
                  🎯 Try Demo (No Signup)
                  <span className="play-icon">▶</span>
                </button>
                <button className="cta-test" onClick={onTestLogin}>
                  🔑 Full Access (PIN: 123456)
                </button>
              </div>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">500+</span>
                <span className="stat-label">Agencies Scaling</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">10M+</span>
                <span className="stat-label">Calls Processed</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">2.5x</span>
                <span className="stat-label">ROI Average</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div className="preview-controls">
                  <div className="control-dot red"></div>
                  <div className="control-dot yellow"></div>
                  <div className="control-dot green"></div>
                </div>
                <div className="preview-title">Voice Matrix Analytics</div>
              </div>
              
              <div className="preview-content">
                <div className="dashboard-stats">
                  <div className="stat-box">
                    <div className="stat-number">847</div>
                    <div className="stat-text">Qualified Leads</div>
                    <div className="stat-change">+23% ↗</div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-number">94.5%</div>
                    <div className="stat-text">Success Rate</div>
                    <div className="stat-change">+8% ↗</div>
                  </div>
                </div>
                
                <div className="chart-section">
                  <div className="chart-header">
                    <span className="chart-title">Weekly Performance</span>
                    <span className="chart-period">Last 7 days</span>
                  </div>
                  <div className="clean-chart">
                    <div className="chart-bar" style={{height: '45%'}}></div>
                    <div className="chart-bar" style={{height: '65%'}}></div>
                    <div className="chart-bar" style={{height: '55%'}}></div>
                    <div className="chart-bar" style={{height: '85%'}}></div>
                    <div className="chart-bar" style={{height: '75%'}}></div>
                  </div>
                </div>
                
                <div className="trust-section">
                  <div className="trust-item">
                    <span className="trust-icon">🔒</span>
                    <span className="trust-text">SOC2</span>
                  </div>
                  <div className="trust-item">
                    <span className="trust-icon">☁️</span>
                    <span className="trust-text">AWS</span>
                  </div>
                  <div className="trust-item">
                    <span className="trust-icon">🎙️</span>
                    <span className="trust-text">VAPI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="features-container">
          <div className="section-header">
            <h2 className="section-title">How Voice Matrix Grows Your Agency</h2>
            <p className="section-description">
              Everything you need to deploy, manage, and optimize AI voice assistants that convert prospects into paying customers
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3 className="feature-title">Never Miss a Lead Again</h3>
              <p className="feature-description">
                Deploy AI assistants that answer every call instantly. Custom voices and personalities that match your brand and convert 40% more prospects.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3 className="feature-title">Prove ROI to Every Client</h3>
              <p className="feature-description">
                Beautiful dashboards showing lead quality, conversion rates, and revenue generated. White-label reports that win more client renewals.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">☁️</div>
              <h3 className="feature-title">Bank-Level Security</h3>
              <p className="feature-description">
                SOC2 compliant platform that enterprise clients trust. Secure authentication and role-based access keep client data protected.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3 className="feature-title">Dark/Light Theme Support</h3>
              <p className="feature-description">
                Professional UI with customizable themes, responsive design, and intuitive user experience across all devices
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📞</div>
              <h3 className="feature-title">Twilio Phone Integration</h3>
              <p className="feature-description">
                Seamless phone number management, call routing, and real-time call handling with professional-grade reliability
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h3 className="feature-title">Voice Agent Customization</h3>
              <p className="feature-description">
                Configure voice gender, accents, personalities, custom questions, and conversation templates for your brand
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👑</div>
              <h3 className="feature-title">Admin Management System</h3>
              <p className="feature-description">
                Comprehensive admin dashboard for user management, assistant oversight, and system configuration with role permissions
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Enterprise Security</h3>
              <p className="feature-description">
                Backend API key protection, secure data handling, encrypted communications, and compliance-ready architecture
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3 className="feature-title">Test Demo Mode</h3>
              <p className="feature-description">
                Easy testing environment with PIN access (123456) for prospects to experience the full platform capabilities
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="about-container">
          <div className="section-header">
            <h2 className="section-title">Why Agencies Choose Voice Matrix</h2>
            <p className="section-description">
              Stop losing leads to slow follow-ups. Scale your agency with AI voice assistants that qualify prospects 24/7.
            </p>
          </div>
          <div className="about-content">
            <div className="about-text">
              <div className="about-details">
                <div className="about-feature">
                  <div className="about-icon">🎯</div>
                  <div className="about-info">
                    <h4>The Problem: Leads Go Cold</h4>
                    <p>67% of agencies lose qualified leads due to slow response times. Manual follow-ups during business hours aren't enough in today's 24/7 market.</p>
                  </div>
                </div>
                <div className="about-feature">
                  <div className="about-icon">💰</div>
                  <div className="about-info">
                    <h4>The Solution: AI That Never Sleeps</h4>
                    <p>Voice Matrix AI assistants qualify leads instantly, 24/7. Convert more prospects with intelligent conversations that feel human.</p>
                  </div>
                </div>
                <div className="about-feature">
                  <div className="about-icon">🚀</div>
                  <div className="about-info">
                    <h4>Proven Results</h4>
                    <p>Agencies using Voice Matrix see 2x faster lead qualification, 70% cost reduction, and 2.5x ROI within 90 days.</p>
                  </div>
                </div>
                <div className="about-feature">
                  <div className="about-icon">📈</div>
                  <div className="about-info">
                    <h4>Get Started Today</h4>
                    <p>Join 500+ agencies already scaling with Voice Matrix. 14-day free trial, 5-minute setup, no technical skills required.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="about-visual">
              <div className="tech-stack">
                <h3>Technology Stack</h3>
                <div className="tech-grid">
                  <div className="tech-item">
                    <span className="tech-icon">⚛️</span>
                    <span>React 19.1.0</span>
                  </div>
                  <div className="tech-item">
                    <span className="tech-icon">📘</span>
                    <span>TypeScript</span>
                  </div>
                  <div className="tech-item">
                    <span className="tech-icon">☁️</span>
                    <span>AWS Cognito</span>
                  </div>
                  <div className="tech-item">
                    <span className="tech-icon">🎙️</span>
                    <span>VAPI Integration</span>
                  </div>
                  <div className="tech-item">
                    <span className="tech-icon">📞</span>
                    <span>Twilio</span>
                  </div>
                  <div className="tech-item">
                    <span className="tech-icon">🏗️</span>
                    <span>AWS Lambda</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="testimonials-container">
          <div className="section-header">
            <h2 className="section-title">Why Agencies Choose Voice Matrix</h2>
            <p className="section-description">
              See what our early adopters and beta testers are saying about the platform
            </p>
          </div>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                "The VAPI integration is seamless and the admin dashboard gives us complete control over our voice agents. Perfect for scaling our agency operations."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">👨‍💼</div>
                <div className="author-info">
                  <div className="author-name">Marcus Thompson</div>
                  <div className="author-title">Founder, Digital Growth Agency</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                "The dark/light theme and responsive design make it professional enough for client demos. The analytics are incredibly detailed."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">👩‍💼</div>
                <div className="author-info">
                  <div className="author-name">Lisa Chen</div>
                  <div className="author-title">Sales Director, CallCenter Pro</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                "Voice Matrix solved our biggest pain point - managing multiple voice AI assistants from one dashboard. The test demo feature is brilliant for sales."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">👨‍🚀</div>
                <div className="author-info">
                  <div className="author-name">David Rodriguez</div>
                  <div className="author-title">VP Operations, LeadGen Solutions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Transform Your Business?</h2>
            <p className="cta-description">
              Join thousands of companies already using Voice Matrix to deliver exceptional customer experiences.
            </p>
            <div className="cta-actions">
              <button className="cta-primary large" onClick={onGetStarted}>
                Start Your Free Trial
                <span className="cta-arrow">→</span>
              </button>
              <div className="cta-note">
                No credit card required • 14-day free trial • Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-logo">
              <div className="logo-icon">🎙️</div>
              <span className="logo-text">Voice Matrix</span>
            </div>
            <div className="footer-links">
              <a href="#privacy" className="footer-link">Privacy Policy</a>
              <a href="#terms" className="footer-link">Terms of Service</a>
              <a href="#support" className="footer-link">Support</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Voice Matrix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;