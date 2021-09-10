import { Role, SignalingClient } from 'amazon-kinesis-video-streams-webrtc';
import { KinesisVideo, KinesisVideoSignalingChannels } from 'aws-sdk';

type KinesisVideoStreamsMasterClientInput = {
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
  localView: HTMLVideoElement | null;
  remoteView: HTMLVideoElement | null;
};

export default class KinesisVideoStreamsMasterClient {
  // properties
  private signalingClient: SignalingClient | null = null;
  private peerConnectionByClientId: Record<string, RTCPeerConnection> = {};
  private localStream: MediaStream | null = null;
  private localView: HTMLVideoElement | null = null;
  private remoteView: HTMLVideoElement | null = null;

  // methods
  async start({
    region,
    credentials,
    channelName,
    tracks,
    natTraversal,
    useTrickleICE,
    localView,
    remoteView,
  }: KinesisVideoStreamsMasterClientInput): Promise<void> {
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
    console.log('[MASTER] Channel ARN: ', channelARN);

    // Get signaling channel endpoints
    const getSignalingChannelEndpointResponse = await kinesisVideoClient
      .getSignalingChannelEndpoint({
        ChannelARN: channelARN,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ['WSS', 'HTTPS'],
          Role: Role.MASTER,
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
    console.log('[MASTER] Endpoints: ', endpointsByProtocol);

    // Create Signaling Client
    this.signalingClient = new SignalingClient({
      channelARN,
      channelEndpoint: endpointsByProtocol.WSS,
      role: Role.MASTER,
      region,
      credentials,
      systemClockOffset: kinesisVideoClient.config.systemClockOffset,
    });

    // Get ICE server configuration
    const kinesisVideoSignalingChannelsClient = new KinesisVideoSignalingChannels({
      region,
      credentials,
      endpoint: endpointsByProtocol.HTTPS,
      correctClockSkew: true,
    });
    const getIceServerConfigResponse = await kinesisVideoSignalingChannelsClient
      .getIceServerConfig({ ChannelARN: channelARN })
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
    console.log('[MASTER] ICE servers: ', iceServers);

    // Get a stream from the webcam and display it in the local view.
    // If no video/audio needed, no need to request for the sources.
    // Otherwise, the browser will throw an error saying that either video or audio has to be enabled.
    if (tracks.video || tracks.video) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: tracks.video
            ? { width: { ideal: tracks.video.width }, height: { ideal: tracks.video.height } }
            : false,
          audio: tracks.audio,
        });
        if (this.localView) {
          this.localView.srcObject = this.localStream;
        }
      } catch (e) {
        console.error('[MASTER] Could not find webcam');
      }
    }

    this.signalingClient.on('open', async () => {
      console.log('[MASTER] Connected to signaling service');
    });

    this.signalingClient.on('sdpOffer', async (offer, remoteClientId) => {
      console.debug('TypeCheck: offer', offer);
      console.debug('TypeCheck: remoteClientId', remoteClientId);

      console.log('[MASTER] Received SDP offer from client: ' + remoteClientId);

      // Create a new peer connection using the offer from the given client
      const peerConnection = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: natTraversal === 'TurnOnly' ? 'relay' : 'all',
      });
      this.peerConnectionByClientId[remoteClientId] = peerConnection;

      // Send any ICE candidates to the other peer
      peerConnection.addEventListener('icecandidate', ({ candidate }) => {
        if (candidate) {
          console.log('[MASTER] Generated ICE candidate for client: ' + remoteClientId);

          // When trickle ICE is enabled, send the ICE candidates as they are generated.
          if (useTrickleICE) {
            console.log('[MASTER] Sending ICE candidate to client: ' + remoteClientId);
            if (!this.signalingClient) {
              console.error('this.signalingClient is null');
              return;
            }
            this.signalingClient.sendIceCandidate(candidate, remoteClientId);
          }
        } else {
          console.log('[MASTER] All ICE candidates have been generated for client: ' + remoteClientId);

          // When trickle ICE is disabled, send the answer now that all the ICE candidates have ben generated.
          if (!useTrickleICE) {
            console.log('[MASTER] Sending SDP answer to client: ' + remoteClientId);
            if (!this.signalingClient) {
              console.error('this.signalingClient is null');
              return;
            }
            if (!peerConnection.localDescription) {
              console.error('this.peerConnection.localDescription is null');
              return;
            }
            this.signalingClient.sendSdpAnswer(peerConnection.localDescription, remoteClientId);
          }
        }
      });

      // As remote tracks are received, add them to the remote view
      peerConnection.addEventListener('track', (event) => {
        console.log('[MASTER] Received remote track from client: ' + remoteClientId);
        if (!this.remoteView) {
          return;
        }
        if (this.remoteView.srcObject) {
          return;
        }
        this.remoteView.srcObject = event.streams[0];
      });

      // If there's no video/audio, master.localStream will be null. So, we should skip adding the tracks from it.
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          if (this.localStream) {
            peerConnection.addTrack(track, this.localStream);
          }
        });
      }
      await peerConnection.setRemoteDescription(offer);

      // Create an SDP answer to send back to the client
      console.log('[MASTER] Creating SDP answer for client: ' + remoteClientId);
      await peerConnection.setLocalDescription(
        await peerConnection.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        })
      );

      // When trickle ICE is enabled, send the answer now and then send ICE candidates as they are generated. Otherwise wait on the ICE candidates.
      if (useTrickleICE) {
        console.log('[MASTER] Sending SDP answer to client: ' + remoteClientId);
        if (!this.signalingClient) {
          console.error('this.signalingClient is null');
          return;
        }
        if (!peerConnection.localDescription) {
          console.error('this.peerConnection.localDescription is null');
          return;
        }
        this.signalingClient.sendSdpAnswer(peerConnection.localDescription, remoteClientId);
      }
      console.log('[MASTER] Generating ICE candidates for client: ' + remoteClientId);
    });

    this.signalingClient.on('iceCandidate', async (candidate, remoteClientId) => {
      console.log('[MASTER] Received ICE candidate from client: ' + remoteClientId);
      // Add the ICE candidate received from the client to the peer connection
      const peerConnection = this.peerConnectionByClientId[remoteClientId];
      peerConnection.addIceCandidate(candidate);
    });

    this.signalingClient.on('close', () => {
      console.log('[MASTER] Disconnected from signaling channel');
    });

    this.signalingClient.on('error', () => {
      console.error('[MASTER] Signaling client error');
    });

    console.log('[MASTER] Starting master connection');
    this.signalingClient.open();
  }

  stop(): void {
    console.log('[MASTER] Stopping master connection');
    if (this.signalingClient) {
      this.signalingClient.close();
      this.signalingClient = null;
    }
    Object.entries(this.peerConnectionByClientId).forEach(([, peerConnection]) => peerConnection.close());
    this.peerConnectionByClientId = {};
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.localView) {
      this.localView.srcObject = null;
    }
    if (this.remoteView) {
      this.remoteView.srcObject = null;
    }
  }
}
