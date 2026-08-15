import React from 'react';

// Reserved space for unit crests / vehicle photos. Deliberately a placeholder:
// no artwork is shipped, but the layout already accounts for it.
export default function ImagePlaceholder({ kind = 'UN', className = '', label = 'No image' }) {
  return (
    <div className={`img-ph ${className}`} title={label} aria-label={label}>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        {kind === 'BL' ? (
          <>
            <circle cx="24" cy="17" r="8" />
            <path d="M8 44c0-9 7.2-14 16-14s16 5 16 14z" />
          </>
        ) : kind === 'CR' ? (
          <>
            <path d="M4 30h28l6-8h6v12H4z" />
            <circle cx="13" cy="38" r="4" />
            <circle cx="35" cy="38" r="4" />
          </>
        ) : (
          <path d="M24 4l18 7v13c0 11-7.6 18.5-18 20-10.4-1.5-18-8.5-18-20V11z" />
        )}
      </svg>
      <span className="img-ph-label">{label}</span>
    </div>
  );
}
