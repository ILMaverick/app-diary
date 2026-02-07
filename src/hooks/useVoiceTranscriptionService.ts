import { useState, useEffect } from 'react';
// eslint-disable-next-line prettier/prettier
import { Alert } from 'react-native';
import { AudioModule } from 'expo-audio';
import { useWhisperModel } from '../services/whisperService';
import { RealtimeTranscriber } from 'whisper.rn/realtime-transcription/RealtimeTranscriber.js';
import { AudioPcmStreamAdapter } from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter.js';

//Custom Hook (Controller) che contiene tutta la logica di Trascrizione Audio -> Testo.

export function useVoiceTranscriptionService() {
  //Messaggio di stato da mostrare all'utente nella UI
  const [status, setStatus] = useState<string>('Avvio sistema.');

  //Flag per gestire lo spinner di caricamento
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [realtimeTranscriber, setRealtimeTranscriber] = useState<RealtimeTranscriber | null>(null);
  const [realtimeResult, setRealtimeResult] = useState<string | null>(null);
  const [realtimeFinalResult, setRealtimeFinalResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const { whisperContext, vadContext, initializeWhisperModel } = useWhisperModel();

  /**
   * Viene eseguito una sola volta all'avvio dell'app.
   * Si occupa di scaricare/caricare il modello AI in background.
   * @async
   */
  useEffect(() => {
    try {
      setIsLoading(true);
      setStatus('Preparazione Modello AI');
      // Chiama il servizio per il setup del modello
      initializeWhisperModel();
      setStatus('Pronto per registrare.');
    } catch (e) {
      setStatus('Errore caricamento Modello AI.');
      Alert.alert('Errore', 'Impossibile caricare il modello AI');
    } finally {
      setIsLoading(false);
    }
  }, [initializeWhisperModel]);

  /**
   * Funzione che gestisce la pressione del tasto di registrazione
   * @async
   */
  async function handlePress() {
    //Se sta registrando, si ferma
    if (isRecording) {
      await stopRealtimeTranscription();
      return;
    }

    //Se tutto ok, avvia
    await startRealtimeTranscription();
  }

  const startRealtimeTranscription = async () => {
    if (!whisperContext || !vadContext) {
      Alert.alert('Attendi!', 'Il modello AI non è ancora pronto.');
      return;
    }

    const audioStream = new AudioPcmStreamAdapter();
    const transcriber = new RealtimeTranscriber(
      { whisperContext, vadContext, audioStream },
      {
        audioSliceSec: 30,
        vadPreset: 'default',
        autoSliceOnSpeechEnd: true,
        transcribeOptions: { language: 'it' },
      },
      {
        onTranscribe: (event) => {
          if (event.data?.result) {
            setRealtimeResult(event.data?.result);
            console.log('Transcription:', event.data?.result);
          }
        },
        onVad: (event) => console.log('VAD:', event.type, event.confidence),
        onStatusChange: (isActive) => console.log('Status:', isActive ? 'ACTIVE' : 'INACTIVE'),
        onError: (error) => console.error('Error:', error),
      },
    );

    setRealtimeTranscriber(transcriber);
    try {
      // richiede i permessi per il microfono
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permesso negato', 'Devi abilitare il microfono dalle impostazioni.');
        return;
      }

      setIsRecording(true);
      setStatus('In Ascolto...');
      setRealtimeFinalResult('');
      setError('');

      console.log('Trascrizione Live avviata');

      transcriber.start();
    } catch (err) {
      const errorMessage = `Trascrizione Live fallita: ${err}`;
      console.error(errorMessage);
      setError(errorMessage);
      Alert.alert('Trascrizione Live fallita:', errorMessage);
      setIsRecording(false);
    }
  };

  const stopRealtimeTranscription = async () => {
    try {
      if (realtimeTranscriber) {
        await realtimeTranscriber.stop();
        setRealtimeTranscriber(null);
      }

      // Capture the final result before clearing
      if (realtimeResult) {
        const finalTranscript = realtimeResult.trim();
        setRealtimeFinalResult(finalTranscript);
        console.log('Trascrizione finale:', finalTranscript);
      }
      setStatus('Pronto per registrare.');
      setIsRecording(false);
      console.log('Trascrizione Live terminata');
    } catch (err) {
      console.error('Errore durante la chiusura della trascrizione Live:', err);
    }
  };

  return {
    isRecording,
    status,
    isLoading,
    realtimeResult,
    realtimeFinalResult,
    handlePress,
  };
}
