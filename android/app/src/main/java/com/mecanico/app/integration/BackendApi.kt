package com.mecanico.app.integration

import com.mecanico.app.model.IntegrityVerifyRequest
import com.mecanico.app.model.IntegrityVerifyResponse
import com.mecanico.app.model.InstallBootstrapRequest
import com.mecanico.app.model.InstallBootstrapResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class BackendApi(
    private val baseUrl: String,
    private val client: OkHttpClient = OkHttpClient()
) {
    suspend fun bootstrapInstall(request: InstallBootstrapRequest): InstallBootstrapResponse {
        return withContext(Dispatchers.IO) {
            val payload = JSONObject()
                .put("installId", request.installId)
                .put("platform", request.platform)
                .put("appVersion", request.appVersion)

            val body = payload.toString().toRequestBody("application/json".toMediaType())
            val httpRequest = Request.Builder()
                .url("$baseUrl/api/install")
                .post(body)
                .build()

            client.newCall(httpRequest).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("No se pudo iniciar la sesion del dispositivo.")
                }

                val json = JSONObject(raw)
                val integrity = if (json.has("integrity")) {
                    val item = json.getJSONObject("integrity")
                    InstallBootstrapResponse.IntegrityBootstrap(
                        challengeToken = item.getString("challengeToken"),
                        requestHash = item.getString("requestHash"),
                        issuedAt = item.getString("issuedAt"),
                        expiresAt = item.getString("expiresAt")
                    )
                } else {
                    null
                }

                InstallBootstrapResponse(
                    installId = json.getString("installId"),
                    token = json.optString("token").takeIf { it.isNotBlank() },
                    expiresAt = json.optString("expiresAt").takeIf { it.isNotBlank() },
                    integrityRequired = json.optBoolean("integrityRequired", false),
                    integrity = integrity
                )
            }
        }
    }

    suspend fun verifyIntegrity(request: IntegrityVerifyRequest): IntegrityVerifyResponse {
        return withContext(Dispatchers.IO) {
            val payload = JSONObject()
                .put("installId", request.installId)
                .put("integrityToken", request.integrityToken)
                .put("challengeToken", request.challengeToken)

            val body = payload.toString().toRequestBody("application/json".toMediaType())
            val httpRequest = Request.Builder()
                .url("$baseUrl/api/integrity/verify")
                .post(body)
                .build()

            client.newCall(httpRequest).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("No se pudo verificar la licencia de Google Play.")
                }

                val json = JSONObject(raw)
                IntegrityVerifyResponse(
                    token = json.getString("token"),
                    expiresAt = json.getString("expiresAt"),
                    entitlement = json.getString("entitlement")
                )
            }
        }
    }
}
