package com.mecanico.app

import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
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

class MainActivity : ComponentActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView
    private lateinit var speechController: SpeechController
    private lateinit var pickerController: PickerController
    private lateinit var bridge: MecanicoAndroidBridge
    private lateinit var bootstrapCoordinator: InstallBootstrapCoordinator

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

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
        webView.clipToPadding = false

        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val systemBars: Insets = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(0, systemBars.top, 0, systemBars.bottom)
            insets
        }

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
}
