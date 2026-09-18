"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="flex min-h-svh items-center justify-center bg-white p-6 font-sans text-neutral-900">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Capitalia no pudo iniciar</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Ocurrió un error inesperado. Intenta recargar la página.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
