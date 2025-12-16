import { randomUUID } from "crypto";
import Elysia, { t } from "elysia";
import { mkdir } from "fs/promises";
import { extname, join, resolve } from "path";
import { betterAuthMacro } from "../lib/auth/server";

// Opzioni di configurazione per la gestione dei file caricati

// Directory di base per i file caricati
const UPLOAD_ROOT = join(process.cwd(), "uploads");
// Dimensione massima per le immagini
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
// Tipi di file supportati per le immagini
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * @description Verifica che il percorso del file sia all'interno della directory di base per i file caricati
 * @param targetPath Percorso del file da verificare
 * @returns Percorso del file normalizzato
 */
const ensureWithinUploadRoot = (targetPath: string) => {
  const normalized = resolve(targetPath);
  const normalizedRoot = resolve(UPLOAD_ROOT);

  if (!normalized.startsWith(normalizedRoot)) throw new Error("Invalid path");

  return normalized;
};

/**
 * @description Converte il tipo MIME in un'estensione di file
 * @param mime Tipo MIME del file
 * @returns Estensione del file
 */
const mimeToExtension = (mime?: string | null) => {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
};

/**
 * @description Routes per la gestione dei file caricati
 */
export const uploads = new Elysia({ prefix: "/uploads" })
  // Monta la macro per la gestione dell'autenticazione
  .use(betterAuthMacro)
  // Route per caricare una foto profilo
  .post(
    "/profile",
    async ({ body, user }) => {
      const file = body.file;

      const extension =
        extname(file.name || "") || mimeToExtension(file.type) || ".jpg";
      const filename = `${randomUUID()}${extension}`;
      const userFolder = join(UPLOAD_ROOT, user.id);

      // Crea la directory per l'utente se non esiste
      await mkdir(userFolder, { recursive: true });

      const filePath = ensureWithinUploadRoot(join(userFolder, filename));

      // Converte il file in un array di byte
      const arrayBuffer = await file.arrayBuffer();
      await Bun.write(filePath, arrayBuffer);

      // Genera l'URL del file e lo ritorna
      const baseUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "";
      const url = `${baseUrl}/uploads/${encodeURIComponent(
        user.id
      )}/${encodeURIComponent(filename)}`;

      return { url };
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: MAX_IMAGE_SIZE,
          type: Array.from(ALLOWED_MIME),
        }),
      }),
      auth: true,
    }
  )
  // Route per ottenere un file caricato
  .get("/:userId/:fileName", async ({ params, set }) => {
    const sanitizedUser = params.userId.replace(/[^a-zA-Z0-9_-]/g, "");

    // Verifica che il percorso del file sia all'interno della directory di base per i file caricati
    const filePath = ensureWithinUploadRoot(
      join(UPLOAD_ROOT, sanitizedUser, params.fileName)
    );
    const file = Bun.file(filePath);

    // Se il file non esiste, ritorna un errore
    if (!(await file.exists())) {
      set.status = 404;
      return { error: "File not found" };
    }

    // Imposta headers per il file
    set.headers["content-type"] = file.type || "application/octet-stream";
    set.headers["cache-control"] = "public, max-age=31536000";

    return file;
  });
