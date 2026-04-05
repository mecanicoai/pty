package com.mecanico.app.integration

import android.content.Context
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import com.mecanico.app.BuildConfig
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
        val projectNumber = BuildConfig.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER
        require(projectNumber > 0L) {
            "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER no esta configurado."
        }
        return projectNumber
    }
}
