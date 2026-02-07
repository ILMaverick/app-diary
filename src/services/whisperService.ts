/**
 * @module WhisperService
 * @description Gestisce la logica di business per l'intelligenza artificiale offline.
 * Si occupa di scaricare il modello, inizializzare il motore C++ e processare l'audio.
 */

import { useState, useCallback } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { RealtimeTranscriber } from 'whisper.rn/realtime-transcription/RealtimeTranscriber.js';
import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter.js';
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

// URL diretto al modello quantizzato "Base" su HuggingFace.
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const MODEL_VAD_URL =
  'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin';

// Nome del file con cui il modello verrà salvato nella cache del dispositivo.
const MODEL_FILENAME = 'ggml-base.bin';
const MODEL_VAD_FILENAME = 'ggml-silero-v6.2.0.bin';

/**
 * Controlla se il trascrittore è presente nel dispositivo. Se assente, lo scarica.
 * Successivamente inizializza il motore Whisper.
 * @async
 */
export function useWhisperModel() {
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(null);
  const [vadContext, setVadContext] = useState<WhisperVadContext | null>(null);

  //Controllo se esiste la cartella passata come argomento dentro DocumentDirectory, altrimenti la creo.
  const createDirectory = useCallback((directoryName: string) => {
    let documentDirectory: Directory;

    try {
      documentDirectory = Paths.document;
    } catch (error) {
      console.log(error);
      throw new Error('[WhisperService] Impossibile trovare la cartella documenti del telefono.');
    }

    //Controllo il percorso che non sia undefined.
    console.log('[WhisperService] Directory documenti:', documentDirectory.uri);

    const directory = new Directory(documentDirectory, directoryName);
    directory.create({ idempotent: true, intermediates: true });
    return directory;
  }, []);

  //Scarico il modello. Tramite la variabile "percent" è possibile monitorare la progressione del download.
  const downloadModel = useCallback(async (modelURI: string, modelUrl: string) => {
    try {
      const downloadResumable = createDownloadResumable(
        modelUrl,
        modelURI,
        undefined,
        (downloadProgress: DownloadProgressData) => {
          const progress =
            downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;

          const percent = (progress * 100).toFixed(1);
          console.log(`[WhisperService] Download: ${percent}%`);
        },
      );

      const result = (await downloadResumable.downloadAsync()) as
        | FileSystemDownloadResult
        | undefined;

      if (result) {
        console.log('[WhisperService] Download completato.', result.uri);
        return result.uri;
      }
    } catch (e) {
      console.error('[WhisperService] Errore durante il download:', e);
    }
  }, []);

  //Controllo che il modello sia presente nella cartella "whisper-models", dentro documentDirectory, altrimenti lo scarico tramite la funzione downloadModel().
  const getModel = useCallback(
    async (modelFileName: string, modelDirectoryName: string, modelUrl: string) => {
      const modelDirectory = createDirectory(modelDirectoryName);

      const model = new File(modelDirectory, modelFileName);

      let modelExist;
      try {
        modelExist = model.info();
      } catch (err) {
        console.warn('[WhisperService] Modello non trovato.');
        modelExist = { exists: false };
      }

      if (modelExist.exists) {
        console.log('[WhisperService] Modello trovato in cache locale: ', modelExist.uri);
      } else {
        console.log('[WhisperService] Inizio download.');
        await downloadModel(model.uri, modelUrl);
      }
      return model.uri;
    },
    [createDirectory, downloadModel],
  );

  //Inizializzo il modello Whisper (e il modello WhisperVAD).
  const initializeWhisperModel = useCallback(async () => {
    try {
      console.log(`[WhisperService] Inizializzazione Whisper model: ${MODEL_FILENAME}`);

      try {
        //Recupero il modello dalla cache, altrimenti lo scarico
        const modelPath = await getModel(MODEL_FILENAME, 'whisper-models', MODEL_URL);

        // Inizializzo Whisper context
        const context = await initWhisper({
          filePath: modelPath,
        });
        setWhisperContext(context);
        console.log(
          `[WhisperService] Whisper context inizializzato per il modello: ${MODEL_FILENAME}`,
        );
      } catch (error) {
        console.warn('[WhisperService] Whisper Context inizializzazione fallita:', error);
      }
      console.log('[WhisperService] Inizializzazione VAD context.');

      try {
        const vadPath = await getModel(MODEL_VAD_FILENAME, 'whisper-model-VAD', MODEL_VAD_URL);

        const vad = await initWhisperVad({
          filePath: vadPath,
        });
        setVadContext(vad);
        console.log(
          `[WhisperService] VAD context inzializzato per il modello: ${MODEL_VAD_FILENAME}`,
        );
      } catch (error) {
        console.warn('[WhisperService] VAD inizializzazione fallita:', error);
      }
    } catch (error) {
      console.error("[WhisperService] Errore durante l'inizializzazione:", error);
      throw error;
    }
  }, [getModel]);

  return {
    whisperContext,
    vadContext,
    initializeWhisperModel,
  };
}
