import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

interface UseQrScannerOptions {
  enabled: boolean;
  paused: boolean;
  onDetect: (value: string) => void;
}

interface UseQrScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  error: string | null;
}

const DETECTION_INTERVAL_MS = 100; // ~10 FPS

export function useQrScanner({
  enabled,
  paused,
  onDetect,
}: UseQrScannerOptions): UseQrScannerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState<string | null>(null);

  // Keep callback ref current without restarting effects
  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  // Camera lifecycle
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Camera access is required for scanning. Please allow camera access and try again.",
          );
        }
      });

    const video = videoRef.current;

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (video) {
        video.srcObject = null;
      }
    };
  }, [enabled]);

  // Detection loop
  useEffect(() => {
    if (!enabled || paused) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;

    let rafId: number;
    let lastTime = 0;
    let detected = false;

    function tick(timestamp: number) {
      rafId = requestAnimationFrame(tick);

      if (detected) return;
      if (timestamp - lastTime < DETECTION_INTERVAL_MS) return;
      lastTime = timestamp;

      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA)
        return;

      const { videoWidth, videoHeight } = video;
      if (videoWidth === 0 || videoHeight === 0) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = videoWidth;
      canvas.height = videoHeight;
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

      const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
      const result = jsQR(imageData.data, videoWidth, videoHeight);

      if (result) {
        detected = true;
        onDetectRef.current(result.data);
      }
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [enabled, paused]);

  return { videoRef, error };
}
