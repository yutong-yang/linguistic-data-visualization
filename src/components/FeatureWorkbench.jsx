import React, { useState, useEffect, useContext } from 'react';
import * as d3 from 'd3';
import { DataContext } from '../context/DataContext';
import FeatureSelector from './FeatureSelector';
import FeatureRecommendation from './FeatureRecommendation';

const FeatureWorkbench = () => {
  const { 
    useDynamicData, 
    selectedGBFeatures, 
    setSelectedGBFeatures, 
    selectedEAFeatures, 
    setSelectedEAFeatures,
    selectedWALSFeatures,
    setSelectedWALSFeatures,
    reloadData,
    loading,
    lang,
    langs
  } = useContext(DataContext);
  
  const [activeTab, setActiveTab] = useState('select'); // select | recommend
  
  // Dynamic data mode states
  const [availableGbFeatures, setAvailableGbFeatures] = useState([]);
  const [availableEaFeatures, setAvailableEaFeatures] = useState([]);
  const [availableWalsFeatures, setAvailableWalsFeatures] = useState([]);
  const [searchGb, setSearchGb] = useState('');
  const [searchEa, setSearchEa] = useState('');
  const [searchWals, setSearchWals] = useState('');
  const [showGbSelector, setShowGbSelector] = useState(false);
  const [showEaSelector, setShowEaSelector] = useState(false);
  const [showWalsSelector, setShowWalsSelector] = useState(false);

  const t = langs[lang];

  // Load available features for dynamic mode
  useEffect(() => {
    if (useDynamicData) {
      loadAvailableFeatures();
    }
  }, [useDynamicData]);

  const loadAvailableFeatures = async () => {
    try {
      // Load Grambank parameters
      const gbResponse = await fetch(`grambank-grambank-7ae000c/cldf/parameters.csv`);
      const gbText = await gbResponse.text();
      const gbData = d3.csvParse(gbText);
      
      const gbFeatures = gbData
        .filter(row => row.ID && row.Name)
        .map(row => ({
          id: row.ID,
          name: row.Name,
          description: row.Description || ''
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

      // Load D-PLACE variables
      const eaResponse = await fetch(`dplace-cldf/cldf/variables.csv`);
      const eaText = await eaResponse.text();
      const eaData = d3.csvParse(eaText);
      
      const eaFeatures = eaData
        .filter(row => row.ID && row.Name)
        .map(row => ({
          id: row.ID,
          name: row.Name,
          description: row.Description || ''
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

      // Load WALS parameters
      const walsResponse = await fetch(`cldf-datasets-wals-014143f/cldf/parameters.csv`);
      const walsText = await walsResponse.text();
      const walsData = d3.csvParse(walsText);
      
      const walsFeatures = walsData
        .filter(row => row.ID && row.Name)
        .map(row => ({
          id: row.ID,
          name: row.Name,
          description: row.Description || '',
          area: row.Area || ''
        }))
        .sort((a, b) => {
          // 按照数字顺序排序 (1A, 2A, 3A... 10A, 11A...)
          const numA = parseInt(a.id.match(/\d+/)?.[0] || 0);
          const numB = parseInt(b.id.match(/\d+/)?.[0] || 0);
          if (numA !== numB) return numA - numB;
          // 如果数字相同，按字母排序
          return a.id.localeCompare(b.id);
        });

      setAvailableGbFeatures(gbFeatures);
      setAvailableEaFeatures(eaFeatures);
      setAvailableWalsFeatures(walsFeatures);
    } catch (error) {
      console.error('Error loading available features:', error);
    }
  };

  const filteredGbFeatures = availableGbFeatures.filter(feature =>
    feature.id.toLowerCase().includes(searchGb.toLowerCase()) ||
    feature.name.toLowerCase().includes(searchGb.toLowerCase())
  );

  const filteredEaFeatures = availableEaFeatures.filter(feature =>
    feature.id.toLowerCase().includes(searchEa.toLowerCase()) ||
    feature.name.toLowerCase().includes(searchEa.toLowerCase())
  );

  const filteredWalsFeatures = availableWalsFeatures.filter(feature =>
    feature.id.toLowerCase().includes(searchWals.toLowerCase()) ||
    feature.name.toLowerCase().includes(searchWals.toLowerCase()) ||
    (feature.area && feature.area.toLowerCase().includes(searchWals.toLowerCase()))
  );

  const toggleGbFeature = (featureId) => {
    if (selectedGBFeatures.includes(featureId)) {
      setSelectedGBFeatures(selectedGBFeatures.filter(id => id !== featureId));
    } else {
      setSelectedGBFeatures([...selectedGBFeatures, featureId]);
    }
  };

  const toggleEaFeature = (featureId) => {
    if (selectedEAFeatures.includes(featureId)) {
      setSelectedEAFeatures(selectedEAFeatures.filter(id => id !== featureId));
    } else {
      setSelectedEAFeatures([...selectedEAFeatures, featureId]);
    }
  };

  const toggleWalsFeature = (featureId) => {
    if (selectedWALSFeatures.includes(featureId)) {
      setSelectedWALSFeatures(selectedWALSFeatures.filter(id => id !== featureId));
    } else {
      setSelectedWALSFeatures([...selectedWALSFeatures, featureId]);
    }
  };

  const clearAllFeatures = () => {
    setSelectedGBFeatures([]);
    setSelectedEAFeatures([]);
    setSelectedWALSFeatures([]);
  };

  const selectAllGbFeatures = () => {
    setSelectedGBFeatures(availableGbFeatures.map(f => f.id));
  };

  const selectAllEaFeatures = () => {
    setSelectedEAFeatures(availableEaFeatures.map(f => f.id));
  };

  const selectAllWalsFeatures = () => {
    setSelectedWALSFeatures(availableWalsFeatures.map(f => f.id));
  };

  // Dynamic feature selector component
  const DynamicFeatureSelector = () => {
    if (!useDynamicData) return null;

    return (
      <div style={{
        backgroundColor: '#f9f9f9',
        padding: '12px',
        borderRadius: '4px',
        marginBottom: '12px',
        border: '1px solid #ddd',
        fontSize: '11px'
      }}>
        <h4 style={{ 
          marginTop: 0, 
          marginBottom: '10px', 
          color: '#666',
          fontSize: '13px',
          fontWeight: 'normal'
        }}>
          {t.dynamicFeatureSelectorTitle || 'Dynamic Feature Selection'}
        </h4>
        
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={clearAllFeatures}
              style={{
                padding: '4px 8px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              {t.clearAllFeatures || 'Clear All'}
            </button>
            
            <button
              onClick={selectAllGbFeatures}
              style={{
                padding: '4px 8px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              {t.selectAllGbFeatures || 'Select All GB'}
            </button>
            
            <button
              onClick={selectAllEaFeatures}
              style={{
                padding: '4px 8px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              {t.selectAllEaFeatures || 'Select All EA'}
            </button>
            
            <button
              onClick={selectAllWalsFeatures}
              style={{
                padding: '4px 8px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              All WALS
            </button>
          </div>
          
          <div style={{ fontSize: '10px', color: '#666' }}>
            {t.selectedFeaturesCount || 'Selected'}: {selectedGBFeatures.length} {t.gbFeatures || 'GB features'}, {selectedEAFeatures.length} {t.eaFeatures || 'EA features'}, {selectedWALSFeatures.length} WALS features
          </div>
        </div>

        {/* Grambank feature selector */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>{t.gbFeatures || 'Grambank Features'}</span>
            <button
              onClick={() => setShowGbSelector(!showGbSelector)}
              style={{
                padding: '3px 6px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
            >
              {showGbSelector ? (t.hideSelector || 'Hide') : (t.showSelector || 'Show')}
            </button>
          </div>
          
          {showGbSelector && (
            <div>
              <input
                type="text"
                placeholder={t.searchGbPlaceholder || 'Search GB features...'}
                value={searchGb}
                onChange={(e) => setSearchGb(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  marginBottom: '8px',
                  fontSize: '10px'
                }}
              />
              
              <div style={{ 
                maxHeight: '150px', 
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '3px',
                padding: '6px',
                backgroundColor: '#fff'
              }}>
                {filteredGbFeatures.map(feature => (
                  <label key={feature.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '6px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedGBFeatures.includes(feature.id)}
                      onChange={() => toggleGbFeature(feature.id)}
                      style={{ marginRight: '6px' }}
                    />
                    <span>
                      <strong>{feature.id}</strong>: {feature.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* D-PLACE feature selector */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>{t.eaFeatures || 'D-PLACE Features'}</span>
            <button
              onClick={() => setShowEaSelector(!showEaSelector)}
              style={{
                padding: '3px 6px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
            >
              {showEaSelector ? (t.hideSelector || 'Hide') : (t.showSelector || 'Show')}
            </button>
          </div>
          
          {showEaSelector && (
            <div>
              <input
                type="text"
                placeholder={t.searchEaPlaceholder || 'Search EA features...'}
                value={searchEa}
                onChange={(e) => setSearchEa(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  marginBottom: '8px',
                  fontSize: '10px'
                }}
              />
              
              <div style={{ 
                maxHeight: '150px', 
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '3px',
                padding: '6px',
                backgroundColor: '#fff'
              }}>
                {filteredEaFeatures.map(feature => (
                  <label key={feature.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '6px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedEAFeatures.includes(feature.id)}
                      onChange={() => toggleEaFeature(feature.id)}
                      style={{ marginRight: '6px' }}
                    />
                    <span>
                      <strong>{feature.id}</strong>: {feature.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WALS feature selector */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: '#666', fontSize: '11px', fontWeight: 'bold' }}>WALS features</span>
            <button
              onClick={() => setShowWalsSelector(!showWalsSelector)}
              style={{
                padding: '3px 6px',
                backgroundColor: '#2c7c6c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '9px'
              }}
            >
              {showWalsSelector ? (t.hideSelector || 'Hide') : (t.showSelector || 'Show')}
            </button>
          </div>
          
          {showWalsSelector && (
            <div>
              <input
                type="text"
                placeholder="Search WALS features..."
                value={searchWals}
                onChange={(e) => setSearchWals(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  marginBottom: '8px',
                  fontSize: '10px'
                }}
              />
              
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                Found {filteredWalsFeatures.length} features
              </div>
              
              <div style={{ 
                maxHeight: '150px', 
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: '3px',
                padding: '6px',
                backgroundColor: '#fff'
              }}>
                {filteredWalsFeatures.map(feature => (
                  <label key={feature.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '6px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedWALSFeatures.includes(feature.id)}
                      onChange={() => toggleWalsFeature(feature.id)}
                      style={{ marginRight: '6px' }}
                    />
                    <span>
                      <strong>{feature.id}</strong>: {feature.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Apply button */}
        <button
          onClick={reloadData}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: loading ? '#ccc' : '#2c7c6c',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: 'normal'
          }}
        >
          {loading ? (t.loadingData || 'Loading...') : (t.applyFeatures || 'Apply Features')}
        </button>
      </div>
    );
  };

  return (
    <div className="feature-workbench" style={{
      backgroundColor: '#fff',
      border: '1px solid #ddd',
      borderRadius: '6px',
      marginTop: '12px'
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        <button
          onClick={() => setActiveTab('select')}
          className={`tab-btn ${activeTab === 'select' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: activeTab === 'select' ? '#2c7c6c' : 'transparent',
            color: activeTab === 'select' ? '#fff' : '#2c7c6c',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          {t.featureSelection || 'Feature Selection'}
        </button>
        <button
          onClick={() => setActiveTab('recommend')}
          className={`tab-btn ${activeTab === 'recommend' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: activeTab === 'recommend' ? '#2c7c6c' : 'transparent',
            color: activeTab === 'recommend' ? '#fff' : '#2c7c6c',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600
          }}
        >
          {t.smartFeatureRecommendationsTitle || 'Recommendations'}
        </button>
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ display: activeTab === 'select' ? 'block' : 'none' }}>
          <DynamicFeatureSelector />
          <FeatureSelector />
        </div>
        <div style={{ display: activeTab === 'recommend' ? 'block' : 'none' }}>
          <FeatureRecommendation />
        </div>
      </div>
    </div>
  );
};

export default FeatureWorkbench;


