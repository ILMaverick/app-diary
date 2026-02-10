/**
 * @module WhisperService
 * @description Gestisce la logica di business per l'intelligenza artificiale offline.
 */

import { useState, useCallback } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import {
  createDownloadResumable,
  type DownloadProgressData,
  type FileSystemDownloadResult,
} from 'expo-file-system/legacy';
import {
  initWhisper,
  initWhisperVad,
  WhisperContext,
  WhisperVadContext,
} from 'whisper.rn/index.js';

const MODELS_DIR = 'whisper-models'; //Unica cartella per tutti i modelli

const WHISPER_CONFIG = {
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin',
  filename: 'ggml-base-q5_1.bin',
};

const VAD_CONFIG = {
  url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin',
  filename: 'ggml-silero-v6.2.0.bin',
};

/**
 * Assicura che la directory dei modelli esista e restituisce l'oggetto Directory.
 */
const getModelsDirectory = (): Directory => {
  try {
    const documentDirectory = Paths.document;
    if (!documentDirectory) throw new Error('[WhisperService] Document directory non disponibile');

    // Crea la cartella "whisper-models" se non esiste
    const directory = new Directory(documentDirectory, MODELS_DIR);
    if (!directory.exists) {
      directory.create();
    }
    return directory;
  } catch (error) {
    console.error('[WhisperService] Errore directory:', error);
    throw new Error('[WhisperService] Impossibile creare la cartella modelli.');
  }
};

/**
 * Scarica un file specifico se non esiste già.
 */
const ensureFileExists = async (filename: string, url: string): Promise<string> => {
  const directory = getModelsDirectory();
  const file = new File(directory, filename);

  //Controllo se esiste
  if (file.exists) {
    console.log(`[WhisperService] Modello in cache: ${filename}`);
    return file.uri;
  }

  //Se non esiste, lo scarico
  console.log(`[WhisperService] Inizio download: ${filename}`);
  try {
    const downloadResumable = createDownloadResumable(
      url,
      file.uri,
      undefined,
      (progress: DownloadProgressData) => {
        const percent = (
          (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) *
          100
        ).toFixed(0);
        console.log(`[Download ${filename}]: ${percent}%`);
      },
    );

    const result = (await downloadResumable.downloadAsync()) as
      | FileSystemDownloadResult
      | undefined;

    if (!result || result.status !== 200) {
      throw new Error(`Download fallito con status: ${result?.status}`);
    }

    console.log(`[WhisperService] Download completato: ${filename}`);
    return result.uri;
  } catch (error) {
    //Se il download fallisce, puliamo il file parziale/corrotto
    if (file.exists) {
      file.delete();
    }
    throw error;
  }
};

export function useWhisperModel() {
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(null);
  const [vadContext, setVadContext] = useState<WhisperVadContext | null>(null);

  const initializeWhisperModel = useCallback(async () => {
    try {
      console.log('[WhisperService] Avvio inizializzazione parallela...');

      //Scarichiamo/Verifichiamo entrambi i file in PARALLELO.
      //Promise.all aspetta che entrambi siano pronti.
      const [whisperPath, vadPath] = await Promise.all([
        ensureFileExists(WHISPER_CONFIG.filename, WHISPER_CONFIG.url),
        ensureFileExists(VAD_CONFIG.filename, VAD_CONFIG.url),
      ]);

      console.log('[WhisperService] File pronti. Inizializzazione motori...');

      //Init Whisper
      const wContext = await initWhisper({ filePath: whisperPath });
      setWhisperContext(wContext);
      console.log('✅ Whisper Context Pronto');

      //Init VAD
      const vContext = await initWhisperVad({ filePath: vadPath });
      setVadContext(vContext);
      console.log('✅ VAD Context Pronto');

      return { whisperContext: wContext, vadContext: vContext };
    } catch (error) {
      console.error('[WhisperService] FATAL ERROR:', error);
      throw error;
    }
  }, []);

  return {
    whisperContext,
    vadContext,
    initializeWhisperModel,
  };
}
