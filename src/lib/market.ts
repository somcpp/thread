import "server-only";
import { ALLOCATION } from "./engine";

/** Quick capacity numbers for product cards (full quote happens on the product page). */
export function weeklyCapacity(p: { unitsPerMachinePerWeek: number }, machines: number) {
  return Math.floor(machines * ALLOCATION * p.unitsPerMachinePerWeek);
}
