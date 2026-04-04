package com.mecanico.app.model

data class InstallBootstrapRequest(
    val installId: String,
    val platform: String,
    val appVersion: String
)

data class InstallBootstrapResponse(
    val installId: String,
    val token: String?,
    val expiresAt: String?,
    val integrityRequired: Boolean,
    val integrity: IntegrityBootstrap?
) {
    data class IntegrityBootstrap(
        val challengeToken: String,
        val requestHash: String,
        val issuedAt: String,
        val expiresAt: String
    )
}

data class IntegrityVerifyRequest(
    val installId: String,
    val integrityToken: String,
    val challengeToken: String
)

data class IntegrityVerifyResponse(
    val token: String,
    val expiresAt: String,
    val entitlement: String
)
