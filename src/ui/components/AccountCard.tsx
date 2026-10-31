import { TEXTS } from "../texts";

interface AccountCardProps {
  /** The signed-in address; empty in the demo (no sign-in). */
  readonly email: string;
  /** Signs out on this device; missing in the demo. */
  readonly onSignOut?: (() => void) | undefined;
}

/** S12, top card: avatar "S", name, address and "Abmelden" (as in the click dummy). */
export function AccountCard({ email, onSignOut }: AccountCardProps) {
  const T = TEXTS.account;
  return (
    <section class="card account" aria-label={T.label}>
      <div class="account__person">
        <span class="avatar avatar--large" aria-hidden="true">
          {TEXTS.avatarInitial}
        </span>
        <div class="account__text">
          <span class="account__name">{T.name}</span>
          <span class="account__email">{onSignOut === undefined ? T.demo : email}</span>
        </div>
      </div>
      {onSignOut !== undefined && (
        <button class="button button--secondary pressable" type="button" onClick={onSignOut}>
          {T.signOut}
        </button>
      )}
    </section>
  );
}
