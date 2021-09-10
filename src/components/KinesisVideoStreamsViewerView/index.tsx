import React, { useEffect, useRef } from 'react';

import KinesisVideoStreamsViewerClient from '../../api/KinesisVideoStreamsViewerClient';

export type KinesisVideoStreamsViewerViewProps = {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  channelName: string;
  clientId: string;
  tracks: {
    video: { width: number; height: number } | false;
    audio: boolean;
  };
  natTraversal: 'Disabled' | 'TurnOnly' | 'StunTurn';
  useTrickleICE: boolean;
};

const KinesisVideoStreamsViewerView: React.FC<KinesisVideoStreamsViewerViewProps> = ({
  region,
  credentials,
  channelName,
  clientId,
  tracks,
  natTraversal,
  useTrickleICE,
}) => {
  const localViewRef = useRef<HTMLVideoElement>(null);
  const remoteViewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const kinesisVideoStreamsViewerClient = new KinesisVideoStreamsViewerClient();
    kinesisVideoStreamsViewerClient.start({
      region,
      credentials,
      channelName,
      clientId,
      tracks,
      natTraversal,
      useTrickleICE,
      localView: localViewRef.current,
      remoteView: remoteViewRef.current,
    });
    return () => kinesisVideoStreamsViewerClient.stop();
  }, [region, credentials, channelName, clientId, tracks, natTraversal, useTrickleICE]);

  return (
    <div>
      <div>
        <video autoPlay controls height="360" playsInline ref={localViewRef} width="640" />
      </div>
      <div>
        <video autoPlay controls height="360" playsInline ref={remoteViewRef} width="640" />
      </div>
    </div>
  );
};

export default KinesisVideoStreamsViewerView;
