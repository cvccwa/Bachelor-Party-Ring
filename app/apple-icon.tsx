import { ImageResponse } from "next/og";
import { RingMark } from "@/components/RingMark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<RingMark size={180} />, size);
}
