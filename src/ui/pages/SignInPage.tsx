import { useEffect, useRef, useState } from "preact/hooks";
import {
  type Auth,
  AuthError,
  type AuthFailure,
  CODE_DIGITS,
  codeDigits,
  emailAddress,
  RESEND_SECONDS,
  type Session,
} from "../../auth/auth";
import { type CodeStep, rememberedStep, rememberStep } from "../../auth/codeStep";
import { Scribbles } from "../components/Scribbles";
import { Studs } from "../components/Studs";
import { TEXTS } from "../texts";

interface SignInPageProps {
  readonly auth: Auth;
  /** Called with the new session once the code was right. */
  readonly onSignedIn: (session: Session) => void;
  /** Move the focus to the heading (after signing out; not on a fresh load). */
  readonly focusOnMount?: boolean;
}

const EMAIL_FIELD = "anmelden-email";
const CODE_FIELD = "anmelden-code";
const T = TEXTS.signIn;

/** What is wrong at a field: a refused step, or a code that cannot be right at first sight. */
type Problem = AuthFailure | "codeFormat";

function problemOf(error: unknown): Problem {
  return error instanceof AuthError ? error.failure : "unknown";
}

function problemText(problem: Problem): string {
  return problem === "codeFormat" ? T.codeFormat : T.failures[problem];
}

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly onInput: (value: string) => void;
  /** The keyboard on the phone (the input itself is plain text; the app checks the value). */
  readonly inputMode: "email" | "numeric";
  readonly autocomplete: "email" | "one-time-code";
  readonly placeholder?: string;
}

/** A labelled input with its message below; a refused step marks it and points to the message. */
function Field({ id, label, value, error, onInput, placeholder, ...input }: FieldProps) {
  const errorId = `${id}-fehler`;
  return (
    <div class="field">
      <label class="field__label" for={id}>
        {label}
      </label>
      <input
        class="field__input"
        id={id}
        value={value}
        aria-invalid={error === undefined ? undefined : "true"}
        aria-describedby={error === undefined ? undefined : errorId}
        onInput={(event) => onInput(event.currentTarget.value)}
        type="text"
        inputMode={input.inputMode}
        autocomplete={input.autocomplete}
        placeholder={placeholder}
      />
      {error !== undefined && (
        <p class="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * S0: the e-mail address, then the six-digit code from the mail (P4b, like Krümel; no link). The
 * yellow page of the click dummy with studs and scribbles; the card below changes from the address
 * to the code. The step is kept on the device, so switching to the mail app and back (which often
 * reloads the page on a phone) lands on the code again. A refused step shows its message at the
 * field and moves the focus there. Whether an address has an account is never said.
 */
export function SignInPage({ auth, onSignedIn, focusOnMount = false }: SignInPageProps) {
  const [step, setStep] = useState<CodeStep | undefined>(() =>
    rememberedStep(localStorage, Date.now()),
  );
  const [email, setEmail] = useState(step?.email ?? "");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<Problem>();
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);
  /** The field that gets the focus after the next change of the step. */
  const focusNext = useRef<string | undefined>(undefined);

  useEffect(() => {
    document.title = `${T.tabTitle} – ${TEXTS.appName}`;
    if (focusOnMount) document.querySelector<HTMLElement>("main h1")?.focus();
  }, [focusOnMount]);

  // After the address the code field gets the focus, so the code can be typed at once.
  // Only once the step has finished (not busy): WebKit drops a focus set in the render in between.
  useEffect(() => {
    if (focusNext.current === undefined || busy) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = undefined;
  });

  // A new code may be asked for a minute after the last one; until then a hint says so.
  useEffect(() => {
    if (step === undefined) return;
    const wait = step.sentAt + RESEND_SECONDS * 1000 - Date.now();
    setCanResend(wait <= 0);
    if (wait <= 0) return;
    const timer = setTimeout(() => setCanResend(true), wait);
    return () => clearTimeout(timer);
  }, [step]);

  function fail(found: Problem, fieldId: string) {
    setProblem(found);
    setResent(false);
    document.getElementById(fieldId)?.focus();
  }

  /** Runs one step at a time; a second tap while it runs does nothing. */
  async function run(action: () => Promise<void>, fieldId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (refused) {
      fail(problemOf(refused), fieldId);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(address: string) {
    await auth.requestCode(address);
    const sent: CodeStep = { email: address, sentAt: Date.now() };
    rememberStep(localStorage, sent);
    focusNext.current = CODE_FIELD;
    setStep(sent);
    setCode("");
    setProblem(undefined);
  }

  function submitEmail(event: Event) {
    event.preventDefault();
    void run(async () => {
      await sendCode(emailAddress(email));
      setResent(false);
    }, EMAIL_FIELD);
  }

  function submitCode(event: Event) {
    event.preventDefault();
    if (step === undefined) return;
    const digits = codeDigits(code);
    if (!new RegExp(`^\\d{${CODE_DIGITS}}$`).test(digits)) {
      fail("codeFormat", CODE_FIELD);
      return;
    }
    void run(async () => {
      const session = await auth.verifyCode(step.email, digits);
      rememberStep(localStorage, undefined);
      onSignedIn(session);
    }, CODE_FIELD);
  }

  function resend() {
    if (step === undefined) return;
    void run(async () => {
      await sendCode(step.email);
      setResent(true);
    }, CODE_FIELD);
  }

  function otherEmail() {
    rememberStep(localStorage, undefined);
    focusNext.current = EMAIL_FIELD;
    setStep(undefined);
    setProblem(undefined);
    setResent(false);
  }

  const error = problem === undefined ? undefined : problemText(problem);

  return (
    <main class="sign-in">
      <Scribbles id="anmelden-kritzel" />
      <div class="sign-in__brand">
        <Studs large />
        {/* One word per line, as in the click dummy (CSS: `width: min-content`). */}
        <h1 class="sign-in__title" tabIndex={-1}>
          {TEXTS.appName}
        </h1>
        <p class="sign-in__tagline">{T.tagline}</p>
      </div>
      {step === undefined ? (
        <form
          class="sign-in__card"
          onSubmit={submitEmail}
          noValidate
          aria-labelledby="anmelden-titel"
        >
          <h2 class="sign-in__card-title" id="anmelden-titel">
            {T.title}
          </h2>
          <Field
            id={EMAIL_FIELD}
            label={T.emailLabel}
            inputMode="email"
            autocomplete="email"
            placeholder={T.emailPlaceholder}
            value={email}
            error={error}
            onInput={setEmail}
          />
          <button class="button button--primary pressable" type="submit">
            {busy ? T.sending : T.sendCode}
          </button>
          <p class="sign-in__note">{T.intro}</p>
        </form>
      ) : (
        <form
          class="sign-in__card"
          onSubmit={submitCode}
          noValidate
          aria-labelledby="anmelden-titel"
        >
          <h2 class="sign-in__card-title" id="anmelden-titel">
            {T.codeTitle}
          </h2>
          <p class="sign-in__text">{T.codeSent(step.email)}</p>
          <Field
            id={CODE_FIELD}
            label={T.codeLabel}
            inputMode="numeric"
            autocomplete="one-time-code"
            value={code}
            error={error}
            onInput={setCode}
          />
          <button class="button button--primary pressable" type="submit">
            {busy ? T.verifying : T.verify}
          </button>
          <p class="sign-in__note" role="status">
            {resent ? T.resent : canResend ? T.resendReady : T.resendWait}
          </p>
          <div class="sign-in__actions">
            {canResend && (
              <button class="button button--secondary pressable" type="button" onClick={resend}>
                {T.resend}
              </button>
            )}
            <button class="button button--quiet" type="button" onClick={otherEmail}>
              {T.otherEmail}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
