import { StyleSheet, Text, View, Button, ActivityIndicator, ScrollView } from 'react-native';
import { useVoiceTranscriptionService } from '../hooks/useVoiceTranscriptionService';

/**
 * Componente di visualizzazione della schermata principale (View).
 * Si occupa solo di renderizzare la UI usando i dati forniti dagli hooks e i servizi forniti dagli handlers.
 * @returns La View dell'applicazione.
 */

// TODO descrizione da modificare quando ci saranno più schermate

export default function HomeScreen() {
  const { isRecording, status, isLoading, realtimeResult, realtimeFinalResult, handlePress } =
    useVoiceTranscriptionService();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>App - Diary</Text>

      <View style={styles.card}>
        <Text style={styles.statusLabel}>{status}</Text>

        {isLoading && (
          <ActivityIndicator size="large" color="#0000ff" style={{ marginVertical: 10 }} />
        )}

        <View style={styles.btnContainer}>
          <Button
            title={isRecording ? 'STOP & TRASCRIVI' : 'REGISTRA UNA NOTA'}
            onPress={handlePress}
            disabled={isLoading && !isRecording}
            color={isRecording ? '#d32f2f' : '#1976D2'}
          />
        </View>
      </View>

      <ScrollView style={styles.outputBox}>
        <Text style={styles.label}>Testo Rilevato:</Text>
        <Text style={styles.text}>
          {!isRecording && realtimeFinalResult === null
            ? '...'
            : realtimeFinalResult !== null
              ? realtimeFinalResult
              : realtimeResult}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 60,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    color: '#555',
    fontStyle: 'italic',
  },
  statusLabel: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    color: '#555',
    fontStyle: 'italic',
  },
  btnContainer: { marginTop: 5 },
  outputBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
  },
  label: {
    fontWeight: '700',
    marginBottom: 10,
    color: '#333',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
  },
  text: { fontSize: 18, lineHeight: 28, color: '#222' },
});
