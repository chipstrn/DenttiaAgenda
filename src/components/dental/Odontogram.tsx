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
  const isMolar = toothType >= 6;
  const isPremolar = toothType >= 4 && toothType <= 5;
  const isCanine = toothType === 3;
  const isIncisor = toothType <= 2;

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
          "text-xs font-medium mb-1",
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
          width={isMolar ? 36 : isPremolar ? 30 : 24} 
          height={40} 
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
          "text-xs font-medium mt-1",
          isSelected ? "text-ios-blue" : "text-ios-gray-500"
        )}>
          {number}
        </span>
      )}
    </div>
  );
};

const Odontogram = ({ teeth, onToothClick, selectedTooth, readOnly = false }: OdontogramProps) => {
  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-ios-gray-50 rounded-2xl">
        {Object.entries(CONDITION_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn(
              "w-4 h-4 rounded border-2",
              CONDITION_COLORS[key]?.replace('fill-', 'bg-').replace('stroke-', 'border-') || 'bg-white border-gray-400'
            )} />
            <span className="text-xs text-ios-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Upper Teeth */}
      <div className="mb-2">
        <div className="text-xs text-ios-gray-500 text-center mb-2 font-medium">SUPERIOR</div>
        <div className="flex justify-center gap-1">
          {/* Upper Right */}
          <div className="flex gap-1 pr-4 border-r-2 border-ios-gray-300">
            {UPPER_RIGHT.map(num => (
              <Tooth
                key={num}
                number={num}
                data={teeth[num]}
                onClick={() => !readOnly && onToothClick(num)}
                isSelected={selectedTooth === num}
                isUpper={true}
              />
            ))}
          </div>
          {/* Upper Left */}
          <div className="flex gap-1 pl-4">
            {UPPER_LEFT.map(num => (
              <Tooth
                key={num}
                number={num}
                data={teeth[num]}
                onClick={() => !readOnly && onToothClick(num)}
                isSelected={selectedTooth === num}
                isUpper={true}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-ios-gray-200 my-4" />

      {/* Lower Teeth */}
      <div>
        <div className="flex justify-center gap-1">
          {/* Lower Right */}
          <div className="flex gap-1 pr-4 border-r-2 border-ios-gray-300">
            {LOWER_RIGHT.map(num => (
              <Tooth
                key={num}
                number={num}
                data={teeth[num]}
                onClick={() => !readOnly && onToothClick(num)}
                isSelected={selectedTooth === num}
                isUpper={false}
              />
            ))}
          </div>
          {/* Lower Left */}
          <div className="flex gap-1 pl-4">
            {LOWER_LEFT.map(num => (
              <Tooth
                key={num}
                number={num}
                data={teeth[num]}
                onClick={() => !readOnly && onToothClick(num)}
                isSelected={selectedTooth === num}
                isUpper={false}
              />
            ))}
          </div>
        </div>
        <div className="text-xs text-ios-gray-500 text-center mt-2 font-medium">INFERIOR</div>
      </div>
    </div>
  );
};

export default Odontogram;
export { CONDITION_COLORS, CONDITION_LABELS };