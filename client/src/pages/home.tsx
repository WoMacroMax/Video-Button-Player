import { useState, useCallback } from "react";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(() => {
    window.open("https://womacromax.com", "_blank");
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.open("https://womacromax.com", "_blank");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-[#667eea] to-[#764ba2]">
      <div className="text-center">
        <h1 
          className="text-white text-2xl md:text-3xl font-semibold mb-6 md:mb-8"
          style={{ textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)" }}
          data-testid="text-title"
        >
          Click the Video Button
        </h1>

        <button
          type="button"
          className="relative w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[280px] md:h-[280px] mx-auto cursor-pointer bg-transparent border-none p-0 block"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Visit womacromax.com website"
          data-testid="button-video"
        >
          <div 
            className="relative w-full h-full rounded-full overflow-hidden transition-shadow duration-300"
            style={{
              boxShadow: isHovered 
                ? "0 15px 50px rgba(0, 0, 0, 0.4)" 
                : "0 10px 40px rgba(0, 0, 0, 0.3)",
              border: "4px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <div 
              className="absolute top-1/2 left-1/2 w-[150%] h-[150%] pointer-events-none"
              style={{
                transform: "translate(-50%, -50%)",
              }}
            >
              <iframe
                src="https://www.youtube.com/embed/M7lc1UVf-VE?autoplay=1&mute=1&loop=1&playlist=M7lc1UVf-VE&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="w-full h-full border-none"
                title="Background Video"
              />
            </div>

            <div 
              className="absolute inset-0 z-10 flex items-center justify-center transition-all duration-300"
              style={{
                background: isHovered 
                  ? "radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 70%)"
                  : "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
              }}
            >
              <div
                className="flex items-center gap-2 bg-white/90 text-[#667eea] px-4 py-2 md:px-6 md:py-3 rounded-full font-semibold text-xs md:text-sm transition-opacity duration-300 pointer-events-none"
                style={{
                  opacity: isHovered ? 1 : 0,
                  visibility: isHovered ? "visible" : "hidden",
                }}
                data-testid="text-click-indicator"
              >
                <span>Visit Site</span>
                <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
