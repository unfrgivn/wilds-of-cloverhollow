export function preventPinchZoom(): void {
  document.addEventListener("gesturestart", (event) => event.preventDefault());
}
