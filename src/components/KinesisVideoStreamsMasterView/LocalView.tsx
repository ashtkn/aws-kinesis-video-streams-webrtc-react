import React, { useEffect, useRef } from 'react';

import KinesisVideoStreamsMasterClient from '../../api/KinesisVideoStreamsMasterClient';
import { KinesisVideoStreamsMasterViewProps } from './index';

const KinesisVideoStreamsMasterLocalView: React.FC<KinesisVideoStreamsMasterViewProps> = ({
  region,
  credentials,
  channelName,
  tracks,
  natTraversal,
  useTrickleICE,
}) => {
  const localViewRef = useRef<HTMLVideoElement>(null);

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
      remoteView: null,
    });
    return () => kinesisVideoStreamsMasterClient.stop();
  }, [region, credentials, channelName, tracks, natTraversal, useTrickleICE]);

  return <video autoPlay controls playsInline ref={localViewRef} />;
};

export default KinesisVideoStreamsMasterLocalView;
