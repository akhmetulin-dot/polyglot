import { type NodeRecord } from './idb';

export interface LayoutNode extends NodeRecord {
  x: number;
  y: number;
  children: LayoutNode[];
  width: number;
  height: number;
  subtreeHeight: number;
}

const COLUMN_W = 200;
const ROW_H = 32;
const GAP_Y = 12;

export function buildTree(nodes: NodeRecord[]): LayoutNode | null {
  const map = new Map<string, LayoutNode>();
  let root: LayoutNode | null = null;

  nodes.forEach(n => {
    map.set(n.id, { 
      ...n, 
      x: 0, 
      y: 0, 
      children: [], 
      width: 160, 
      height: ROW_H,
      subtreeHeight: ROW_H
    });
  });

  nodes.forEach(n => {
    const ln = map.get(n.id)!;
    if (n.parentId) {
      const parent = map.get(n.parentId);
      if (parent) parent.children.push(ln);
    } else {
      root = ln;
    }
  });

  map.forEach(ln => {
    ln.children.sort((a, b) => a.order - b.order);
  });

  return root;
}

export function layoutTree(root: LayoutNode) {
  // First pass: compute subtree heights
  function computeSubtree(node: LayoutNode) {
    if (node.collapsed || node.children.length === 0) {
      node.subtreeHeight = node.height;
    } else {
      let h = 0;
      node.children.forEach((child, i) => {
        computeSubtree(child);
        h += child.subtreeHeight;
        if (i < node.children.length - 1) h += GAP_Y;
      });
      // A parent node itself is height ROW_H, we take max to ensure it doesn't compress
      node.subtreeHeight = Math.max(node.height, h);
    }
  }

  computeSubtree(root);

  // Second pass: position nodes
  function position(node: LayoutNode, depth: number, startY: number) {
    node.x = depth * COLUMN_W;
    
    if (node.collapsed || node.children.length === 0) {
      node.y = startY + (node.subtreeHeight - node.height) / 2;
    } else {
      let currentY = startY;
      node.children.forEach(child => {
        position(child, depth + 1, currentY);
        currentY += child.subtreeHeight + GAP_Y;
      });
      
      const firstChild = node.children[0];
      const lastChild = node.children[node.children.length - 1];
      const childrenMidY = (firstChild.y + lastChild.y) / 2;
      
      node.y = childrenMidY;
    }
  }

  // To keep root roughly around y=0, we start it at -root.subtreeHeight/2
  position(root, 0, -root.subtreeHeight / 2);
}

// Flat list of layout nodes for rendering
export function getFlatLayout(root: LayoutNode): LayoutNode[] {
  const list: LayoutNode[] = [];
  function traverse(node: LayoutNode) {
    list.push(node);
    if (!node.collapsed) {
      node.children.forEach(traverse);
    }
  }
  if (root) traverse(root);
  return list;
}
