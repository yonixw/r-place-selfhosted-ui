import * as React from "react";
import { render } from "react-dom";
import ReactModal from "react-modal";

export function Modal(props: { appElement: HTMLElement | null }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      {props.appElement && (
        <ReactModal
          isOpen={open}
          appElement={props.appElement}
          contentLabel="Are You Human"
        >
          <button onClick={() => setOpen(false)}>Close Modal</button>
        </ReactModal>
      )}
    </>
  );
}
