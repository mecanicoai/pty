"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { VehicleContext } from "@/types/chat";

interface Props {
  open: boolean;
  initialVehicle: VehicleContext | null;
  onClose: () => void;
  onSave: (vehicle: VehicleContext) => Promise<void>;
}

export function VehicleIntakeDrawer({ open, initialVehicle, onClose, onSave }: Props) {
  const [form, setForm] = useState<VehicleContext>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initialVehicle ?? {});
  }, [initialVehicle, open]);

  async function handleSubmit() {
    setSaving(true);
    try {
      const normalized: VehicleContext = {
        year: form.year ? Number(form.year) : null,
        make: form.make?.trim() || null,
        model: form.model?.trim() || null,
        engine: form.engine?.trim() || null,
        drivetrain: form.drivetrain?.trim() || null,
        mileage: form.mileage ? Number(form.mileage) : null,
        dtcCodes: (form.dtcCodes ?? []).filter(Boolean),
        symptomNotes: form.symptomNotes?.trim() || null
      };
      await onSave(normalized);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Datos del vehiculo">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          placeholder="Ano"
          value={form.year ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, year: Number(event.target.value) || null }))}
        />
        <Input
          placeholder="Marca"
          value={form.make ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, make: event.target.value }))}
        />
        <Input
          placeholder="Modelo"
          value={form.model ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
        />
        <Input
          placeholder="Motor"
          value={form.engine ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, engine: event.target.value }))}
        />
        <Input
          placeholder="Traccion"
          value={form.drivetrain ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, drivetrain: event.target.value }))}
        />
        <Input
          placeholder="Kilometraje"
          value={form.mileage ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, mileage: Number(event.target.value) || null }))}
        />
        <Input
          className="sm:col-span-2"
          placeholder="Codigos DTC (separados por coma)"
          value={(form.dtcCodes ?? []).join(", ")}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              dtcCodes: event.target.value
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter(Boolean)
            }))
          }
        />
        <Textarea
          className="sm:col-span-2"
          rows={4}
          placeholder="Notas de sintomas"
          value={form.symptomNotes ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, symptomNotes: event.target.value }))}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
          {saving ? "Guardando..." : "Guardar vehiculo"}
        </Button>
      </div>
    </Modal>
  );
}
