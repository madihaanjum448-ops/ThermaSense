import React, { useCallback, useState } from 'react';
import WardMap from './components/WardMap';
import ForecastPanel from './components/ForecastPanel';

function App() {
  const [wards, setWards] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState(null);

  const handleWardsReady = useCallback((list) => {
    setWards(list);
    // Auto-select the first ward so the forecast panel isn't empty on load.
    setSelectedWardId((current) => current ?? list[0]?.id ?? null);
  }, []);

  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex'
      }}
    >
      <WardMap
        onWardsReady={handleWardsReady}
        onWardSelect={setSelectedWardId}
      />
      <ForecastPanel
        wards={wards}
        selectedWardId={selectedWardId}
        onSelectWard={setSelectedWardId}
      />
    </main>
  );
}

export default App;