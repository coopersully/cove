import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import type { JSX } from "react";
import { useEffect, useRef } from "react";

interface EmojiPickerProps {
  readonly onSelect: (emoji: string) => void;
  readonly onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={containerRef} className="absolute bottom-full right-0 z-50 mb-2">
      <Picker
        data={data}
        onEmojiSelect={(emoji: { native: string }) => {
          onSelect(emoji.native);
          onClose();
        }}
        theme="dark"
        previewPosition="none"
        skinTonePosition="search"
        set="native"
      />
    </div>
  );
}
