import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { bootstrapPiSdk } from './utils/piSdk'

bootstrapPiSdk()

const container = document.getElementById('root')!;

const originalRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  if (child.parentNode !== this) {
    console.warn('[DOM] removeChild: node is not a child — suppressed');
    return child;
  }
  return originalRemoveChild.call(this, child) as T;
};

const originalInsertBefore = Node.prototype.insertBefore;
Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
  if (refNode && refNode.parentNode !== this) {
    console.warn('[DOM] insertBefore: refNode is not a child — suppressed');
    return newNode;
  }
  return originalInsertBefore.call(this, newNode, refNode) as T;
};

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)



