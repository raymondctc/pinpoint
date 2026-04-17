import { useState } from 'react';
import type { DOMSnapshotNode } from '@pinpoint/shared';

interface DOMSnapshotRendererProps {
  node: DOMSnapshotNode | null;
}

export function DOMSnapshotRenderer({ node }: DOMSnapshotRendererProps) {
  if (!node) {
    return (
      <div style={{ padding: '16px', color: '#6b7280', fontSize: '14px' }}>
        No DOM snapshot available.
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: '400px' }}>
      <DOMNodeRow node={node} depth={0} />
    </div>
  );
}

function DOMNodeRow({ node, depth }: { node: DOMSnapshotNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);

  const hasChildren = node.children && node.children.length > 0;
  const shouldTruncate = depth >= 3;

  const inlineStyles: React.CSSProperties = {
    ...(node.computedStyles as Record<string, string>),
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '1px 4px',
    borderRadius: '3px',
    display: 'inline-block',
    marginBottom: '2px',
  };

  const nodeStyle: React.CSSProperties = {
    marginLeft: `${depth * 16}px`,
    marginBottom: '4px',
  };

  if (shouldTruncate) {
    return (
      <div style={nodeStyle}>
        <span style={labelStyle}>&lt;{node.tagName}&gt;</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '4px' }}>...</span>
      </div>
    );
  }

  return (
    <div style={nodeStyle}>
      <div>
        <span
          style={{ cursor: hasChildren ? 'pointer' : 'default', marginRight: '4px' }}
          onClick={() => hasChildren && setExpanded((prev: boolean) => !prev)}
        >
          {hasChildren && <span style={{ fontSize: '10px', color: '#9ca3af' }}>{expanded ? '▼' : '▶'}</span>}
        </span>
        <span style={labelStyle}>&lt;{node.tagName}&gt;</span>
        {node.textContent && (
          <span style={{ fontSize: '12px', color: '#374151', marginLeft: '4px' }}>
            {node.textContent.length > 80 ? node.textContent.slice(0, 80) + '...' : node.textContent}
          </span>
        )}
      </div>
      <div style={inlineStyles}>
        {expanded && hasChildren && node.children.map((child, i) => (
          <DOMNodeRow key={i} node={child} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}