package com.mecanico.app.integration

import android.content.Context
import java.util.UUID

class InstallIdentityStore(context: Context) {
    private val prefs = context.getSharedPreferences("mecanico_install", Context.MODE_PRIVATE)

    fun getOrCreateInstallId(): String {
        val existing = prefs.getString("install_id", null)
        if (!existing.isNullOrBlank()) {
            return existing
        }

        val next = "install-${UUID.randomUUID()}"
        prefs.edit().putString("install_id", next).apply()
        return next
    }
}
