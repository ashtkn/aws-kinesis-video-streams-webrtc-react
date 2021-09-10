import React, { useEffect, useRef } from 'react';

import KinesisVideoStreamsMasterClient from '../../api/KinesisVideoStreamsMasterClient';
import { KinesisVideoStreamsMasterViewProps } from './index';

const KinesisVideoStreamsMasterRemoteView: React.FC<KinesisVideoStreamsMasterViewProps> = ({
  region,
  credentials,
  channelName,
  tracks,
  natTraversal,
  useTrickleICE,
}) => {
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
      localView: null,
      remoteView: remoteViewRef.current,
    });
    return () => kinesisVideoStreamsMasterClient.stop();
  }, [region, credentials, channelName, tracks, natTraversal, useTrickleICE]);

  return <video autoPlay controls playsInline ref={remoteViewRef} />;
};

export default KinesisVideoStreamsMasterRemoteView;
