import React, { useState, useMemo } from "react";
import * as d3 from "d3";

export const CARBON_CATEGORICAL_PALETTE = [
  "#6929c4", "#1192e8", "#005d5d", "#9f1853", "#fa4d56",
  "#570408", "#198038", "#002d9c", "#ee538b", "#b28600",
  "#009d9a", "#012749", "#8a3800", "#a56eff"
];

export const COMPLIANCE_COLOR_MAP: Record<string, string> = {
  "Quantum Safe": "#24a148",
  "Quantum Vulnerable": "#da1e28",
  "Quantum-Weakened": "#d97706",
  "Unknown": "#17a9d1",
  // Legacy mappings for backward compatibility if any
  "Not Quantum Safe": "#da1e28",
  "Not Applicable": "#d97706"
};

export interface CbomkitChartItem {
  group: string;
  value: number;
  color?: string;
}

interface Props {
  centerNumber: number | string;
  centerLabel: string;
  data: CbomkitChartItem[];
  colorPalette?: string[];
  height?: number;
  emptyText?: string;
}

export default function CbomkitDonutChart({
  centerNumber,
  centerLabel,
  data,
  colorPalette = CARBON_CATEGORICAL_PALETTE,
  height = 320,
  emptyText = "No data available",
}: Props) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    group: string;
    value: number;
    percent: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    group: "",
    value: 0,
    percent: "",
  });

  const validData = useMemo(() => {
    return data.filter((d) => typeof d.value === "number" && d.value > 0);
  }, [data]);

  const total = useMemo(() => {
    return validData.reduce((acc, curr) => acc + curr.value, 0);
  }, [validData]);

  // D3 Pie Generator
  const pieData = useMemo(() => {
    if (total === 0) return [];
    const pie = d3
      .pie<CbomkitChartItem>()
      .value((d) => d.value)
      .sort(null);
    return pie(validData);
  }, [validData, total]);

  const width = 280;
  const chartHeight = 220;
  const radius = Math.min(width, chartHeight) / 2 - 12;
  const innerRadius = radius * 0.70; // 70% inner radius matching Carbon Donut standard

  // D3 Arc Generator
  const arcGenerator = useMemo(() => {
    return d3
      .arc<d3.PieArcDatum<CbomkitChartItem>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .padAngle(0.015);
  }, [innerRadius, radius]);

  const handleMouseMove = (
    e: React.MouseEvent<SVGPathElement>,
    group: string,
    value: number
  ) => {
    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      const percent = total > 0 ? ((value / total) * 100).toFixed(1) + "%" : "0%";
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        group,
        value,
        percent,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredGroup(null);
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  const getColor = (item: CbomkitChartItem, index: number) => {
    if (item.color) return item.color;
    if (COMPLIANCE_COLOR_MAP[item.group]) return COMPLIANCE_COLOR_MAP[item.group];
    return colorPalette[index % colorPalette.length];
  };

  return (
    <div
      className="flex flex-col items-center justify-between w-full relative select-none font-sans"
      style={{ minHeight: `${height}px` }}
    >
      {/* SVG Donut Chart */}
      <div className="relative w-full flex items-center justify-center">
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          className="w-full max-w-[280px] h-[220px] overflow-visible"
        >
          <g transform={`translate(${width / 2}, ${chartHeight / 2})`}>
            {total === 0 ? (
              // Empty State Ring
              <circle
                r={(radius + innerRadius) / 2}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={radius - innerRadius}
              />
            ) : (
              // Arcs
              pieData.map((d, i) => {
                const color = getColor(d.data, i);
                const isHovered = hoveredGroup === d.data.group;
                const isDimmed = hoveredGroup !== null && !isHovered;
                const path = arcGenerator(d) || "";

                return (
                  <path
                    key={d.data.group}
                    d={path}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="transition-all duration-150 cursor-pointer"
                    style={{
                      opacity: isDimmed ? 0.3 : 1,
                      transform: isHovered ? "scale(1.03)" : "scale(1)",
                      transformOrigin: "0 0",
                    }}
                    onMouseEnter={() => setHoveredGroup(d.data.group)}
                    onMouseMove={(e) => handleMouseMove(e, d.data.group, d.data.value)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })
            )}

            {/* Center Label & Number (Carbon Charts exact placement) */}
            <text
              x={0}
              y={-4}
              textAnchor="middle"
              className="font-bold fill-[#161616]"
              style={{ fontSize: "26px", fontWeight: 700 }}
            >
              {centerNumber}
            </text>
            <text
              x={0}
              y={18}
              textAnchor="middle"
              className="fill-[#525252] font-medium"
              style={{ fontSize: "11px" }}
            >
              {centerLabel}
            </text>
          </g>
        </svg>

        {/* Carbon Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute pointer-events-none bg-[#161616] text-white text-xs rounded px-2.5 py-1.5 shadow-xl border border-gray-700 z-30 transition-opacity duration-100"
            style={{
              left: `${tooltip.x + 12}px`,
              top: `${tooltip.y - 28}px`,
            }}
          >
            <div className="font-semibold text-gray-200">{tooltip.group}</div>
            <div className="text-gray-300 text-[11px] mt-0.5">
              <span>{tooltip.value}</span>
              <span className="text-gray-400 ml-1.5">({tooltip.percent})</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="w-full mt-3 px-2">
        {total === 0 ? (
          <div className="text-center text-xs text-gray-400 py-2">{emptyText}</div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
            {validData.map((item, idx) => {
              const color = getColor(item, idx);
              const isHovered = hoveredGroup === item.group;
              const isDimmed = hoveredGroup !== null && !isHovered;
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";

              return (
                <div
                  key={item.group}
                  className={`flex items-center gap-1.5 text-xs cursor-pointer transition-opacity duration-150 py-0.5 ${
                    isDimmed ? "opacity-35" : "opacity-100"
                  }`}
                  onMouseEnter={() => setHoveredGroup(item.group)}
                  onMouseLeave={() => setHoveredGroup(null)}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-[1px] shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className={`text-[#525252] ${
                      isHovered ? "font-bold text-[#161616]" : "font-normal"
                    }`}
                  >
                    {item.group}
                  </span>
                  <span className="text-[#6f6f6f] text-[11px] font-normal">
                    {item.value} ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
