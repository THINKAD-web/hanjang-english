import { WeekCalendar } from "@/components/design-system";
import type { StampCell } from "@/lib/engine/progress";

/** 이번 주 도장 7칸 (월~일) */
export function StampRow({ cells, emphasized }: { cells: StampCell[]; emphasized?: boolean }) {
  return <WeekCalendar cells={cells} emphasized={emphasized} />;
}
