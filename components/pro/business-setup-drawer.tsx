"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { BusinessProfile } from "@/types/product";

interface Props {
  open: boolean;
  initialProfile: BusinessProfile | null;
  onClose: () => void;
  onSave: (profile: BusinessProfile) => Promise<void> | void;
}

const BUSINESS_TYPES = ["Taller general", "Mecanica movil", "Especialista", "Flotillas", "Moto / powersports"];
const CURRENCIES = ["USD", "MXN", "COP", "ARS", "PEN", "CLP"];

export function BusinessSetupDrawer({ open, initialProfile, onClose, onSave }: Props) {
  const [form, setForm] = useState<BusinessProfile>({
    business_name: "",
    mechanic_name: "",
    whatsapp_number: "",
    business_type: BUSINESS_TYPES[0],
    currency: "USD",
    payment_link: "",
    email: "",
    business_address: "",
    logo: "",
    default_diagnostic_fee: null,
    labor_rate: null,
    default_disclaimer: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfile) {
      setForm(initialProfile);
      return;
    }

    setForm({
      business_name: "",
      mechanic_name: "",
      whatsapp_number: "",
      business_type: BUSINESS_TYPES[0],
      currency: "USD",
      payment_link: "",
      email: "",
      business_address: "",
      logo: "",
      default_diagnostic_fee: null,
      labor_rate: null,
      default_disclaimer: ""
    });
  }, [initialProfile, open]);

  async function handleSave() {
    if (
      !form.business_name.trim() ||
      !form.mechanic_name.trim() ||
      !form.whatsapp_number.trim() ||
      !form.payment_link.trim() ||
      typeof form.labor_rate !== "number" ||
      form.labor_rate <= 0
    ) {
      setError("Completa los campos obligatorios, incluida la mano de obra por hora, para activar el modo Pro.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        ...form,
        business_name: form.business_name.trim(),
        mechanic_name: form.mechanic_name.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
        business_type: form.business_type.trim(),
        currency: form.currency.trim(),
        payment_link: form.payment_link.trim(),
        email: form.email?.trim() || "",
        business_address: form.business_address?.trim() || "",
        logo: form.logo?.trim() || "",
        default_disclaimer: form.default_disclaimer?.trim() || "",
        default_diagnostic_fee: form.default_diagnostic_fee ? Number(form.default_diagnostic_fee) : null,
        labor_rate: form.labor_rate ? Number(form.labor_rate) : null
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Configuracion del negocio">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          placeholder="Nombre del negocio *"
          value={form.business_name}
          onChange={(event) => setForm((prev) => ({ ...prev, business_name: event.target.value }))}
        />
        <Input
          placeholder="Nombre del mecanico *"
          value={form.mechanic_name}
          onChange={(event) => setForm((prev) => ({ ...prev, mechanic_name: event.target.value }))}
        />
        <Input
          placeholder="WhatsApp *"
          value={form.whatsapp_number}
          onChange={(event) => setForm((prev) => ({ ...prev, whatsapp_number: event.target.value }))}
        />
        <Select
          value={form.business_type}
          onChange={(event) => setForm((prev) => ({ ...prev, business_type: event.target.value }))}
        >
          {BUSINESS_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select
          value={form.currency}
          onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
        >
          {CURRENCIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Link de pago *"
          value={form.payment_link}
          onChange={(event) => setForm((prev) => ({ ...prev, payment_link: event.target.value }))}
        />
        <Input
          placeholder="Email"
          value={form.email || ""}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
        />
        <Input
          placeholder="Direccion del negocio"
          value={form.business_address || ""}
          onChange={(event) => setForm((prev) => ({ ...prev, business_address: event.target.value }))}
        />
        <Input
          placeholder="Logo URL"
          value={form.logo || ""}
          onChange={(event) => setForm((prev) => ({ ...prev, logo: event.target.value }))}
        />
        <Input
          placeholder="Tarifa diagnostico"
          value={form.default_diagnostic_fee ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, default_diagnostic_fee: Number(event.target.value) || null }))}
        />
        <div className="space-y-2">
          <Input
            placeholder="Mano de obra por hora *"
            value={form.labor_rate ?? ""}
            onChange={(event) => setForm((prev) => ({ ...prev, labor_rate: Number(event.target.value) || null }))}
          />
          <p className="text-xs leading-5 text-[var(--wa-text-secondary)]">
            Esta tarifa se usa para armar cotizaciones preliminares y dar un total mas realista desde el primer mensaje.
          </p>
        </div>
        <Textarea
          className="sm:col-span-2"
          rows={4}
          placeholder="Disclaimer por defecto"
          value={form.default_disclaimer || ""}
          onChange={(event) => setForm((prev) => ({ ...prev, default_disclaimer: event.target.value }))}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Guardando..." : "Guardar negocio"}
        </Button>
      </div>
    </Modal>
  );
}
