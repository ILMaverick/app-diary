import { useState, useEffect } from "react";
import { Alert, Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { setupWhisperModel, transcribeAudio } from "../services/whisperService";
import { WhisperContext } from "whisper.rn/index.js";

//Custom Hook (Controller) che contiene tutta la logica di Trascrizione Audio -> Testo.

export function useVoiceTranscriptionService() {
  //State del motore Whisper (null se non ancora caricato)
  const [whisperContext, setWhisperContext] = useState<WhisperContext | null>(
    null,
  );

  //Gestione della registrazione audio attiva
  const [recording, setRecording] = useState<Audio.Recording | undefined>(
    undefined,
  );

  //Risultato testuale della trascrizione */
  const [transcription, setTranscription] = useState<string>("");

  //Messaggio di stato da mostrare all'utente nella UI
  const [status, setStatus] = useState<string>("Avvio sistema.");

  //Flag per gestire lo spinner di caricamento
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Viene eseguito una sola volta all'avvio dell'app.
   * Si occupa di scaricare/caricare il modello AI in background.
   * @async
   */
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        setStatus("Preparazione Modello AI");

        // Chiama il servizio per il setup del motore
        setWhisperContext(await setupWhisperModel());
        setStatus("Pronto per registrare.");
      } catch (e) {
        setStatus("Errore caricamento Modello AI.");
        Alert.alert("Errore", "Impossibile caricare il modello AI");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  /**
   * Funzione che gestisce la pressione del tasto di registrazione
   * @async
   */
  async function handlePress() {
    //Se sta già lavorando, ignora il click
    if (isLoading) return;

    //Se sta registrando, si ferma
    if (recording) {
      await stopAndTranscribe();
      return;
    }

    //Se non sta registrando, prova ad avviare se l'AI è pronta
    if (!whisperContext) {
      Alert.alert("Attendi!", "Il modello AI non è ancora pronto.");
      return;
    }

    //Se tutto ok, avvia
    await startRecording();
  }

  /**
   * Richiede i permessi e avvia la registrazione audio.
   * Configura l'audio per alta qualità (necessaria per buona trascrizione).
   * @async
   */
  async function startRecording() {
    try {
      console.log("Verifica permessi:");

      // Controlla se ha già i permessi(senza far apparire l'alert), altrimenti li richiede
      const checkStatus = await Audio.getPermissionsAsync();

      if (checkStatus.status !== "granted") {
        console.log("Permesso mancante. Invio richiesta");
        const requestStatus = await Audio.requestPermissionsAsync();

        if (requestStatus.status !== "granted") {
          Alert.alert(
            "Permesso negato",
            "Devi abilitare il microfono dalle impostazioni.",
          );
          return;
        }
      }

      console.log("Permesso ricevuto. Configuro Audio.");

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log("Avvio registrazione.");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(recording);
      setStatus("Registrazione in corso... (Parla ora)");
      console.log("In Registrazione.");
    } catch (err) {
      console.error("Errore Critico startRecording:", err);
      Alert.alert("Errore: " + err.message);
    }
  }

  /**
   * Funzione di salvataggio pubblico
   *  @async
   */
  /* async function saveToDownloads(privateUri: string) {
    //Funziona solo su Android
    if (Platform.OS !== "android") return;

    try {
      console.log("Avvio procedura salvataggio cartella esterna");

      //Chiede il permesso all'utente di accedere a una cartella
      const saf = FileSystem.StorageAccessFramework;
      const permissionResult = await saf.requestDirectoryPermissionsAsync();

      if (permissionResult.granted) {
        //Legge il file audio privato
        const fileData = await FileSystem.readAsStringAsync(privateUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const newUri = permissionResult.directoryUri;

        //Crea il file pubblico
        const fileName = `Diario_${new Date().getTime()}.m4a`;
        const newFileUri = await saf.createFileAsync(
          newUri,
          fileName,
          "audio/m4a",
        );

        //Scrive i dati
        await FileSystem.writeAsStringAsync(newFileUri, fileData, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log("File salvato esternamente:", newUri);
        Alert.alert(
          "Salvato!",
          "Audio copiato nella cartella: " + newUri + ".",
        );
      } else {
        console.log("Salvataggio annullato.");
      }
    } catch (e) {
      console.error("Errore salvataggio pubblico:", e);
      Alert.alert(
        "Errore Salvataggio",
        "Impossibile salvare il file nella cartella desiderata.",
      );
    }
  } */

  /**
   * Ferma la registrazione, salva il file temporaneo
   * e lo invia al servizio di trascrizione.
   * @async
   */
  async function stopAndTranscribe() {
    if (!recording) return;

    setStatus("Elaborazione e Salvataggio");
    setIsLoading(true); // Blocca il tasto

    try {
      //Stop Registrazione e recupero uri file
      await recording.stopAndUnloadAsync();
      console.log("Registrazione terminata.");
      const uri = recording.getURI();
      console.log("Audio salvato in:", uri);

      //Resetta lo stato della registrazione
      setRecording(undefined);

      //Trascrizione
      if (uri) {
        //Avvio trascrizione
        const text = await transcribeAudio(whisperContext, uri);
        setTranscription(text);

        //Salvataggio Pubblico
        // await saveToDownloads(uri);

        setStatus("Fatto. Premi Registra per una nuova nota.");
      } else {
        setStatus("Errore: File audio non trovato.");
      }
    } catch (err) {
      console.error("Errore trascrizione:", err);
      setStatus("Errore durante la trascrizione.");
      Alert.alert("Errore");
    } finally {
      //Questo sblocca il pulsante in ogni caso
      setIsLoading(false);
    }
  }

  return {
    recording,
    transcription,
    status,
    isLoading,
    handlePress,
  };
}
