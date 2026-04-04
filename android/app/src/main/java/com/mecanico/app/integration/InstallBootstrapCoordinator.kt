package com.mecanico.app.integration

import android.webkit.WebView
import androidx.activity.ComponentActivity
import com.mecanico.app.BuildConfig
import com.mecanico.app.bridge.MecanicoAndroidBridge
import com.mecanico.app.model.IntegrityVerifyRequest
import com.mecanico.app.model.InstallBootstrapRequest

class InstallBootstrapCoordinator(
    private val activity: ComponentActivity,
    private val webView: WebView,
    private val bridge: MecanicoAndroidBridge,
    private val backendApi: BackendApi,
    private val installIdentityStore: InstallIdentityStore,
    private val playIntegrityManager: PlayIntegrityManager
) {
    suspend fun start() {
        val installId = installIdentityStore.getOrCreateInstallId()
        webView.loadUrl(BuildConfig.MECANICO_BASE_URL)

        val bootstrap = backendApi.bootstrapInstall(
            InstallBootstrapRequest(
                installId = installId,
                platform = "android",
                appVersion = BuildConfig.VERSION_NAME
            )
        )

        if (!bootstrap.token.isNullOrBlank() && !bootstrap.expiresAt.isNullOrBlank()) {
            bridge.injectInstallToken(bootstrap.token, bootstrap.expiresAt)
            return
        }

        val integrityBootstrap = bootstrap.integrity
            ?: throw IllegalStateException("No se recibio el desafio de integridad.")

        val integrityToken = playIntegrityManager.requestIntegrityToken(integrityBootstrap.requestHash)
        val verified = backendApi.verifyIntegrity(
            IntegrityVerifyRequest(
                installId = installId,
                integrityToken = integrityToken,
                challengeToken = integrityBootstrap.challengeToken
            )
        )

        bridge.injectInstallToken(verified.token, verified.expiresAt)
    }
}
