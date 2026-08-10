import React, { useState, useEffect } from 'react';
import { PlayerEntry } from '../types';
import { X, Check, User, ToggleLeft, ToggleRight } from 'lucide-react';

interface EditPlayerModalProps {
  player: PlayerEntry | null;
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (index: number, updatedName: string, isBye: boolean) => void;
}

export const EditPlayerModal: React.FC<EditPlayerModalProps> = ({
  player,
  index,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [isBye, setIsBye] = useState(false);

  useEffect(() => {
    if (player) {
      setName(player.name);
      setIsBye(player.isBye);
    }
  }, [player]);

  if (!isOpen || !player) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(index, isBye ? 'Bye' : name, isBye);
    onClose();
  };

  const toggleBye = () => {
    const nextIsBye = !isBye;
    setIsBye(nextIsBye);
    if (nextIsBye) {
      setName('Bye');
    } else if (name === 'Bye') {
      setName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            Edit Entry #{index + 1}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Player / Participant Name
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.toLowerCase() === 'bye') setIsBye(true);
                else if (isBye) setIsBye(false);
              }}
              placeholder="Enter player name..."
              disabled={isBye}
              className="w-full text-sm font-semibold border border-slate-300 rounded-lg p-2.5 text-slate-900 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none transition disabled:opacity-50"
            />
          </div>

          <div
            onClick={toggleBye}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition select-none"
          >
            <div>
              <span className="text-xs font-bold text-slate-800 block">Mark as 'Bye' Slot</span>
              <span className="text-[11px] text-slate-500">
                Bye slots advance opposing players automatically
              </span>
            </div>
            {isBye ? (
              <ToggleRight className="w-6 h-6 text-blue-600" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-slate-400" />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
