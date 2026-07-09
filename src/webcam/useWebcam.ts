import { useCallback, useRef, useState } from "react";

export type WebcamStatus = "idle" | "requesting" | "ready" | "error";
export type FacingMode = "user" | "environment";

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<WebcamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>("user");

  const start = useCallback(async (requestedFacing: FacingMode = "user"): Promise<boolean> => {
    setStatus("requesting");
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: requestedFacing },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setFacing(requestedFacing);
      setStatus("ready");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      return false;
    }
  }, []);

  const switchCamera = useCallback(
    async (next: FacingMode): Promise<boolean> => {
      if (next === facing && status === "ready") return true;
      return start(next);
    },
    [facing, status, start],
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }, []);

  return { videoRef, status, error, facing, start, switchCamera, stop };
}
