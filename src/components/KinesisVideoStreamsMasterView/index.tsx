import React, { useEffect, useRef } from 'react';

import KinesisVideoStreamsMasterClient from '../../api/KinesisVideoStreamsMasterClient';

export type KinesisVideoStreamsMasterViewProps = {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  channelName: string;
  tracks: {
    video: { width: number; height: number } | false;
    audio: boolean;
  };
  natTraversal: 'Disabled' | 'TurnOnly' | 'StunTurn';
  useTrickleICE: boolean;
};

const KinesisVideoStreamsMasterView: React.FC<KinesisVideoStreamsMasterViewProps> = ({
  region,
  credentials,
  channelName,
  tracks,
  natTraversal,
  useTrickleICE,
}) => {
  const localViewRef = useRef<HTMLVideoElement>(null);
  const remoteViewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const kinesisVideoStreamsMasterClient = new KinesisVideoStreamsMasterClient();
    kinesisVideoStreamsMasterClient.start({
      region,
      credentials,
      channelName,
      tracks,
      natTraversal,
      useTrickleICE,
      localView: localViewRef.current,
      remoteView: remoteViewRef.current,
    });
    return () => kinesisVideoStreamsMasterClient.stop();
  }, [region, credentials, channelName, tracks, natTraversal, useTrickleICE]);

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

export default KinesisVideoStreamsMasterView;
