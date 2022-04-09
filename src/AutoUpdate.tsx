import * as React from "react";

export function AutoUpdate<T>(props: {
  rootElement: HTMLElement | null;
  getChild: (w: number, h: number) => React.ReactNode;
}) {
  const [h, setH] = React.useState(props.rootElement?.clientHeight || 0);
  const [w, setW] = React.useState(props.rootElement?.clientWidth || 0);

  React.useEffect(() => {
    function handleUpdates() {
      setH(props.rootElement?.clientHeight || 0);
      setW(props.rootElement?.clientWidth || 0);
    }
    window.addEventListener("resize", handleUpdates);
    return () => window.removeEventListener("resize", handleUpdates);
  });

  return (
    <div key={`${w},${h}`} style={{ width: "100%" }}>
      {props.getChild(w, h)}
    </div>
  );
}
