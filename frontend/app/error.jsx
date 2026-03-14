"use client";

export default function Error({ reset }) {
  return (
    <div className="min-h-screen bg-white px-6 py-8 flex items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-3xl font-bold text-[#1A1A1A] mb-3">
          Qualcosa e andato storto
        </h1>
        <p className="text-[#6B7280] mb-6">
          Si e verificato un errore imprevisto durante il caricamento della pagina.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-full bg-[#2B7AB8] hover:bg-[#236699] text-white px-6 py-3 font-semibold"
        >
          Riprova
        </button>
      </div>
    </div>
  );
}
