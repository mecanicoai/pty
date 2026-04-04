package com.mecanico.app.media

import android.content.ContentResolver
import android.net.Uri
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class PickerController(
    private val activity: ComponentActivity,
    private val onAttachmentsJsonReady: (String) -> Unit,
    private val onError: (String) -> Unit
) {
    private var maxFilesRequested = 4
    private var pendingCameraUri: Uri? = null

    private val pickDocumentsLauncher =
        activity.registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            handleUris(uris.orEmpty())
        }

    private val captureImageLauncher =
        activity.registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            val uri = pendingCameraUri
            pendingCameraUri = null
            if (success && uri != null) {
                handleUris(listOf(uri))
            } else if (!success) {
                onError("No se pudo tomar la foto.")
            }
        }

    fun open(accept: String, multiple: Boolean, maxFiles: Int) {
        maxFilesRequested = maxFiles.coerceIn(1, 4)
        val wantsOnlyImage = accept.split(",").all { it.trim().startsWith("image/") }

        if (!multiple && wantsOnlyImage) {
            launchCameraCapture()
            return
        }

        val mimeTypes = parseMimeTypes(accept)
        pickDocumentsLauncher.launch(mimeTypes)
    }

    fun buildAttachmentsJson(contentResolver: ContentResolver, uris: List<Uri>): String {
        val payload = JSONArray()

        for (uri in uris) {
            val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
            val name = uri.lastPathSegment ?: "archivo"
            val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: throw IllegalStateException("No se pudo leer el archivo.")

            if (bytes.size > 8 * 1024 * 1024) {
                throw IllegalStateException("El archivo $name supera 8MB.")
            }

            val item = JSONObject()
                .put("name", name)
                .put("mimeType", mimeType)
                .put("kind", if (mimeType.startsWith("image/")) "image" else "file")
                .put("dataBase64", Base64.encodeToString(bytes, Base64.NO_WRAP))

            payload.put(item)
        }

        return payload.toString()
    }

    private fun handleUris(uris: List<Uri>) {
        if (uris.isEmpty()) {
            return
        }

        try {
            val limited = uris.take(maxFilesRequested)
            val attachmentsJson = buildAttachmentsJson(activity.contentResolver, limited)
            onAttachmentsJsonReady(attachmentsJson)
        } catch (error: Exception) {
            onError(error.message ?: "No se pudieron adjuntar los archivos.")
        }
    }

    private fun parseMimeTypes(accept: String): Array<String> {
        val types = accept
            .split(",")
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .map { token ->
                when {
                    token.startsWith(".pdf") -> "application/pdf"
                    token.startsWith(".doc") -> "application/msword"
                    token.startsWith(".docx") -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    token.startsWith(".txt") -> "text/plain"
                    token.startsWith(".csv") -> "text/csv"
                    token.startsWith(".xlsx") -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    token.startsWith(".xls") -> "application/vnd.ms-excel"
                    else -> token
                }
            }
            .distinct()

        return if (types.isEmpty()) arrayOf("*/*") else types.toTypedArray()
    }

    private fun launchCameraCapture() {
        try {
            val photoFile = File.createTempFile("mecanico_capture_", ".jpg", activity.cacheDir)
            val authority = "${activity.packageName}.fileprovider"
            val photoUri = FileProvider.getUriForFile(activity, authority, photoFile)
            pendingCameraUri = photoUri
            captureImageLauncher.launch(photoUri)
        } catch (error: Exception) {
            onError("No se pudo abrir la camara.")
        }
    }
}
