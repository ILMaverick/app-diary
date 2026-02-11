import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { AudioModule } from 'expo-audio';
import { useWhisperModel } from '../services/whisperService';
import { RealtimeTranscriber } from 'whisper.rn/realtime-transcription/RealtimeTranscriber.js';
import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter.js';
import * as Device from 'expo-device';
import { WhisperContext, WhisperVadContext } from 'whisper.rn/index.js';

export function useVoiceTranscriptionService() {
  const [status, setStatus] = useState<string>('Avvio sistema...');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const [realtimeResult, setRealtimeResult] = useState<string>('');
  const [realtimeFinalResult, setRealtimeFinalResult] = useState<string | null>(null); // serve anche null per la trascrizione live nella UI in homescreen.

  const [error, setError] = useState<string | null>(null);

  const transcriberRef = useRef<RealtimeTranscriber | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const whisperContextRef = useRef<WhisperContext | null>(null);
  const vadContextRef = useRef<WhisperVadContext | null>(null);
  const { initializeWhisperModel } = useWhisperModel();

  // Rilevamento dispositivo Low-End basato sulla RAM (l'indicatore più affidabile della potenza del SoC)
  const totalMemory = Device.totalMemory || 0;
  const isLowEnd = totalMemory > 0 && totalMemory < 4 * 1024 * 1024 * 1024; // Consideriamo "Low End" tutto ciò che è tra 0 e 4 GB

  // Inizializzazione Modello
  useEffect(() => {
    isMountedRef.current = true;

    const setup = async () => {
      try {
        setIsLoading(true);
        setStatus('Preparazione Modello AI...');

        const { whisperContext, vadContext } = await initializeWhisperModel();

        whisperContextRef.current = whisperContext;
        vadContextRef.current = vadContext;

        if (isMountedRef.current) {
          setStatus('Pronto per registrare.');
          setIsLoading(false);
        }
      } catch (err) {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : String(err);
          setStatus('Errore caricamento.');
          setError(msg);
          Alert.alert('Errore', 'Impossibile caricare il modello AI');
          setIsLoading(false);
        }
      }
    };

    setup();

    // Cleanup totale
    return () => {
      isMountedRef.current = false;

      const cleanup = async () => {
        // Ferma la trascrizione se attiva
        if (transcriberRef.current) {
          console.log('Pulizia: Chiusura Transcriber...');
          try {
            await transcriberRef.current.stop();
          } catch (e) {
            console.error('Errore nella chiusura del Transcriber durante la pulizia:', e);
          }
          transcriberRef.current = null;
        }

        // Rilascio del modello VAD
        if (vadContextRef.current) {
          console.log('Pulizia: rilascio del VAD Context');
          try {
            await vadContextRef.current.release();
          } catch (e) {
            console.error('Errore nel rilascio del VAD Context:', e);
          }
          vadContextRef.current = null;
        }

        // Rilascio del modello Whisper
        if (whisperContextRef.current) {
          console.log('Pulizia: rilascio del Whisper Context');
          try {
            await whisperContextRef.current.release();
          } catch (e) {
            console.error('Errore nel rilascio del Context:', e);
          }
          whisperContextRef.current = null;
        }
      };

      cleanup();
    };
    // Disabilita il warning solo per questa riga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRealtimeTranscription = async () => {
    const whisperContext = whisperContextRef.current;
    const vadContext = vadContextRef.current;

    if (!whisperContext || !vadContext) {
      Alert.alert('Attendi', 'Il modello AI non è ancora pronto.');
      return;
    }

    try {
      // Permessi
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permesso negato', 'Abilita il microfono nelle impostazioni.');
        return;
      }

      // Reset Stato UI
      setError(null);
      setRealtimeResult('');
      setRealtimeFinalResult(null);
      setStatus('In Ascolto...');
      setIsRecording(true);

      // Setup Transcriber
      const audioStream = new AudioPcmStreamAdapter();
      const transcriber = new RealtimeTranscriber(
        { whisperContext: whisperContext, vadContext: vadContext, audioStream },
        {
          audioSliceSec: isLowEnd ? 5 : 30,
          vadPreset: 'default',
          autoSliceOnSpeechEnd: true,
          transcribeOptions: {
            language: 'it',
            // Su Low End: 2 Thread
            // Su High End: 4 Thread
            // Oltre 4 Thread non scala sufficientemente
            maxThreads: isLowEnd ? 2 : 4,
            beamSize: isLowEnd ? 1 : 5,
            // Altre opzioni per velocità su low-end:
            bestOf: isLowEnd ? 1 : 3,
            tokenTimestamps: isLowEnd ? false : true, // Disabilita, risparmia CPU},
          },
        },
        {
          onTranscribe: (event) => {
            const text = event.data?.result;
            if (text) {
              setRealtimeResult(text);
              console.log('Live:', text);
            }
          },
          // onVad: (event) => {
          //   console.log('VAD:', event.type);
          // },
          onError: (err) => {
            console.error('Transcriber internal error:', err);
            setError(String(err));
          },
        },
      );

      // Salva istanza nel ref e avvia
      transcriberRef.current = transcriber;
      await transcriber.start();

      console.log('Trascrizione Live avviata');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Start error:', msg);
      setError(msg);
      setStatus('Errore avvio');
      setIsRecording(false);
      Alert.alert('Errore', 'Impossibile avviare la registrazione');
    }
  };

  const stopRealtimeTranscription = async () => {
    try {
      const transcriber = transcriberRef.current;

      if (transcriber) {
        await transcriber.stop();
        transcriberRef.current = null;
      }

      // Finalizza il testo
      setRealtimeResult((current) => {
        const final = current.trim();
        if (final) {
          setRealtimeFinalResult(final);
          console.log('Trascrizione salvata:', final);
        }
        return current;
      });

      setStatus('Pronto per registrare.');
      setIsRecording(false);
      console.log('Stop completato');
    } catch (err) {
      console.error('Stop error:', err);
      setStatus('Errore stop');
    }
  };

  // Wrapper per gestire il pulsante
  const handlePress = async () => {
    if (isRecording) {
      await stopRealtimeTranscription();
    } else {
      await startRealtimeTranscription();
    }
  };

  return {
    isRecording,
    status,
    isLoading,
    realtimeResult,
    realtimeFinalResult,
    error,
    handlePress,
  };
}
