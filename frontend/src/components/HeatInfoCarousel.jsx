import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import HeatIndexTable from './HeatIndexTable';

const TOTAL_SLIDES = 3;
const AUTO_ADVANCE_MS = 8000;

function SlideImageWithFallback({ src, alt, fallbackLabel }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="carousel-slide-image-wrap">
      {hasError ? (
        <div className="carousel-slide-image-fallback">
          <ImageIcon size={30} className="fallback-icon" />
          <p className="fallback-title">Image not yet added — place file at <code>frontend/public{src}</code></p>
          {fallbackLabel && <span className="fallback-sub">{fallbackLabel}</span>}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="carousel-slide-image"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

export default function HeatInfoCarousel() {
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
        <ChevronLeft size={20} />
      </button>

      {/* Right Navigation Arrow */}
      <button
        type="button"
        className="carousel-nav-btn carousel-nav-next"
        onClick={goToNext}
        aria-label="Next slide"
      >
        <ChevronRight size={20} />
      </button>

      {/* Active Slide Stage (Scrolls internally if needed) */}
      <div className="carousel-slide-stage">
        {/* Slide 0: India HeatRisk Map (Static Image) */}
        {currentSlide === 0 && (
          <div className="carousel-slide-content">
            <div className="map-section-header compact-header">
              <div className="header-badge-row">
                <span className="gov-section-pill">NATIONAL OVERVIEW</span>
                <span className="source-tag">NWP & Biometeorological Model</span>
              </div>
              <h3 className="section-main-heading">ThermaSense HeatRisk — National Overview</h3>
              <p className="section-lead-text">
                Combines weather, climate, and demographic data to identify potentially dangerous heat that may lead to increased health risk.
              </p>
            </div>
            <SlideImageWithFallback
              src="./india-heat-risk-overview.png"
              alt="Thermogenesis Heat Risk map of India showing risk levels by region"
              fallbackLabel="National HeatRisk Map Overview"
            />
          </div>
        )}

        {/* Slide 1: Heat Index Reference Table (Live Matrix) */}
        {currentSlide === 1 && <HeatIndexTable />}

        {/* Slide 2: Who Can Benefit from WBGT & UTCI Monitoring (Static Image) */}
        {currentSlide === 2 && (
          <div className="carousel-slide-content">
            <div className="map-section-header compact-header">
              <div className="header-badge-row">
                <span className="gov-section-pill">PUBLIC HEALTH FOCUS</span>
                <span className="source-tag">Vulnerability & Protection Matrix</span>
              </div>
              <h3 className="section-main-heading">Who Can Benefit from WBGT & UTCI Monitoring</h3>
              <p className="section-lead-text">
                Heat is a major weather-related hazard in India. Heat-related illness and fatalities are preventable.
              </p>
            </div>
            <SlideImageWithFallback
              src="./who-benefits-heat-monitoring.png"
              alt="Groups who benefit from heat stress monitoring: outdoor workers, active people, elderly and vulnerable individuals, people with health conditions"
              fallbackLabel="Vulnerability & Protection Matrix"
            />
          </div>
        )}
      </div>

      {/* Bottom Center Dots Indicator */}
      <div className="carousel-dots-row" role="tablist" aria-label="Slide navigation">
        {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => {
          const isActive = currentSlide === idx;
          const slideNames = ['India HeatRisk Map', 'Heat Index Reference Chart', 'Who Can Benefit'];
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
