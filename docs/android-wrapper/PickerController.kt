package com.example.mecanico

import android.content.ContentResolver
import android.net.Uri
import android.util.Base64
import androidx.activity.ComponentActivity
import org.json.JSONArray
import org.json.JSONObject

class PickerController(
    private val activity: ComponentActivity,
    private val onAttachmentsReady: (String) -> Unit,
    private val onError: (String) -> Unit
) {
    fun open(accept: String, multiple: Boolean, maxFiles: Int) {
        onError(
            "Implementa el selector real con ActivityResultContracts y devuelve hasta $maxFiles archivos para: $accept"
        )
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

            val dataBase64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            val item = JSONObject()
                .put("name", name)
                .put("mimeType", mimeType)
                .put("kind", if (mimeType.startsWith("image/")) "image" else "file")
                .put("dataBase64", dataBase64)

            payload.put(item)
        }

        return payload.toString()
    }
}
