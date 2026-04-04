package com.example.mecanico

import android.webkit.WebView
import androidx.activity.ComponentActivity

class InstallBootstrapCoordinator(
    private val activity: ComponentActivity,
    private val webView: WebView,
    private val bridge: MecanicoAndroidBridge
) {
    fun start() {
        webView.loadUrl("https://your-deployed-mecanico-app.example")

        // Native production flow:
        // 1. get installId
        // 2. call POST /api/install
        // 3. if integrityRequired, request Play Integrity token
        // 4. call POST /api/integrity/verify
        // 5. inject install token with bridge.injectInstallToken(...)
        //
        // This file is intentionally a concrete placeholder for the coordinator
        // where your app/network layer will be wired.
    }
}
