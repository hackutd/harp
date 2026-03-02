import { useEffect, useRef, useState } from "react";

interface UseQrScannerOptions {
  enabled: boolean;
  paused: boolean;
  onDetect: (value: string) => void;
}

interface UseQrScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  error: string | null;
  supported: boolean;
}

const DETECTION_INTERVAL_MS = 100; // ~10 FPS

export function useQrScanner({
  enabled,
  paused,
  onDetect,
}: UseQrScannerOptions): UseQrScannerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState<string | null>(null);

  const supported = "BarcodeDetector" in window;

  // Keep callback ref current without restarting effects
  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  // Camera lifecycle
  useEffect(() => {
    if (!enabled || !supported) return;

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
  }, [enabled, supported]);

  // Detection loop
  useEffect(() => {
    if (!enabled || paused || !supported) return;

    const detector = new BarcodeDetector({ formats: ["qr_code"] });
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

      detector
        .detect(video)
        .then((barcodes) => {
          if (detected || barcodes.length === 0) return;
          detected = true;
          onDetectRef.current(barcodes[0].rawValue);
        })
        .catch(() => {
          // Detection errors are non-fatal, continue loop
        });
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [enabled, paused, supported]);

  return { videoRef, error, supported };
}
