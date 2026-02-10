export default function BannerPage() {
  const baseHeight = 200;
  const containerHeight = baseHeight * 4;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-4">
      <div
        className="w-full max-w-4xl flex overflow-hidden rounded-xl shadow-lg flex-shrink-0"
        style={{
          height: `${containerHeight}px`,
          minHeight: `${containerHeight}px`,
        }}
      >
        <div className="flex-1 flex items-center justify-center bg-blue-600 text-white p-6 min-h-0">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold">DigiUCard</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-start justify-center bg-white text-gray-900 p-6 border-l border-gray-200 min-h-0">
          <h2 className="text-xl font-semibold">Opti Mantra™ - Official Site</h2>
          <p className="mt-2 text-sm text-gray-600">
            The EMR software your practice needs. Affordable, efficient & easy to use. Get started now.
          </p>
          <a
            href="#"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  );
}
