import React, { useEffect, useRef } from 'react';

import KinesisVideoStreamsViewerClient from '../../api/KinesisVideoStreamsViewerClient';
import { KinesisVideoStreamsViewerViewProps } from './index';

const KinesisVideoStreamsViewerRemoteView: React.FC<KinesisVideoStreamsViewerViewProps> = ({
  region,
  credentials,
  channelName,
  clientId,
  tracks,
  natTraversal,
  useTrickleICE,
}) => {
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
      localView: null,
      remoteView: remoteViewRef.current,
    });
    return () => kinesisVideoStreamsViewerClient.stop();
  }, [region, credentials, channelName, clientId, tracks, natTraversal, useTrickleICE]);

  return <video autoPlay controls playsInline ref={remoteViewRef} />;
};

export default KinesisVideoStreamsViewerRemoteView;
