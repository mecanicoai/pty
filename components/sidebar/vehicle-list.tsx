import type { VehicleContext } from "@/types/chat";

interface Props {
  vehicle: VehicleContext | null;
}

export function VehicleList({ vehicle }: Props) {
  return (
    <div className="rounded-xl border border-[var(--wa-divider)] bg-[var(--wa-bubble-in)] p-3 shadow-[var(--wa-shadow-sm)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--wa-text-secondary)]">Vehiculo activo</p>
      {vehicle ? (
        <div className="mt-2 space-y-1 text-sm text-[var(--wa-text-primary)]">
          <p className="font-medium">
            {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Sin datos completos"}
          </p>
          <p className="text-xs text-[var(--wa-text-secondary)]">Motor: {vehicle.engine || "N/D"}</p>
          <p className="text-xs text-[var(--wa-text-secondary)]">Traccion: {vehicle.drivetrain || "N/D"}</p>
          <p className="text-xs text-[var(--wa-text-secondary)]">Kilometraje: {vehicle.mileage ?? "N/D"}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-[var(--wa-text-secondary)]">Sube datos del vehiculo para afinar el diagnostico.</p>
      )}
    </div>
  );
}
