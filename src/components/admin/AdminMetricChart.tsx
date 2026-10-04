import { curveMonotoneX } from "@visx/curve";
import { Area, AreaChart } from "@/charts";
import type { AdminChartPoint } from "@/lib/adminMetrics";

const CURRENT = "#08090a";
const PRIOR = "#8a8f98";

export default function AdminMetricChart({
  points,
  compare,
  status,
  tall = false,
}: {
  points: AdminChartPoint[];
  compare: boolean;
  status: "loading" | "ready";
  tall?: boolean;
}) {
  const empty = status === "ready" && points.length === 0;
  return (
    <div
      className={`overflow-hidden rounded-xl bg-[#f7f8f8] ${
        tall ? "h-36" : "h-24"
      }`}
    >
      {empty ? (
        <div className="flex h-full items-center justify-center px-3">
          <p className="text-[12px] font-medium text-[#8a8f98]">No series yet</p>
        </div>
      ) : (
        <AreaChart
          data={points}
          status={status}
          loadingLabel="Loading"
          aspectRatio="unset"
          style={{ height: "100%" }}
          margin={{ top: 10, right: 8, bottom: 8, left: 8 }}
          animationDuration={status === "ready" ? 700 : 0}
        >
          <Area
            curve={curveMonotoneX}
            dataKey="value"
            fill={CURRENT}
            fillOpacity={0.16}
            stroke={CURRENT}
            strokeWidth={1.5}
            showHighlight={false}
          />
          {compare ? (
            <Area
              curve={curveMonotoneX}
              dataKey="prior"
              fill={PRIOR}
              fillOpacity={0.08}
              stroke={PRIOR}
              strokeWidth={1.25}
              showHighlight={false}
            />
          ) : null}
        </AreaChart>
      )}
    </div>
  );
}
