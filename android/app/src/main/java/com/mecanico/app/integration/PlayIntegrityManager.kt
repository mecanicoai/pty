package com.mecanico.app.integration

import android.content.Context
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import kotlinx.coroutines.tasks.await

class PlayIntegrityManager(
    context: Context
) {
    private val integrityManager = IntegrityManagerFactory.createStandard(context)

    suspend fun requestIntegrityToken(requestHash: String): String {
        val prepareRequest = StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
            .setCloudProjectNumber(cloudProjectNumber())
            .build()

        val tokenProvider = integrityManager.prepareIntegrityToken(prepareRequest).await()
        val tokenRequest = StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
            .setRequestHash(requestHash)
            .build()

        val tokenResponse = tokenProvider.request(tokenRequest).await()
        return tokenResponse.token()
    }

    private fun cloudProjectNumber(): Long {
        // TODO: Replace this hardcoded placeholder with a real Play Integrity project number source.
        // Recommended options:
        // - BuildConfig field
        // - encrypted remote config
        // - resource overlay per environment
        return 1234567890123L
    }
}
