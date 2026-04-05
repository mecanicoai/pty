package com.mecanico.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import com.mecanico.app.bridge.MecanicoAndroidBridge
import com.mecanico.app.databinding.ActivityMainBinding
import com.mecanico.app.integration.BackendApi
import com.mecanico.app.integration.InstallBootstrapCoordinator
import com.mecanico.app.integration.InstallIdentityStore
import com.mecanico.app.integration.PlayIntegrityManager
import com.mecanico.app.media.PickerController
import com.mecanico.app.media.SpeechController
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView
    private lateinit var speechController: SpeechController
    private lateinit var pickerController: PickerController
    private lateinit var bridge: MecanicoAndroidBridge
    private lateinit var bootstrapCoordinator: InstallBootstrapCoordinator

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        webView = binding.webView

        pickerController = PickerController(
            activity = this,
            onAttachmentsJsonReady = { attachmentsJson ->
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

        val backendApi = BackendApi(baseUrl = BuildConfig.MECANICO_BASE_URL)
        val installIdentityStore = InstallIdentityStore(this)
        val playIntegrityManager = PlayIntegrityManager(this)

        bootstrapCoordinator = InstallBootstrapCoordinator(
            activity = this,
            webView = webView,
            bridge = bridge,
            backendApi = backendApi,
            installIdentityStore = installIdentityStore,
            playIntegrityManager = playIntegrityManager
        )

        configureWebView()

        lifecycleScope.launch {
            bootstrapCoordinator.start()
        }

        handleIncomingShareIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingShareIntent(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        speechController.stop()
    }

    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = true

        webView.addJavascriptInterface(bridge, "MecanicoAndroid")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                bridge.onPageReset()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                bridge.onPageReady()
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }
        }
    }

    private fun handleIncomingShareIntent(intent: Intent?) {
        if (intent == null) {
            return
        }

        if (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE) {
            return
        }

        lifecycleScope.launch {
            try {
                val payload = JSONObject()
                val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
                if (sharedText.isNotBlank()) {
                    payload.put("sharedText", sharedText)
                }

                val uris = extractShareUris(intent)
                if (uris.isNotEmpty()) {
                    payload.put(
                        "attachments",
                        org.json.JSONArray(
                            pickerController.buildAttachmentsJson(contentResolver, uris)
                        )
                    )
                }

                payload.put("sourceApp", detectSourceApp(intent))
                payload.put("receivedAt", java.time.Instant.now().toString())

                if (payload.length() > 0) {
                    bridge.sendSharedIntentToWeb(payload.toString())
                }
            } catch (error: Exception) {
                bridge.sendBridgeError(error.message ?: "No se pudo importar el contenido compartido.")
            }
        }
    }

    private fun detectSourceApp(intent: Intent): String {
        val referrerHost = referrer?.host?.lowercase().orEmpty()
        val callerPackage = callingActivity?.packageName?.lowercase().orEmpty()
        return if (referrerHost.contains("whatsapp") || callerPackage.contains("whatsapp")) {
            "whatsapp"
        } else {
            "android-share"
        }
    }

    @Suppress("DEPRECATION")
    private fun extractShareUris(intent: Intent): List<Uri> {
        return when (intent.action) {
            Intent.ACTION_SEND -> {
                val uri =
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                    } else {
                        intent.getParcelableExtra(Intent.EXTRA_STREAM)
                    }
                listOfNotNull(uri)
            }

            Intent.ACTION_SEND_MULTIPLE -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)?.toList().orEmpty()
                } else {
                    intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.toList().orEmpty()
                }
            }

            else -> emptyList()
        }
    }
}
