import { useCallback, useRef, useState } from "react";

export type WebcamStatus = "idle" | "requesting" | "ready" | "error";
export type FacingMode = "user" | "environment";

const REQUEST_TIMEOUT_MS = 15000;

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const starting = useRef(false);
  const [status, setStatus] = useState<WebcamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<FacingMode>("user");

  const start = useCallback(async (requestedFacing: FacingMode = "user"): Promise<boolean> => {
    if (starting.current) return false;
    starting.current = true;
    setStatus("requesting");
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Camera request timed out")), REQUEST_TIMEOUT_MS);
    });
    try {
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: requestedFacing },
          audio: false,
        }),
        timeout,
      ]);
      streamRef.current = stream;
      if (!videoRef.current) {
        const v = document.createElement("video");
        v.playsInline = true;
        v.muted = true;
        // Some browsers (notably mobile Safari) never decode a <video> that
        // isn't attached to the document, leaving play() pending forever.
        // Keep it in the DOM but visually and interactively invisible.
        v.style.position = "fixed";
        v.style.top = "0";
        v.style.left = "0";
        v.style.width = "2px";
        v.style.height = "2px";
        v.style.opacity = "0";
        v.style.pointerEvents = "none";
        document.body.appendChild(v);
        videoRef.current = v;
      }
      videoRef.current.srcObject = stream;
      await Promise.race([videoRef.current.play(), timeout]);
      setFacing(requestedFacing);
      setStatus("ready");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      return false;
    } finally {
      clearTimeout(timer);
      starting.current = false;
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
