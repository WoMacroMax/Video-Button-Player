"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import Home from "@/pages/home";

const IFRAME_URL = "https://rodbiz.digiucard.com/";

function getShareUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

export default function LiveBannerPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const openModal = useCallback(() => {
    setModalOpen(true);
    setIframeLoaded(false);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const shareUrl = getShareUrl();
  const handleCopyLink = useCallback(() => {
    if (shareUrl) navigator.clipboard.writeText(shareUrl).catch(() => {});
  }, [shareUrl]);

  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-[#f5f5f5] pt-5 px-5 pb-5 max-[600px]:pt-2.5 max-[600px]:px-2.5 max-[600px]:pb-2.5">
      <div
        className="w-full max-w-[1400px] mx-auto bg-white rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.1)] grid grid-cols-[55%_45%] h-[300px] max-[1200px]:grid-cols-[50%_50%] max-[1200px]:h-[275px] max-[900px]:grid-cols-[45%_55%] max-[900px]:h-[250px] max-[600px]:grid-cols-[40%_60%] max-[600px]:h-[225px] max-[400px]:grid-cols-[35%_65%] max-[400px]:h-[200px]"
        role="banner"
        aria-label="Live promotional banner"
      >
        <section
          id="brand"
          className="relative flex items-center justify-center overflow-hidden bg-gray-100 p-0"
          aria-label="Brand"
        >
          <div className="w-full h-full min-h-0">
            <Home embed embedFillContainer embedNoBorder />
          </div>
        </section>
        <section
          id="promo"
          className="py-6 px-8 flex flex-col justify-center bg-white overflow-hidden border-l border-gray-200 max-[1200px]:py-5 max-[1200px]:px-7 max-[900px]:py-4 max-[900px]:px-6 max-[600px]:py-4 max-[600px]:px-4 max-[400px]:py-3 max-[400px]:px-4"
          aria-label="Promo"
        >
          <div className="text-[clamp(10px,1.2vw,13px)] text-[#7f8c8d] mb-1.5 font-medium tracking-wide">
            Opti Mantra
          </div>
          <h1 className="text-[clamp(18px,2.5vw,28px)] font-bold text-[#2c3e50] mb-2.5 leading-tight">
            OptiMantra™ - Official Site
          </h1>
          <p className="text-[clamp(12px,1.5vw,15px)] text-[#555] leading-relaxed mb-3.5">
            The EMR software your practice needs. Affordable, efficient & easy to
            use. Get started now
          </p>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 bg-[#3498db] text-white py-2.5 px-5 rounded-full font-semibold text-[clamp(12px,1.3vw,14px)] transition-all duration-300 shadow-[0_3px_12px_rgba(52,152,219,0.3)] border-none cursor-pointer self-start hover:bg-[#2980b9] hover:-translate-y-0.5 hover:shadow-[0_5px_16px_rgba(52,152,219,0.4)]"
          >
            Learn more
            <span className="text-[clamp(16px,1.5vw,20px)] transition-transform duration-300 group-hover:translate-x-1">
              ›
            </span>
          </button>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setQrModalOpen(true)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-12 rounded-full bg-[#3498db] text-white shadow-lg hover:bg-[#2980b9] hover:shadow-xl transition-all z-10"
        aria-label="Share page (QR code)"
        data-testid="button-qr-share"
      >
        <QrCode className="w-6 h-6" />
      </button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="w-[95vw] max-w-[1400px] h-[90vh] p-0 gap-0 border-0 flex flex-col [&>button]:hidden"
          onPointerDownOutside={closeModal}
          onEscapeKeyDown={closeModal}
        >
          <div className="flex justify-between items-center py-5 px-6 bg-[#3498db] text-white shrink-0">
            <DialogTitle className="text-xl font-semibold m-0">
              OptiMantra - Get Started
            </DialogTitle>
            <button
              type="button"
              onClick={closeModal}
              className="bg-transparent border-none text-white text-3xl cursor-pointer p-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/20 leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="relative flex-1 min-h-0">
            {!iframeLoaded && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-white"
                aria-hidden
              >
                <div className="w-14 h-14 border-4 border-gray-200 border-t-[#3498db] rounded-full animate-spin" />
              </div>
            )}
            <iframe
              src={modalOpen ? IFRAME_URL : undefined}
              title="OptiMantra Information"
              className="w-full h-full border-0 block"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setIframeLoaded(true)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-center">Share this page</DialogTitle>
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG value={shareUrl} size={200} level="M" />
            </div>
            <div className="w-full">
              <div className="bg-muted rounded-md px-3 py-2 text-sm text-muted-foreground break-all">
                {shareUrl}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-3 rounded-lg bg-[#3498db] text-white font-semibold hover:bg-[#2980b9] transition-colors"
            >
              Copy link
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
