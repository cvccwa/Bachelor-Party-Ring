import { ImageResponse } from "next/og";
import { RingMark } from "@/components/RingMark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<RingMark size={512} />, size);
}
