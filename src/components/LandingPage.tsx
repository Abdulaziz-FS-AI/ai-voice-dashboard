import React, { useState } from 'react';
import CustomAuth from './CustomAuth';
import './LandingPage.css';

interface LandingPageProps {
  onGetStarted: () => void;
  onTestLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onTestLogin }) => {
  const [showAuth, setShowAuth] = useState(false);

  const handleGetStarted = () => {
    setShowAuth(true);
  };

  if (showAuth) {
    return (
      <CustomAuth 
        onSuccess={() => {
          // This will trigger a re-render in the parent App component
          // since the user context will be updated
          setShowAuth(false);
        }}
        onBack={() => setShowAuth(false)}
      />
    );
  }

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
            <button className="nav-cta" onClick={handleGetStarted}>Get Started</button>
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
              Transform Your Business with
              <span className="gradient-text"> AI Voice Agents</span>
            </h1>
            <p className="hero-description">
              Experience the future of customer interaction with our sophisticated AI voice dashboard. 
              Monitor, analyze, and optimize your voice agents with real-time insights and powerful analytics.
            </p>
            <div className="hero-actions">
              <button className="cta-primary" onClick={handleGetStarted}>
                Start Free Trial
                <span className="cta-arrow">→</span>
              </button>
              <button className="cta-secondary">
                Watch Demo
                <span className="play-icon">▶</span>
              </button>
              <button className="cta-test" onClick={onTestLogin}>
                🎯 Test Demo (PIN: 123456)
              </button>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-number">99.9%</span>
                <span className="stat-label">Uptime</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">50M+</span>
                <span className="stat-label">Calls Processed</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">24/7</span>
                <span className="stat-label">Support</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="dashboard-preview">
              <div className="preview-header">
                <div className="preview-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div className="preview-content">
                <div className="preview-chart">
                  <div className="chart-bars">
                    <div className="bar" style={{height: '60%'}}></div>
                    <div className="bar" style={{height: '80%'}}></div>
                    <div className="bar" style={{height: '45%'}}></div>
                    <div className="bar" style={{height: '90%'}}></div>
                    <div className="bar" style={{height: '70%'}}></div>
                  </div>
                </div>
                <div className="preview-metrics">
                  <div className="metric-card">
                    <div className="metric-value">2,847</div>
                    <div className="metric-label">Active Calls</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">94.5%</div>
                    <div className="metric-label">Success Rate</div>
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
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-description">
              Everything you need to manage and optimize your AI voice agents
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3 className="feature-title">Real-time Analytics</h3>
              <p className="feature-description">
                Monitor call performance, success rates, and customer satisfaction in real-time
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3 className="feature-title">Smart Routing</h3>
              <p className="feature-description">
                Intelligent call routing based on agent expertise and availability
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h3 className="feature-title">Custom Configuration</h3>
              <p className="feature-description">
                Tailor voice agents to your specific business needs and workflows
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <h3 className="feature-title">Enterprise Security</h3>
              <p className="feature-description">
                Bank-level security with encryption and compliance standards
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3 className="feature-title">Mobile Ready</h3>
              <p className="feature-description">
                Access your dashboard anywhere with our responsive design
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Lightning Fast</h3>
              <p className="feature-description">
                Sub-second response times with our optimized infrastructure
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="testimonials-container">
          <div className="section-header">
            <h2 className="section-title">Trusted by Industry Leaders</h2>
          </div>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                "Voice Matrix has revolutionized our customer service. The AI agents handle 80% of our calls with incredible accuracy."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">👨‍💼</div>
                <div className="author-info">
                  <div className="author-name">John Smith</div>
                  <div className="author-title">CEO, TechCorp</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                "The analytics dashboard gives us insights we never had before. Customer satisfaction is up 40% since implementation."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">👩‍💼</div>
                <div className="author-info">
                  <div className="author-name">Sarah Johnson</div>
                  <div className="author-title">COO, ServicePro</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                "Implementation was seamless and the support team is outstanding. Highly recommend Voice Matrix."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">👨‍🔬</div>
                <div className="author-info">
                  <div className="author-name">Mike Chen</div>
                  <div className="author-title">CTO, InnovateLab</div>
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
              <button className="cta-primary large" onClick={handleGetStarted}>
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