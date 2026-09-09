import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Flame, ShieldAlert, Thermometer, ChevronRight } from 'lucide-react';
import { searchLocalities, getLocalitiesByState, ALL_INDIA_WARDS } from '../data/indiaStatesData';

export default function LocalitySearchBar({
  onSelectLocality,
  selectedLocality,
  filterStateId = null,
  placeholder = 'Search locality, city (e.g. HSR Layout, Bengaluru or Connaught Place, New Delhi)...',
  lang = 'en',
  className = '',
  isOfficial = false,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Update query string if selectedLocality changes externally
  useEffect(() => {
    if (selectedLocality) {
      // Don't overwrite if user is actively searching
      if (!isOpen) {
        setQuery(`${selectedLocality.name}, ${selectedLocality.city}`);
      }
    }
  }, [selectedLocality, isOpen]);

  // Compute search results based on query & state filter
  useEffect(() => {
    if (!query.trim()) {
      if (filterStateId && filterStateId !== 'all_india') {
        setResults(getLocalitiesByState(filterStateId).slice(0, 12));
      } else {
        // Default popular / key localities across India
        const defaults = [
          'kar-blr-09', // HSR Layout, Bengaluru
          'kar-blr-04', // Shivajinagar, Bengaluru
          'kar-blr-06', // Koramangala, Bengaluru
          'kar-blr-07', // Indiranagar, Bengaluru
          'kar-blr-10', // Whitefield, Bengaluru
          'del-cen-01', // Connaught Place, New Delhi
          'mah-mum-01', // Marine Drive, Mumbai
          'wb-kol-01',  // Park Street, Kolkata
          'tel-hyd-01', // Hitec City, Hyderabad
          'tn-che-01',  // T. Nagar, Chennai
          'guj-ahm-01', // Navrangpura, Ahmedabad
          'raj-jai-01', // Pink City, Jaipur
        ];
        const matched = defaults
          .map((id) => ALL_INDIA_WARDS.find((w) => w.id === id))
          .filter(Boolean);
        setResults(matched.length > 0 ? matched : ALL_INDIA_WARDS.slice(0, 10));
      }
      return;
    }

    const matched = searchLocalities(query, filterStateId);
    setResults(matched.slice(0, 15));
    setHighlightedIndex(-1);
  }, [query, filterStateId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (selectedLocality) {
          setQuery(`${selectedLocality.name}, ${selectedLocality.city}`);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedLocality]);

  const handleSelect = (locality) => {
    setQuery(`${locality.name}, ${locality.city}`);
    setIsOpen(false);
    if (onSelectLocality) {
      onSelectLocality(locality);
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`ts-locality-search-box ${isOfficial ? 'search-box-official' : ''} ${className}`}>
      <div className="search-input-wrapper">
        <Search size={16} className="search-icon-lens text-sky-600" />
        <input
          ref={inputRef}
          type="text"
          className="search-input-field"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search locality or city name"
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={handleClear}
            title="Clear search"
            aria-label="Clear search input"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="search-dropdown-menu" role="listbox">
          <div className="dropdown-header-strip">
            <span className="dropdown-header-title">
              {filterStateId && filterStateId !== 'all_india'
                ? `Monitored Localities (${results.length})`
                : query.trim()
                ? `Matching Localities (${results.length})`
                : 'Key Urban Localities across India'}
            </span>
            <span className="dropdown-hint-text">Format: Locality, City</span>
          </div>

          {results.length > 0 ? (
            <div className="dropdown-results-list">
              {results.map((loc, idx) => {
                const isSelected = selectedLocality && selectedLocality.id === loc.id;
                const isHighlighted = highlightedIndex === idx;
                const riskColor =
                  loc.riskBand === 'Extreme'
                    ? '#ef4444'
                    : loc.riskBand === 'Warning'
                    ? '#ea580c'
                    : '#10b981';

                return (
                  <div
                    key={loc.id}
                    className={`dropdown-item-row ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                    onClick={() => handleSelect(loc)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="item-icon-box">
                      <MapPin size={15} className="item-map-pin" />
                    </div>

                    <div className="item-details-box">
                      <div className="item-main-title">
                        <strong className="item-locality-name">{loc.name}</strong>
                        <span className="item-city-name">, {loc.city}</span>
                      </div>
                      <div className="item-sub-meta">
                        <span className="item-state-name">{loc.stateName}</span>
                        <span className="item-meta-sep">·</span>
                        <span className="item-zone-tag">{loc.zone || loc.wardNumber}</span>
                      </div>
                    </div>

                    <div className="item-telemetry-pill">
                      <div className="item-wbgt-tag">
                        <Thermometer size={12} />
                        <span>{loc.wbgt}°C WBGT</span>
                      </div>
                      <span
                        className="item-risk-pill"
                        style={{
                          backgroundColor: `${riskColor}18`,
                          color: riskColor,
                          border: `1px solid ${riskColor}40`,
                        }}
                      >
                        {loc.riskBand}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dropdown-empty-state">
              <p>No localities matched "<strong>{query}</strong>"</p>
              <small>Try searching by locality name (e.g. HSR, Koramangala) or city name (e.g. Bengaluru, Mumbai, Delhi).</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
