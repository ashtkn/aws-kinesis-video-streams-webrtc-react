import { Role, SignalingClient } from 'amazon-kinesis-video-streams-webrtc';
import { KinesisVideo, KinesisVideoSignalingChannels } from 'aws-sdk';

type KinesisVideoStreamsViewerClientInput = {
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
  localView: HTMLVideoElement | null;
  remoteView: HTMLVideoElement | null;
};

export default class KinesisVideoStreamsViewerClient {
  // properties
  private signalingClient: SignalingClient | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private localView: HTMLVideoElement | null = null;
  private remoteView: HTMLVideoElement | null = null;

  // methods
  async start({
    region,
    credentials,
    channelName,
    clientId,
    tracks,
    natTraversal,
    useTrickleICE,
    localView,
    remoteView,
  }: KinesisVideoStreamsViewerClientInput): Promise<void> {
    // Set views
    this.localView = localView || null;
    this.remoteView = remoteView || null;

    // Create KVS client
    const kinesisVideoClient = new KinesisVideo({
      region,
      credentials,
      correctClockSkew: true,
    });

    // Get signaling channel ARN
    const describeSignalingChannelResponse = await kinesisVideoClient
      .describeSignalingChannel({ ChannelName: channelName })
      .promise();

    if (!describeSignalingChannelResponse.ChannelInfo || !describeSignalingChannelResponse.ChannelInfo.ChannelARN) {
      console.error('ChannelInfo is undefined:', describeSignalingChannelResponse);
      return;
    }
    const channelARN = describeSignalingChannelResponse.ChannelInfo.ChannelARN;
    console.log('[VIEWER] Channel ARN: ', channelARN);

    // Get signaling channel endpoints
    const getSignalingChannelEndpointResponse = await kinesisVideoClient
      .getSignalingChannelEndpoint({
        ChannelARN: channelARN,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ['WSS', 'HTTPS'],
          Role: Role.VIEWER,
        },
      })
      .promise();

    if (!getSignalingChannelEndpointResponse.ResourceEndpointList) {
      console.error('ResourceEndpointList is undefined:', getSignalingChannelEndpointResponse);
      return;
    }

    const endpointsByProtocol = { WSS: '', HTTPS: '' };
    getSignalingChannelEndpointResponse.ResourceEndpointList.forEach((item) => {
      if (item.Protocol === 'WSS' || item.Protocol === 'HTTPS') {
        endpointsByProtocol[item.Protocol] = item.ResourceEndpoint || '';
      }
    });
    console.log('[VIEWER] Endpoints: ', endpointsByProtocol);

    const kinesisVideoSignalingChannelsClient = new KinesisVideoSignalingChannels({
      region,
      credentials,
      endpoint: endpointsByProtocol.HTTPS,
      correctClockSkew: true,
    });

    // Get ICE server configuration
    const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
      .getIceServerConfig({
        ChannelARN: channelARN,
      })
      .promise();
    if (!getIceServerConfigResponse.IceServerList) {
      console.error('IceServerList is undefined', getIceServerConfigResponse);
      return;
    }

    const iceServers: RTCIceServer[] = [];
    if (natTraversal === 'StunTurn') {
      iceServers.push({ urls: `stun:stun.kinesisvideo.${region}.amazonaws.com:443` });
    }
    if (natTraversal === 'StunTurn' || natTraversal === 'TurnOnly') {
      getIceServerConfigResponse.IceServerList.forEach((iceServer) =>
        iceServers.push({
          urls: iceServer.Uris || '',
          username: iceServer.Username,
          credential: iceServer.Password,
        })
      );
    }
    console.log('[VIEWER] ICE servers: ', iceServers);

    // Create Signaling Client
    this.signalingClient = new SignalingClient({
      channelARN,
      channelEndpoint: endpointsByProtocol.WSS,
      clientId,
      role: Role.VIEWER,
      region,
      credentials,
      systemClockOffset: kinesisVideoClient.config.systemClockOffset,
    });

    this.peerConnection = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: natTraversal === 'TurnOnly' ? 'relay' : 'all',
    });

    this.signalingClient.on('open', async () => {
      console.log('[VIEWER] Connected to signaling service');
      // Get a stream from the webcam, add it to the peer connection, and display it in the local view.
      // If no video/audio needed, no need to request for the sources.
      // Otherwise, the browser will throw an error saying that either video or audio has to be enabled.
      if (tracks.video || tracks.audio) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: tracks.video
              ? { width: { ideal: tracks.video.width }, height: { ideal: tracks.video.height } }
              : false,
            audio: tracks.audio,
          });
          this.localStream.getTracks().forEach((track) => {
            if (this.peerConnection && this.localStream) {
              this.peerConnection.addTrack(track, this.localStream);
            }
          });
          if (this.localView) {
            this.localView.srcObject = this.localStream;
          }
        } catch (e) {
          console.error('[VIEWER] Could not find webcam');
          return;
        }
      }

      // Create an SDP offer to send to the master
      console.log('[VIEWER] Creating SDP offer');
      if (!this.peerConnection) {
        console.error('this.peerConnection is null');
        return;
      }
      await this.peerConnection.setLocalDescription(
        await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })
      );

      // When trickle ICE is enabled, send the offer now and then send ICE candidates as they are generated. Otherwise wait on the ICE candidates.
      if (useTrickleICE) {
        console.log('[VIEWER] Sending SDP offer');
        if (!this.signalingClient) {
          console.error('this.signalingClient is null');
          return;
        }
        if (!this.peerConnection.localDescription) {
          console.error('this.signalingClient.localDescription is null');
          return;
        }
        this.signalingClient.sendSdpOffer(this.peerConnection.localDescription);
      }
      console.log('[VIEWER] Generating ICE candidates');
    });

    this.signalingClient.on('sdpAnswer', async (answer) => {
      // Add the SDP answer to the peer connection
      console.log('[VIEWER] Received SDP answer');
      if (!this.peerConnection) {
        console.error('this.peerConnection is null');
        return;
      }
      await this.peerConnection.setRemoteDescription(answer);
    });

    this.signalingClient.on('iceCandidate', (candidate) => {
      // Add the ICE candidate received from the MASTER to the peer connection
      console.log('[VIEWER] Received ICE candidate');
      if (!this.peerConnection) {
        console.error('this.peerConnection is null');
        return;
      }
      this.peerConnection.addIceCandidate(candidate);
    });

    this.signalingClient.on('close', () => {
      console.log('[VIEWER] Disconnected from signaling channel');
    });

    this.signalingClient.on('error', (error) => {
      console.error('[VIEWER] Signaling client error: ', error);
    });

    // Send any ICE candidates to the other peer
    this.peerConnection.addEventListener('icecandidate', ({ candidate }) => {
      if (candidate) {
        console.log('[VIEWER] Generated ICE candidate');
        // When trickle ICE is enabled, send the ICE candidates as they are generated.
        if (useTrickleICE) {
          console.log('[VIEWER] Sending ICE candidate');
          if (!this.signalingClient) {
            console.error('this.signalingClient is null');
            return;
          }
          this.signalingClient.sendIceCandidate(candidate);
        }
      } else {
        console.log('[VIEWER] All ICE candidates have been generated');
        // When trickle ICE is disabled, send the offer now that all the ICE candidates have ben generated.
        if (!useTrickleICE) {
          console.log('[VIEWER] Sending SDP offer');
          if (!this.signalingClient) {
            console.error('this.signalingClient is null');
            return;
          }
          if (!this.peerConnection) {
            console.error('this.peerConnection is null');
            return;
          }
          if (!this.peerConnection.localDescription) {
            console.error('this.peerConnection.localDescription is null');
            return;
          }
          this.signalingClient.sendSdpOffer(this.peerConnection.localDescription);
        }
      }
    });

    // As remote tracks are received, add them to the remote view
    this.peerConnection.addEventListener('track', (event) => {
      console.log('[VIEWER] Received remote track');
      if (!this.remoteView) {
        return;
      }
      if (this.remoteView.srcObject) {
        return;
      }
      this.remoteStream = event.streams[0];
      this.remoteView.srcObject = this.remoteStream;
    });

    console.log('[VIEWER] Starting viewer connection');
    this.signalingClient.open();
  }

  stop(): void {
    console.log('[VIEWER] Stopping viewer connection');
    if (this.signalingClient) {
      this.signalingClient.close();
      this.signalingClient = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    if (this.localView) {
      this.localView.srcObject = null;
    }
    if (this.remoteView) {
      this.remoteView.srcObject = null;
    }
  }
}
