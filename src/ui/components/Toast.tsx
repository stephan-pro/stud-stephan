/** A short message at the bottom with one action, e.g. "Rückgängig" after deleting. */
export function Toast({
  message,
  action,
  onAction,
}: {
  readonly message: string;
  readonly action?: string;
  readonly onAction?: () => void;
}) {
  return (
    <div class="toast" role="status">
      <span class="toast__text">{message}</span>
      {action && (
        <button type="button" class="toast__action pressable" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
