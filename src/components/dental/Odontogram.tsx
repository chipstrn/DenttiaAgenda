"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface ToothData {
  tooth_number: number;
  condition: string;
  surfaces: {
    mesial?: string;
    distal?: string;
    oclusal?: string;
    vestibular?: string;
    lingual?: string;
  };
  notes?: string;
  treatment_needed?: string;
}

interface OdontogramProps {
  teeth: Record<number, ToothData>;
  onToothClick: (toothNumber: number) => void;
  selectedTooth: number | null;
  readOnly?: boolean;
}

const CONDITION_COLORS: Record<string, string> = {
  healthy: 'fill-white stroke-ios-gray-400',
  caries: 'fill-ios-red stroke-ios-red',
  extraction: 'fill-ios-gray-300 stroke-ios-gray-500',
  crown: 'fill-ios-purple stroke-ios-purple',
  filling: 'fill-ios-blue stroke-ios-blue',
  root_canal: 'fill-ios-orange stroke-ios-orange',
  implant: 'fill-ios-teal stroke-ios-teal',
  bridge: 'fill-ios-indigo stroke-ios-indigo',
  missing: 'fill-ios-gray-100 stroke-ios-gray-300 stroke-dashed',
};

const CONDITION_LABELS: Record<string, string> = {
  healthy: 'Sano',
  caries: 'Caries',
  extraction: 'Extracción',
  crown: 'Corona',
  filling: 'Obturación',
  root_canal: 'Endodoncia',
  implant: 'Implante',
  bridge: 'Puente',
  missing: 'Ausente',
};

// FDI Notation: Upper Right (11-18), Upper Left (21-28), Lower Left (31-38), Lower Right (41-48)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

const UPPER_RIGHT_DECIDUOUS = [55, 54, 53, 52, 51];
const UPPER_LEFT_DECIDUOUS = [61, 62, 63, 64, 65];
const LOWER_LEFT_DECIDUOUS = [71, 72, 73, 74, 75];
const LOWER_RIGHT_DECIDUOUS = [85, 84, 83, 82, 81];

const Tooth = ({
  number,
  data,
  onClick,
  isSelected,
  isUpper
}: {
  number: number;
  data?: ToothData;
  onClick: () => void;
  isSelected: boolean;
  isUpper: boolean;
}) => {
  const condition = data?.condition || 'healthy';
  const colorClass = CONDITION_COLORS[condition] || CONDITION_COLORS.healthy;

  // Determine tooth type for shape
  const toothType = number % 10;
  const isMolar = toothType >= 6 || (number > 50 && (toothType === 4 || toothType === 5));
  const isPremolar = (toothType >= 4 && toothType <= 5) && number <= 50; // Deciduous molars look like molars
  // const isCanine = toothType === 3;
  // const isIncisor = toothType <= 2;

  return (
    <div
      className={cn(
        "flex flex-col items-center cursor-pointer transition-all duration-200 touch-feedback",
        isSelected && "scale-110"
      )}
      onClick={onClick}
    >
      {/* Tooth Number */}
      {isUpper && (
        <span className={cn(
          "text-[10px] font-medium mb-1",
          isSelected ? "text-ios-blue" : "text-ios-gray-500"
        )}>
          {number}
        </span>
      )}

      {/* Tooth Shape */}
      <div className={cn(
        "relative transition-all duration-200",
        isSelected && "ring-2 ring-ios-blue ring-offset-2 rounded-lg"
      )}>
        <svg
          width={isMolar ? 32 : isPremolar ? 28 : 22}
          height={36}
          viewBox="0 0 40 50"
          className="drop-shadow-sm"
        >
          {/* Root */}
          <path
            d={isUpper
              ? (isMolar
                ? "M10 35 L8 48 M20 35 L20 50 M30 35 L32 48"
                : isPremolar
                  ? "M15 35 L12 48 M25 35 L28 48"
                  : "M20 35 L20 50")
              : (isMolar
                ? "M10 15 L8 2 M20 15 L20 0 M30 15 L32 2"
                : isPremolar
                  ? "M15 15 L12 2 M25 15 L28 2"
                  : "M20 15 L20 0")
            }
            className="stroke-ios-gray-400"
            strokeWidth="2"
            fill="none"
          />

          {/* Crown */}
          <rect
            x="5"
            y={isUpper ? "10" : "15"}
            width="30"
            height="25"
            rx="4"
            className={cn(colorClass, "stroke-2")}
          />

          {/* Surface indicators if has specific surface conditions */}
          {data?.surfaces && Object.keys(data.surfaces).length > 0 && (
            <>
              {data.surfaces.oclusal && (
                <circle cx="20" cy={isUpper ? "22" : "27"} r="6" className="fill-ios-red/50" />
              )}
              {data.surfaces.mesial && (
                <rect x="5" y={isUpper ? "15" : "20"} width="5" height="15" className="fill-ios-red/50" />
              )}
              {data.surfaces.distal && (
                <rect x="30" y={isUpper ? "15" : "20"} width="5" height="15" className="fill-ios-red/50" />
              )}
            </>
          )}

          {/* X mark for extraction/missing */}
          {(condition === 'extraction' || condition === 'missing') && (
            <>
              <line x1="10" y1={isUpper ? "15" : "20"} x2="30" y2={isUpper ? "30" : "35"} className="stroke-ios-red" strokeWidth="2" />
              <line x1="30" y1={isUpper ? "15" : "20"} x2="10" y2={isUpper ? "30" : "35"} className="stroke-ios-red" strokeWidth="2" />
            </>
          )}
        </svg>
      </div>

      {/* Tooth Number (bottom for lower teeth) */}
      {!isUpper && (
        <span className={cn(
          "text-[10px] font-medium mt-1",
          isSelected ? "text-ios-blue" : "text-ios-gray-500"
        )}>
          {number}
        </span>
      )}
    </div>
  );
};

const Odontogram = ({ teeth, onToothClick, selectedTooth, readOnly = false }: OdontogramProps) => {
  const [showMixedDentition, setShowMixedDentition] = useState(false);

  const renderToothRow = (toothArray: number[], isUpper: boolean) => (
    <div className={cn("flex gap-1", isUpper ? "items-end" : "items-start")}>
      {toothArray.map(num => (
        <Tooth
          key={num}
          number={num}
          data={teeth[num]}
          onClick={() => !readOnly && onToothClick(num)}
          isSelected={selectedTooth === num}
          isUpper={isUpper}
        />
      ))}
    </div>
  );

  return (
    <div className="w-full">
      {/* Legend & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-ios-gray-50 rounded-2xl">
        <div className="flex flex-wrap gap-3">
          {Object.entries(CONDITION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={cn(
                "w-3 h-3 rounded-full border",
                CONDITION_COLORS[key]?.replace('fill-', 'bg-').replace('stroke-', 'border-') || 'bg-white border-gray-400'
              )} />
              <span className="text-[10px] text-ios-gray-600 uppercase tracking-wide">{label}</span>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showMixedDentition}
            onChange={(e) => setShowMixedDentition(e.target.checked)}
            className="rounded border-gray-300 text-ios-blue focus:ring-ios-blue"
          />
          <span className="text-xs font-medium text-ios-gray-700">Dentición Mixta (Infantil)</span>
        </label>
      </div>

      <div className="relative overflow-x-auto pb-4">
        <div className="min-w-[600px] flex flex-col items-center">

          {/* Upper Arch */}
          <div className="mb-4">
            <div className="text-[10px] text-ios-gray-400 text-center mb-1 font-bold tracking-widest">PERMANENTE SUPERIOR</div>
            <div className="flex justify-center gap-8">
              <div className="flex gap-1 pr-2 border-r border-ios-gray-200">
                {renderToothRow(UPPER_RIGHT, true)}
              </div>
              <div className="flex gap-1 pl-2">
                {renderToothRow(UPPER_LEFT, true)}
              </div>
            </div>
          </div>

          {/* Deciduous Upper */}
          {showMixedDentition && (
            <div className="mb-4 animate-fade-in">
              <div className="text-[10px] text-ios-blue/70 text-center mb-1 font-bold tracking-widest">TEMPORAL SUPERIOR</div>
              <div className="flex justify-center gap-8">
                <div className="flex gap-1 pr-2 border-r border-blue-100">
                  {renderToothRow(UPPER_RIGHT_DECIDUOUS, true)}
                </div>
                <div className="flex gap-1 pl-2">
                  {renderToothRow(UPPER_LEFT_DECIDUOUS, true)}
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-ios-gray-200 to-transparent my-2" />

          {/* Deciduous Lower */}
          {showMixedDentition && (
            <div className="mt-2 mb-4 animate-fade-in">
              <div className="flex justify-center gap-8">
                <div className="flex gap-1 pr-2 border-r border-blue-100">
                  {renderToothRow(LOWER_RIGHT_DECIDUOUS, false)}
                </div>
                <div className="flex gap-1 pl-2">
                  {renderToothRow(LOWER_LEFT_DECIDUOUS, false)}
                </div>
              </div>
              <div className="text-[10px] text-ios-blue/70 text-center mt-1 font-bold tracking-widest">TEMPORAL INFERIOR</div>
            </div>
          )}

          {/* Lower Arch */}
          <div className="mt-2">
            <div className="flex justify-center gap-8">
              <div className="flex gap-1 pr-2 border-r border-ios-gray-200">
                {renderToothRow(LOWER_RIGHT, false)}
              </div>
              <div className="flex gap-1 pl-2">
                {renderToothRow(LOWER_LEFT, false)}
              </div>
            </div>
            <div className="text-[10px] text-ios-gray-400 text-center mt-1 font-bold tracking-widest">PERMANENTE INFERIOR</div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Odontogram;
export { CONDITION_COLORS, CONDITION_LABELS };