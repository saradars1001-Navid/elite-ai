import React, { useCallback } from "react";

export default function useConfirm() {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<{
    title?: string;
    body?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
  } | null>(null);

  const confirm = useCallback(
    (
      options: {
        title?: string;
        body?: React.ReactNode;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm?: () => void;
      } = {}
    ) => {
      setOpts(options);
      setOpen(true);
    },
    []
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    // delay so the backdrop click / escape doesn't immediately fire onConfirm
    setTimeout(() => setOpts(null), 0);
  }, []);

  const handleConfirm = useCallback(() => {
    opts?.onConfirm?.();
    handleClose();
  }, [opts, handleClose]);

  return {
    confirm,
    open,
    title: opts?.title ?? "تأیید",
    body: opts?.body ?? null,
    confirmLabel: opts?.confirmLabel ?? "تأیید",
    cancelLabel: opts?.cancelLabel ?? "انصراف",
    onConfirm: handleConfirm,
    onCancel: handleClose,
  };
}
