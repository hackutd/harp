import { QRCodeSVG } from "qrcode.react";

import { cn } from "@/shared/lib/utils";

interface HackerQRProps {
  value: string;
  size?: number;
  className?: string;
}

export function HackerQR({ value, size = 200, className }: HackerQRProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-white p-4",
        className,
      )}
    >
      <QRCodeSVG value={value} size={size} level="M" />
    </div>
  );
}
