// Shared artwork for generated app icons (rendered by next/og ImageResponse).
export function RingMark({ size }: { size: number }) {
  const ring = size * 0.56;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 40%, #2a2216 0%, #0f0d0a 75%)",
      }}
    >
      <div
        style={{
          width: ring,
          height: ring,
          borderRadius: "50%",
          border: `${size * 0.09}px solid #e0b64a`,
          boxShadow: `0 0 ${size * 0.12}px #e0b64a88, inset 0 0 ${size * 0.06}px #7a5a14`,
        }}
      />
    </div>
  );
}
