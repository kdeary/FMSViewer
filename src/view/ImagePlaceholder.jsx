import React, { useMemo } from 'react';
import USG, { describeToSvg } from '../vendor/usg.min.js';

// Reserved space for unit crests / vehicle photos / USG unit symbols.
export default function ImagePlaceholder({ node, kind = 'UN', className = '', label = 'No image', title = '' }) {
  const isUnit = node ? node.kind === 'UN' : kind === 'UN';
  const rawTitle = node?.title || title || (typeof label === 'string' && !['No crest', 'No image', 'No photo'].includes(label) ? label : '');
  const unitTitle = rawTitle.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const instanceId = useMemo(() => `usg-clip-${Math.random().toString(36).slice(2, 9)}`, []);

  const symbolSvg = useMemo(() => {
    if (!isUnit || !unitTitle) return null;
    try {
      const renderFn = describeToSvg || (USG && USG.describeToSvg);
      if (typeof renderFn === 'function') {
        let svgStr = renderFn(unitTitle, { size: 100 });
        if (svgStr && svgStr.includes('<svg')) {
          // Replace duplicate clipPath IDs with a unique instance ID so browser doesn't clip out main icons/modifiers
          svgStr = svgStr
            .replace(/clip-path="url\(#usg-frame\)"/g, `clip-path="url(#${instanceId})"`)
            .replace(/clipPath id="usg-frame"/g, `clipPath id="${instanceId}"`)
            .replace(/style="color:#000"/g, '');
          return svgStr;
        }
      }
    } catch (e) {
      console.warn('Failed to generate unit symbol for title:', unitTitle, e);
    }
    return null;
  }, [unitTitle, isUnit, instanceId]);

  if (symbolSvg) {
    return (
      <div
        className={`img-ph img-ph-usg ${className}`}
        title={unitTitle}
        aria-label={unitTitle}
        dangerouslySetInnerHTML={{ __html: symbolSvg }}
      />
    );
  }

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
