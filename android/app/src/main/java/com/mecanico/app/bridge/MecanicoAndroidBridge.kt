package com.mecanico.app.bridge

import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import com.mecanico.app.media.PickerController
import com.mecanico.app.media.SpeechController
import org.json.JSONObject

class MecanicoAndroidBridge(
    private val activity: ComponentActivity,
    private val webView: WebView,
    private val speechController: SpeechController,
    private val pickerController: PickerController
) {
    private var pageReady = false
    private val pendingScripts = mutableListOf<String>()

    @JavascriptInterface
    fun startVoiceInput(language: String) {
        activity.runOnUiThread {
            speechController.start(language)
            setVoiceRecording(true)
        }
    }

    @JavascriptInterface
    fun stopVoiceInput() {
        activity.runOnUiThread {
            speechController.stop()
            setVoiceRecording(false)
        }
    }

    @JavascriptInterface
    fun pickAttachments(accept: String, multiple: Boolean, maxFiles: Int) {
        activity.runOnUiThread {
            pickerController.open(
                accept = accept,
                multiple = multiple,
                maxFiles = maxFiles
            )
        }
    }

    @JavascriptInterface
    fun openExternal(url: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                activity.startActivity(intent)
            } catch (error: Exception) {
                sendBridgeError(error.message ?: "No se pudo abrir el enlace externo.")
            }
        }
    }

    fun injectInstallToken(token: String, expiresAt: String) {
        enqueueJavascript(
            """
            window.MecanicoWebApp?.setInstallToken?.(
                ${JSONObject.quote(token)},
                ${JSONObject.quote(expiresAt)}
            )
            """.trimIndent()
        )
    }

    fun sendTranscriptToWeb(transcript: String) {
        enqueueJavascript(
            """
            window.MecanicoWebApp?.receiveVoiceTranscript?.(${JSONObject.quote(transcript)})
            """.trimIndent()
        )
    }

    fun setVoiceRecording(recording: Boolean) {
        enqueueJavascript("window.MecanicoWebApp?.setVoiceRecording?.($recording)")
    }

    fun sendAttachmentsToWeb(attachmentsJson: String) {
        enqueueJavascript(
            """
            window.MecanicoWebApp?.receiveAttachments?.($attachmentsJson)
            """.trimIndent()
        )
    }

    fun sendBridgeError(message: String) {
        enqueueJavascript(
            """
            window.MecanicoWebApp?.receiveBridgeError?.({ message: ${JSONObject.quote(message)} })
            """.trimIndent()
        )
    }

    fun sendSharedIntentToWeb(payloadJson: String) {
        enqueueJavascript(
            """
            (function() {
              window.__mecanicoPendingSharedIntent = $payloadJson;
              if (window.MecanicoWebApp?.receiveSharedIntent) {
                window.MecanicoWebApp.receiveSharedIntent($payloadJson);
              }
            })();
            """.trimIndent()
        )
    }

    fun onPageReady() {
        pageReady = true
        if (pendingScripts.isEmpty()) {
            return
        }

        val scripts = pendingScripts.toList()
        pendingScripts.clear()
        scripts.forEach(::evaluateJavascript)
    }

    fun onPageReset() {
        pageReady = false
    }

    private fun enqueueJavascript(script: String) {
        if (pageReady) {
            evaluateJavascript(script)
        } else {
            pendingScripts += script
        }
    }

    private fun evaluateJavascript(script: String) {
        activity.runOnUiThread {
            webView.evaluateJavascript(script, null)
        }
    }
}
