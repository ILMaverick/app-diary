import React from 'react';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVoiceTranscriptionService } from '../hooks/useVoiceTranscriptionService';

/**
 * Componente di visualizzazione della schermata principale.
 * Stilizzato interamente con NativeWind (Tailwind CSS).
 */
export default function HomeScreen() {
  const { isRecording, status, isLoading, realtimeResult, realtimeFinalResult, handlePress } =
    useVoiceTranscriptionService();

  // Logica per determinare cosa mostrare nel box di testo
  const displayedText = isRecording
    ? realtimeResult
    : realtimeFinalResult || 'Tocca il pulsante per iniziare...';

  return (
    <SafeAreaView className="flex-1 bg-neutral-100">
      <View className="flex-1 px-5 pt-4">
        {/* Header */}
        <Text className="text-3xl font-bold text-center text-slate-800 mb-8">App Diary 🎙️</Text>

        {/* Card di Controllo */}
        <View className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
          {/* Status Label */}
          <Text className="text-base text-center text-slate-500 italic mb-4 font-medium">
            {status}
          </Text>

          {/* Loading Spinner */}
          {isLoading && <ActivityIndicator size="large" className="text-blue-600 mb-4" />}

          {/* Pulsante Custom */}
          <TouchableOpacity
            onPress={handlePress}
            disabled={isLoading && !isRecording}
            activeOpacity={0.8}
            className={`
              py-4 rounded-xl items-center justify-center shadow-sm
              ${isRecording ? 'bg-red-500' : 'bg-blue-600'}
              ${isLoading && !isRecording ? 'opacity-50' : 'opacity-100'}
            `}
          >
            <Text className="text-white font-bold text-lg tracking-wide uppercase">
              {isRecording ? 'Stop & Salva' : 'Registra Nota'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Area Scrollabile */}
        <View className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Anteprima Testo
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-4">
            <Text
              className={`text-lg leading-8 ${displayedText === realtimeResult ? 'text-slate-800' : 'text-slate-600'}`}
            >
              {displayedText}
            </Text>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
