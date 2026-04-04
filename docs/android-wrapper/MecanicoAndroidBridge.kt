package com.example.mecanico

import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import org.json.JSONObject

class MecanicoAndroidBridge(
    private val activity: ComponentActivity,
    private val webView: WebView,
    private val speechController: SpeechController,
    private val pickerController: PickerController
) {
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

    fun injectInstallToken(token: String, expiresAt: String) {
        val js = """
            window.MecanicoWebApp?.setInstallToken?.(
                ${JSONObject.quote(token)},
                ${JSONObject.quote(expiresAt)}
            )
        """.trimIndent()
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }

    fun sendTranscriptToWeb(transcript: String) {
        val js = """
            window.MecanicoWebApp?.receiveVoiceTranscript?.(${JSONObject.quote(transcript)})
        """.trimIndent()
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }

    fun setVoiceRecording(recording: Boolean) {
        val js = "window.MecanicoWebApp?.setVoiceRecording?.($recording)"
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }

    fun sendAttachmentsToWeb(attachmentsJson: String) {
        val js = """
            window.MecanicoWebApp?.receiveAttachments?.($attachmentsJson)
        """.trimIndent()
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }

    fun sendBridgeError(message: String) {
        val js = """
            window.MecanicoWebApp?.receiveBridgeError?.({ message: ${JSONObject.quote(message)} })
        """.trimIndent()
        activity.runOnUiThread {
            webView.evaluateJavascript(js, null)
        }
    }
}
