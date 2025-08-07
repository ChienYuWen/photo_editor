
import React from 'react';

interface SelectorPanelProps<T> {
  title: string;
  options: T[];
  selectedOption: T;
  onSelect: (option: T) => void;
  renderOption: (option: T, isSelected: boolean) => React.ReactNode;
}

const SelectorPanel = <T extends { name: string },>(
  { title, options, selectedOption, onSelect, renderOption }: SelectorPanelProps<T>
) => {
  return (
    <div className="w-full mb-4">
      <h3 className="text-sm font-bold text-gray-400 px-4 mb-2">{title}</h3>
      <div className="flex space-x-3 overflow-x-auto p-4 pt-0 scrollbar-thin">
        {options.map((option) => (
          <div key={option.name} onClick={() => onSelect(option)} className="cursor-pointer">
            {renderOption(option, option.name === selectedOption.name)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SelectorPanel;
