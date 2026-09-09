import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Activity, ShieldCheck, Flame, HardHat, HeartPulse } from 'lucide-react';
import HeatIndexTable from './HeatIndexTable';
import indiaHeatRiskImg from '../assets/india-heat-risk-overview.jpg';
import whoBenefitsImg from '../assets/who-benefits-heat-monitoring.jpg';

const TOTAL_SLIDES = 3;
const AUTO_ADVANCE_MS = 8000;

export default function HeatInfoCarousel({ onNavigateDashboard }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const carouselRef = useRef(null);

  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  }, []);

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Keyboard navigation when carousel container has focus
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToNext();
    }
  };

  // Auto-advance timer (pauses on hover)
  useEffect(() => {
    if (isHovered) return;

    const timer = setInterval(() => {
      goToNext();
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(timer);
  }, [isHovered, goToNext]);

  return (
    <div
      ref={carouselRef}
      className="heat-info-carousel-container panel-card"
      role="region"
      aria-label="Heat information carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Navigation Arrow */}
      <button
        type="button"
        className="carousel-nav-btn carousel-nav-prev"
        onClick={goToPrev}
        aria-label="Previous slide"
      >
        <ChevronLeft size={22} />
      </button>

      {/* Right Navigation Arrow */}
      <button
        type="button"
        className="carousel-nav-btn carousel-nav-next"
        onClick={goToNext}
        aria-label="Next slide"
      >
        <ChevronRight size={22} />
      </button>

      {/* Active Slide Stage */}
      <div className="carousel-slide-stage">
        {/* Slide 0: India HeatRisk Map + Overview info */}
        {currentSlide === 0 && (
          <div className="carousel-slide-split">
            <div className="slide-split-media">
              <img
                src={indiaHeatRiskImg}
                alt="Thermogenesis Heat Risk — India National Overview"
                className="carousel-split-image"
              />
            </div>
            <div className="slide-split-info">
              <div className="split-badge-row">
                <span className="split-status-pill">
                  <span className="cta-live-dot"></span>
                  NATIONAL NWP MODELING
                </span>
                <span className="source-tag">IMD & NDMA Framework</span>
              </div>
              <h3 className="split-title">ThermaSense National HeatRisk</h3>
              <p className="split-description">
                Combines high-resolution NWP weather modeling with human thermogenesis metrics (WBGT & UTCI) to identify high-risk heat stress zones before heatwaves peak.
              </p>
              <div className="split-features-list">
                <div className="split-feature-item">
                  <Flame size={17} className="text-red" />
                  <div>
                    <strong>Predictive Early Warnings</strong>
                    <span>5-day advanced biometric risk forecast per ward centroid</span>
                  </div>
                </div>
                <div className="split-feature-item">
                  <ShieldCheck size={17} className="text-amber" />
                  <div>
                    <strong>Work-Rest Protocols</strong>
                    <span>Automated threshold alerts for municipal and gig sectors</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="split-cta-btn"
                onClick={onNavigateDashboard}
              >
                <Activity size={16} />
                <span>Open Live Ward Map →</span>
              </button>
            </div>
          </div>
        )}

        {/* Slide 1: Heat Index Reference Table (Live Matrix) */}
        {currentSlide === 1 && <HeatIndexTable />}

        {/* Slide 2: Who Can Benefit + Operational Dashboard Card */}
        {currentSlide === 2 && (
          <div className="carousel-slide-split">
            <div className="slide-split-media">
              <img
                src={whoBenefitsImg}
                alt="Who Can Benefit from Thermogenesis Insights"
                className="carousel-split-image"
              />
            </div>
            <div className="slide-split-info split-card-navy">
              <div className="split-badge-row">
                <span className="split-status-pill pill-live-green">
                  <span className="cta-live-dot"></span>
                  OPERATIONAL CONSOLE
                </span>
              </div>
              <h3 className="split-title title-light">Operational Heat Dashboard</h3>
              <p className="split-description desc-light">
                Real-time ward-level GIS biometeorological telemetry, live dispatch alerts, and hospital surge coordination.
              </p>
              <div className="split-features-list">
                <div className="split-feature-item feature-item-light">
                  <HardHat size={17} className="text-saffron" />
                  <div>
                    <strong>Outdoor & Informal Workers</strong>
                    <span>Targeted hydration alerts & municipal cooling shelter activation</span>
                  </div>
                </div>
                <div className="split-feature-item feature-item-light">
                  <HeartPulse size={17} className="text-red" />
                  <div>
                    <strong>High-Risk Populations</strong>
                    <span>Elderly, children & vulnerable communities surveillance</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="split-cta-btn btn-saffron"
                onClick={onNavigateDashboard}
              >
                <Activity size={16} />
                <span>Launch Monitoring Console →</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Center Dots Indicator */}
      <div className="carousel-dots-row" role="tablist" aria-label="Slide navigation">
        {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => {
          const isActive = currentSlide === idx;
          const slideNames = [
            'India HeatRisk Overview',
            'Heat Index Reference Chart',
            'Who Can Benefit'
          ];
          return (
            <button
              key={idx}
              type="button"
              className={`carousel-dot ${isActive ? 'carousel-dot-active' : ''}`}
              onClick={() => goToSlide(idx)}
              aria-label={`Go to slide ${idx + 1}: ${slideNames[idx]}`}
              aria-current={isActive ? 'true' : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
