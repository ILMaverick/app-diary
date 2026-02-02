/**
 * @module WhisperService
 * @description Gestisce la logica di business per l'intelligenza artificiale offline.
 * Si occupa di scaricare il modello, inizializzare il motore C++ e processare l'audio.
 */

import * as FileSystem from "expo-file-system";
import { initWhisper, WhisperContext } from "whisper.rn/index.js";

// URL diretto al modello quantizzato (Tiny) su HuggingFace.
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";

// Nome del file con cui il modello verrà salvato nella cache del dispositivo.
const MODEL_FILENAME = "ggml-base.bin";

/**
 * Controlla se il trascrittore è presente nel dispositivo. Se assente, lo scarica.
 * Successivamente inizializza il motore Whisper.
 * @async
 * @returns {Promise<WhisperContext>} Il contesto di Whisper inizializzato.
 */
export const setupWhisperModel = async (): Promise<WhisperContext> => {
  try {
    //Controllo percorso che non sia undefined
    console.log("[WhisperService] Directory documenti:", documentDirectory);

    if (!documentDirectory) {
      throw new Error(
        "[WhisperService] Impossibile trovare la cartella documenti del telefono.",
      );
    }

    const fileUri = `${documentDirectory}${MODEL_FILENAME}`;

    if (!(await getInfoAsync(fileUri)).exists) {
      console.log("[WhisperService] Modello non trovato. Inizio download...");

      // Scarica il file
      await downloadAsync(MODEL_URL, fileUri);

      console.log("[WhisperService] Download completato.");
    } else {
      console.log("[WhisperService] Modello trovato in cache locale.");
    }

    // Inizializza Whisper
    console.log("[WhisperService] Inizializzazione Modello");
    const context = await initWhisper({ filePath: fileUri });
    return context as WhisperContext;
  } catch (error) {
    console.error("[WhisperService] Errore critico nel setup:", error);
    throw error;
  }
};

/**
 * Esegue la trascrizione di un file audio locale.
 * @param {string} audioUri - L'URI locale del file audio registrato.
 * @returns {Promise<string>} Il testo trascritto.
 */
export const transcribeAudio = async (
  whisperContext: WhisperContext,
  audioUri: string,
): Promise<string> => {
  if (!whisperContext) {
    throw new Error("Il motore Whisper non è stato inizializzato.");
  }

  console.log("[WhisperService] Inizio trascrizione audio:", audioUri);

  try {
    // TODO audio presente ma testo non convertito
    const sampleFilePath = "file://.../sample.wav";
    const options = { language: "en" };
    const { stop, promise } = whisperContext.transcribe(
      sampleFilePath,
      options,
    );

    const { result } = await promise;

    // DEBUG: Serve per controllare cosa restituisce esattamente
    console.log("[WhisperService] Risultato Grezzo:", result);

    const text = result?.trim();

    if (!text || text.length === 0) {
      console.log("[WhisperService] Attenzione: Testo vuoto rilevato");
      return "[Nessun parlato rilevato - Controlla il microfono]";
    }

    console.log("[WhisperService] Trascrizione completata:", text);
    return text;
  } catch (err) {
    console.error("[WhisperService] Errore durante la trascrizione:", err);
    throw err;
  }
};
