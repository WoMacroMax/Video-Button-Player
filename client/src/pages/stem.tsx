export default function StemPage() {
  return (
    <div className="w-full h-screen" data-testid="stem-page">
      <iframe
        src="/stem.html"
        className="w-full h-full border-0"
        title="StemSplit - AI Audio Separation"
        allow="autoplay; microphone"
        data-testid="stem-iframe"
      />
    </div>
  );
}
