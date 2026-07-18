import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export default function ScreenshotUploader({ files, onChange, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  const handleFiles = (fileList) => {
    setError('');
    const incoming = Array.from(fileList || []);
    const next = [...(files || [])];
    for (const file of incoming) {
      if (!ALLOWED.includes(file.type)) {
        setError('Only PNG, JPEG, and WebP images are allowed');
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError('Each screenshot must be 10MB or less');
        continue;
      }
      if (next.length >= MAX) {
        setError(`Maximum ${MAX} screenshots`);
        break;
      }
      next.push(file);
    }
    onChange(next);
  };

  const removeAt = (idx) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || (files?.length || 0) >= MAX}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
      >
        <ImagePlus size={16} />
        Add screenshots ({files?.length || 0}/{MAX})
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
      {!!files?.length && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-semibold"
            >
              <span className="max-w-[140px] truncate">{f.name}</span>
              <button type="button" onClick={() => removeAt(i)} aria-label="Remove">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
