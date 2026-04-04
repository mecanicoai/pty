package com.mecanico.app.media

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import java.util.Locale

class SpeechController(
    private val activity: ComponentActivity,
    private val onRecordingChanged: (Boolean) -> Unit,
    private val onTranscript: (String) -> Unit,
    private val onError: (String) -> Unit
) {
    private var recognizer: SpeechRecognizer? = null
    private var pendingLanguage: String? = null

    private val permissionLauncher =
        activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val language = pendingLanguage
            pendingLanguage = null

            if (granted && language != null) {
                startRecognition(language)
            } else if (!granted) {
                onRecordingChanged(false)
                onError("Se requiere permiso de microfono.")
            }
        }

    fun start(language: String) {
        stop()

        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            onError("El dispositivo no soporta reconocimiento de voz.")
            return
        }

        val hasPermission = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            pendingLanguage = language
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            return
        }

        startRecognition(language)
    }

    private fun startRecognition(language: String) {
        recognizer = SpeechRecognizer.createSpeechRecognizer(activity).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    onRecordingChanged(true)
                }

                override fun onResults(results: Bundle?) {
                    val transcript = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                        ?.trim()
                        .orEmpty()

                    if (transcript.isNotBlank()) {
                        onTranscript(transcript)
                    }

                    onRecordingChanged(false)
                    stop()
                }

                override fun onError(error: Int) {
                    onRecordingChanged(false)
                    onError("No se pudo capturar audio.")
                    stop()
                }

                override fun onBeginningOfSpeech() = Unit
                override fun onBufferReceived(buffer: ByteArray?) = Unit
                override fun onEndOfSpeech() = Unit
                override fun onEvent(eventType: Int, params: Bundle?) = Unit
                override fun onPartialResults(partialResults: Bundle?) = Unit
                override fun onRmsChanged(rmsdB: Float) = Unit
            })
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, normalizeLanguage(language))
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        recognizer?.startListening(intent)
    }

    fun stop() {
        recognizer?.stopListening()
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
    }

    private fun normalizeLanguage(language: String): String {
        return when (language.lowercase(Locale.US)) {
            "en" -> "en-US"
            else -> "es-MX"
        }
    }
}
