"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "./api";

export type CallStatus = "connecting" | "waiting" | "live" | "ended" | "error";

export function useCall(roomId: string | null) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const localRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const teardown = useCallback(() => {
    socketRef.current?.close();
    peerRef.current?.close();
    socketRef.current = null;
    peerRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let queue: Promise<void> = Promise.resolve();
    let pendingCandidates: RTCIceCandidateInit[] = [];

    const send = (message: object) => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const newPeer = (stream: MediaStream) => {
      peerRef.current?.close();
      pendingCandidates = [];
      const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

      const peer = new RTCPeerConnection({ iceServers });
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate) send({ type: "candidate", data: event.candidate });
      };

      peer.ontrack = (event) => {
        setRemoteStream(event.streams[0] ?? null);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setStatus("live");
        if (peer.connectionState === "failed") {
          setError("Connection to doctor lost or failed.");
          setStatus("error");
        }
      };

      peerRef.current = peer;
      return peer;
    };

    const handleMessage = async (message: {
      type: string;
      data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
    }) => {
      const peer = peerRef.current;
      if (!peer) return;

      switch (message.type) {
        case "peer-joined": {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          send({ type: "offer", data: offer });
          break;
        }
        case "offer": {
          await peer.setRemoteDescription(message.data as RTCSessionDescriptionInit);
          for (const candidate of pendingCandidates) {
            await peer.addIceCandidate(candidate).catch(() => {});
          }
          pendingCandidates = [];
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          send({ type: "answer", data: answer });
          break;
        }
        case "answer":
          await peer.setRemoteDescription(message.data as RTCSessionDescriptionInit);
          for (const candidate of pendingCandidates) {
            await peer.addIceCandidate(candidate).catch(() => {});
          }
          pendingCandidates = [];
          break;
        case "candidate": {
          const candidate = message.data as RTCIceCandidateInit;
          if (!peer.remoteDescription) {
            pendingCandidates.push(candidate);
          } else {
            await peer.addIceCandidate(candidate).catch(() => {});
          }
          break;
        }
        case "peer-left":
          setRemoteStream(null);
          setStatus("waiting");
          if (localRef.current) newPeer(localRef.current);
          break;
        case "room-full":
          setError("This consultation session already has two participants.");
          setStatus("error");
          break;
      }
    };

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
        setStatus("waiting");
        newPeer(stream);

        const socket = new WebSocket(`${WS_URL}/ws/${roomId}`);
        socketRef.current = socket;
        socket.onopen = () => setStatus((curr) => (curr === "live" ? curr : "waiting"));
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          queue = queue.then(() => handleMessage(message)).catch(() => {
            setError("Video signaling failed. Please try reconnecting.");
            setStatus("error");
          });
        };
        socket.onerror = () => {
          setError("Could not connect to video consultation signaling server.");
          setStatus("error");
        };
      } catch {
        setError("Please allow camera and microphone permissions to join the video call.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [roomId, teardown]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }, [cameraOff]);

  const hangUp = () => {
    teardown();
    setStatus("ended");
  };

  return {
    localStream,
    remoteStream,
    status,
    error,
    muted,
    cameraOff,
    toggleMute,
    toggleCamera,
    hangUp,
  };
}
