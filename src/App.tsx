import './App.css';

import React from 'react';

import KinesisVideoStreamsViewerView from './components/KinesisVideoStreamsViewerView';

const App: React.FC = () => {
  return (
    <div className="App">
      <KinesisVideoStreamsViewerView
        {...{
          region: process.env.REACT_APP_REGION || '',
          credentials: {
            accessKeyId: process.env.REACT_APP_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.REACT_APP_SECRET_ACCESS_KEY || '',
          },
          channelName: 'sample-channel',
          clientId: 'sample-client',
          tracks: {
            video: { width: 640, height: 360 },
            audio: false,
          },
          natTraversal: 'StunTurn',
          useTrickleICE: true,
        }}
      />
    </div>
  );
};

export default App;
