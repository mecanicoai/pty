package com.example.mecanico

import android.Manifest
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var speechController: SpeechController
    private lateinit var pickerController: PickerController
    private lateinit var bridge: MecanicoAndroidBridge
    private lateinit var bootstrapCoordinator: InstallBootstrapCoordinator

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        webView = WebView(this)
        setContentView(webView)

        pickerController = PickerController(
            activity = this,
            onAttachmentsReady = { attachmentsJson ->
                bridge.sendAttachmentsToWeb(attachmentsJson)
            },
            onError = { message ->
                bridge.sendBridgeError(message)
            }
        )

        speechController = SpeechController(
            activity = this,
            onRecordingChanged = { recording ->
                bridge.setVoiceRecording(recording)
            },
            onTranscript = { transcript ->
                bridge.sendTranscriptToWeb(transcript)
            },
            onError = { message ->
                bridge.sendBridgeError(message)
            }
        )

        bridge = MecanicoAndroidBridge(
            activity = this,
            webView = webView,
            speechController = speechController,
            pickerController = pickerController
        )

        bootstrapCoordinator = InstallBootstrapCoordinator(
            activity = this,
            webView = webView,
            bridge = bridge
        )

        configureWebView()
        bootstrapCoordinator.start()
    }

    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = true

        webView.addJavascriptInterface(bridge, "MecanicoAndroid")
        webView.webViewClient = object : WebViewClient() {}
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }
    }
}
