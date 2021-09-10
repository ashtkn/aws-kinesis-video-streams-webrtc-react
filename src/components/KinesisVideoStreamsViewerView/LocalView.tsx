import React, { useEffect, useRef } from 'react';

import KinesisVideoStreamsViewerClient from '../../api/KinesisVideoStreamsViewerClient';
import { KinesisVideoStreamsViewerViewProps } from './index';

const KinesisVideoStreamsViewerLocalView: React.FC<KinesisVideoStreamsViewerViewProps> = ({
  region,
  credentials,
  channelName,
  clientId,
  tracks,
  natTraversal,
  useTrickleICE,
}) => {
  const localViewRef = useRef<HTMLVideoElement>(null);

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
      remoteView: null,
    });
    return () => kinesisVideoStreamsViewerClient.stop();
  }, [region, credentials, channelName, clientId, tracks, natTraversal, useTrickleICE]);

  return <video autoPlay controls playsInline ref={localViewRef} />;
};

export default KinesisVideoStreamsViewerLocalView;
