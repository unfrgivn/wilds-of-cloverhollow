const svgNamespace = "http://www.w3.org/2000/svg";

export type Box = { x: number; y: number; width: number; height: number };

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: Element,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent?.append(node);
  return node;
}

export function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  className: string,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(svgNamespace, tag);
  node.setAttribute("class", className);
  parent?.append(node);
  return node;
}

// The game renders every frame; only touch the DOM when something changed.
export function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setAttribute(node: Element, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function setStyle(node: HTMLElement | SVGElement, name: string, value: string): void {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}

export function place(node: HTMLElement | SVGElement, rect: Box): void {
  setStyle(node, "left", `${rect.x}px`);
  setStyle(node, "top", `${rect.y}px`);
  setStyle(node, "width", `${rect.width}px`);
  setStyle(node, "height", `${rect.height}px`);
}

export function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function measure(node: Element): Box {
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export function syncAttachedAfter(anchor: Element, node: Element, show: boolean): void {
  if (show) {
    if (!node.isConnected || anchor.nextElementSibling !== node) anchor.after(node);
  } else if (node.isConnected) {
    node.remove();
  }
}
