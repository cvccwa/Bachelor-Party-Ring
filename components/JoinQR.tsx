"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

// QR code for the app's own URL (table tents, TV corner).
export function JoinQR({ showUrl = true }: { showUrl?: boolean }) {
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null);

  useEffect(() => {
    const url = window.location.origin;
    QRCode.toString(url, { type: "svg", margin: 1 }).then((svg) => setQr({ svg, url }));
  }, []);

  return (
    <div className="qr">
      {qr && <div dangerouslySetInnerHTML={{ __html: qr.svg }} />}
      {showUrl && qr && <p className="muted">{qr.url.replace(/^https?:\/\//, "")}</p>}
    </div>
  );
}
