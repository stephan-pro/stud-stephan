import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Auth, Session } from "../auth/auth";
import type { Catalog } from "../backend/catalog";
import { FakePriceRunner } from "../backend/fakePriceRun";
import type { LinkPreviewer } from "../backend/linkPreview";
import type { PriceRunner } from "../backend/priceRun";
import type { Recognizer } from "../backend/recognition";
import type { Remote } from "../backend/remote";
import type { SeriesBuilder } from "../backend/seriesBuilder";
import { formatDateTime } from "../domain/dates";
import { recordPriceRun } from "../domain/prices";
import type { Collection, RemovableObject } from "../domain/types";
import type { SnapshotStore } from "../pwa/snapshot";
import { APP_VERSION } from "../version";
import { CaptureLink } from "./captureLink";
import { CapturePhoto } from "./capturePhoto";
import { AccountCard } from "./components/AccountCard";
import { BackupCard } from "./components/BackupCard";
import { CaptureSheet } from "./components/CaptureSheet";
import { InstallCard } from "./components/InstallCard";
import { PhoneNavigation, Sidebar } from "./components/Navigation";
import { type HeaderSearch, PageHeader } from "./components/PageHeader";
import { PriceRunCard } from "./components/PriceRunCard";
import { SourcesCard } from "./components/SourcesCard";
import { StorageCard } from "./components/StorageCard";
import { Toast } from "./components/Toast";
import { UpdateNotice } from "./components/UpdateNotice";
import { today } from "./ids";
import { AssignPage } from "./pages/AssignPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DetailPage, detailName } from "./pages/DetailPage";
import { DioramaDetailPage, dioramaName } from "./pages/DioramaDetailPage";
import { DioramaFormPage } from "./pages/DioramaFormPage";
import { DioramasPage } from "./pages/DioramasPage";
import { FormPage } from "./pages/FormPage";
import { LinkPage } from "./pages/LinkPage";
import { PhotoPage } from "./pages/PhotoPage";
import { SearchPage } from "./pages/SearchPage";
import { SeriesDetailPage } from "./pages/SeriesDetailPage";
import { SeriesPage } from "./pages/SeriesPage";
import { INITIAL_VIEW, ShowcasePage, type ShowcaseView } from "./pages/ShowcasePage";
import { SignInPage } from "./pages/SignInPage";
import { WishlistPage } from "./pages/WishlistPage";
import { PhotoSourceContext } from "./photos";
import {
  DEFAULT_ROUTE,
  documentTitle,
  locationHash,
  type PageLocation,
  parseLocation,
  routeHash,
} from "./route";
import { TEXTS } from "./texts";
import {
  type LoadedCollection,
  type OfflineCopy,
  useCollection,
  useOnline,
  WritableContext,
} from "./useCollection";
import { usePendingRemoval } from "./usePendingRemoval";

/** The page of the current address; an empty or unknown address is rewritten to the start page. */
function currentLocation(): PageLocation {
  const page = parseLocation(location.hash);
  if (location.hash !== locationHash(page)) {
    // No new history entry: "Zurück" in the browser must not land on the unknown address again.
    history.replaceState(null, "", locationHash(page));
  }
  return page;
}

function focusHeading(): void {
  document.querySelector<HTMLElement>("main h1")?.focus();
}

interface ShellProps {
  readonly session: Session;
  /** The server's files and data; in the demo a store in memory. */
  readonly remote?: Remote | undefined;
  /** The official catalog (P7): search by number or name, entries to fill forms from. */
  readonly catalog?: Catalog | undefined;
  /** The photo recognition (P8): a photo of a figure in, suggestions out. */
  readonly recognizer?: Recognizer | undefined;
  /** Capture by link (P9): a pasted address in, what the page gives out. */
  readonly previewer?: LinkPreviewer | undefined;
  /** The price run (P11): its state and "Jetzt aktualisieren"; the demo makes its own. */
  readonly priceRunner?: PriceRunner | undefined;
  /** Themes and the figures of series (P12). */
  readonly seriesBuilder?: SeriesBuilder | undefined;
  /** The example collection of the demo (no server). */
  readonly demo?: Collection | undefined;
  /** Where the collection is kept for reading offline (P15); missing in the demo. */
  readonly snapshots?: SnapshotStore | undefined;
  /** Missing in the demo (no sign-in). */
  readonly onSignOut?: (() => void) | undefined;
  /** Move the focus to the heading at once (right after signing in; not on a fresh load). */
  readonly focusOnMount: boolean;
}

/** The shell: navigation (sidebar on the PC, bottom bar on the phone) and the current page. */
function Shell({
  session,
  remote,
  catalog,
  recognizer,
  previewer,
  priceRunner,
  seriesBuilder,
  demo,
  snapshots,
  onSignOut,
  focusOnMount,
}: ShellProps) {
  const [page, setPage] = useState(currentLocation);
  const [view, setView] = useState<ShowcaseView>(INITIAL_VIEW);
  /** The search of the diorama list (P15); like the showcase's it stays while the app runs. */
  const [dioramaSearch, setDioramaSearch] = useState({ open: false, query: "" });
  const offlineCopy = useMemo<OfflineCopy | undefined>(
    () => (snapshots && !demo ? { store: snapshots, userId: session.userId } : undefined),
    [snapshots, demo, session.userId],
  );
  const data = useCollection(remote, demo, offlineCopy);
  const runner = useDemoPriceRunner(priceRunner, demo, data);
  const online = useOnline();
  /** When the shown collection is the copy kept on the device (P15), the time it was kept. */
  const savedAt = data.state.status === "ready" ? data.state.savedAt : undefined;
  // Capturing and changing only with a connection and with the server's collection (P15).
  const writable = online && savedAt === undefined;
  const { retry } = data;
  // Back online while the copy is shown: ask the server again (the copy stays until it answers).
  useEffect(() => {
    if (online && savedAt !== undefined) retry();
  }, [online]);
  const firstPage = useRef(true);
  const removal = usePendingRemoval(remote, data);
  const { route, detail, form, search: catalogSearch, photo, link, diorama, series } = page;
  const address = locationHash(page);
  const name = detail
    ? detailName(data, detail)
    : diorama && diorama.kind !== "new"
      ? dioramaName(data, diorama.id)
      : undefined;

  /**
   * Deleting shows the list at once (the showcase, or the dioramas); the server hears of it when
   * "Rückgängig" ran out.
   */
  const remove = (item: RemovableObject) => {
    history.replaceState(null, "", routeHash(item.type === "diorama" ? "dioramas" : "showcase"));
    setPage(currentLocation());
    removal.remove(item);
  };

  /** The banner of the dioramas: the showcase, filtered to the figures that stand in none. */
  const showWithoutDiorama = () => {
    setView({ ...view, filter: { ...view.filter, withoutDiorama: true } });
    location.hash = routeHash("showcase");
  };

  useEffect(() => {
    const onHashChange = () => setPage(currentLocation());
    addEventListener("hashchange", onHashChange);
    // The address may have changed between the first render and this listener.
    onHashChange();
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.title = documentTitle(route, name);
  }, [route, name]);

  // The photo of the recognition lives as long as the person stays on its way: recognition,
  // search, form. Anywhere else it is let go, so it never lands on an unrelated figure.
  useEffect(() => {
    if (!photo && !catalogSearch && !form) CapturePhoto.clear();
  }, [photo, catalogSearch, form]);

  // What was read from a pasted link is kept only for the form that follows it.
  useEffect(() => {
    if (!link && form?.mode !== "link") CaptureLink.clear();
  }, [link, form]);

  useEffect(() => {
    // A freshly loaded page starts at the top without moving the focus (the skip link comes
    // first). After a page change keyboard and screen reader users start at the new heading.
    if (firstPage.current) {
      firstPage.current = false;
      if (focusOnMount) focusHeading();
      return;
    }
    scrollTo(0, 0);
    focusHeading();
  }, [address, focusOnMount]);

  const hasItems =
    data.state.status === "ready" &&
    data.state.collection.minifigs.length +
      data.state.collection.sets.length +
      data.state.collection.specialParts.length >
      0;
  const hasDioramas = data.state.status === "ready" && data.state.collection.dioramas.length > 0;
  const search: HeaderSearch | undefined =
    route === "showcase" && !detail && hasItems
      ? {
          open: view.searchOpen,
          query: view.filter.query,
          onQuery: (query: string) => setView({ ...view, filter: { ...view.filter, query } }),
          onToggle: () => {
            setView({ ...view, searchOpen: !view.searchOpen });
            if (!view.searchOpen) {
              requestAnimationFrame(() => document.getElementById("showcase-search")?.focus());
            }
          },
        }
      : route === "dioramas" && hasDioramas
        ? {
            open: dioramaSearch.open,
            query: dioramaSearch.query,
            onQuery: (query: string) => setDioramaSearch({ ...dioramaSearch, query }),
            onToggle: () => {
              // Closing the field on the phone also ends the search, so no list stays filtered unseen.
              setDioramaSearch(
                dioramaSearch.open ? { open: false, query: "" } : { ...dioramaSearch, open: true },
              );
              if (!dioramaSearch.open) {
                requestAnimationFrame(() => document.getElementById("dioramas-search")?.focus());
              }
            },
          }
        : undefined;

  return (
    <PhotoSourceContext.Provider value={remote}>
      <WritableContext.Provider value={writable}>
        <div class="shell">
          {/* A button, not a link to "#inhalt": the address belongs to the router. */}
          <button type="button" class="skip-link" onClick={focusHeading}>
            {TEXTS.skipLink}
          </button>
          <Sidebar current={route} />
          <main
            class={`page page--${route}${form || (diorama && diorama.kind !== "detail") ? " page--form" : ""}`}
          >
            {savedAt !== undefined ? (
              <div class="banner banner--offline" role="status">
                <span>
                  {online
                    ? TEXTS.serverCopy(formatDateTime(savedAt))
                    : TEXTS.offlineCopy(formatDateTime(savedAt))}
                </span>
                {online && (
                  <button type="button" class="button button--secondary pressable" onClick={retry}>
                    {TEXTS.serverCopyRetry}
                  </button>
                )}
              </div>
            ) : (
              !online && (
                <p class="banner" role="status">
                  {TEXTS.offline}
                </p>
              )
            )}
            {diorama ? (
              <div class="detail">
                {diorama.kind === "detail" && (
                  <DioramaDetailPage
                    data={data}
                    id={diorama.id}
                    remote={remote}
                    onRemove={remove}
                  />
                )}
                {diorama.kind === "assign" && (
                  <AssignPage data={data} id={diorama.id} remote={remote} />
                )}
                {(diorama.kind === "new" || diorama.kind === "edit") && (
                  <DioramaFormPage
                    key={address}
                    data={data}
                    editing={diorama.kind === "edit" ? diorama.id : undefined}
                    remote={remote}
                  />
                )}
              </div>
            ) : series?.kind === "detail" ? (
              <div class="detail">
                <SeriesDetailPage
                  key={address}
                  id={series.id}
                  data={data}
                  builder={seriesBuilder}
                  remote={remote}
                />
              </div>
            ) : form ? (
              <div class="detail">
                <FormPage
                  key={address}
                  data={data}
                  form={form}
                  remote={remote}
                  catalog={catalog}
                  previewer={previewer}
                />
              </div>
            ) : link ? (
              <div class="detail">
                <LinkPage
                  key={address}
                  type={link}
                  previewer={previewer}
                  forWish={page.forWish === true}
                  data={data}
                  remote={remote}
                  catalog={catalog}
                />
              </div>
            ) : photo ? (
              <div class="detail">
                <PhotoPage recognizer={recognizer} />
              </div>
            ) : catalogSearch ? (
              <div class="detail">
                <SearchPage
                  key={page.forWish ? "wish" : "object"}
                  type={catalogSearch}
                  catalog={catalog}
                  forWish={page.forWish === true}
                  data={data}
                  remote={remote}
                />
              </div>
            ) : detail ? (
              <div class="detail">
                <DetailPage data={data} detail={detail} remote={remote} onRemove={remove} />
              </div>
            ) : (
              <>
                <PageHeader route={route} search={search} />
                {(route === "showcase" || route === "capture") && (
                  <ShowcasePage data={data} view={view} onView={setView} />
                )}
                {route === "capture" && (
                  <CaptureSheet onClose={() => (location.hash = routeHash("showcase"))} />
                )}
                {route === "settings" && (
                  <AccountCard email={session.email} onSignOut={onSignOut} />
                )}
                {route === "settings" && <InstallCard />}
                {route === "settings" && catalog !== undefined && <SourcesCard catalog={catalog} />}
                {route === "settings" && runner !== undefined && (
                  // The demo writes the prices straight into the shown collection.
                  <PriceRunCard runner={runner} onPricesChanged={demo ? () => {} : data.retry} />
                )}
                {route === "settings" && remote !== undefined && <StorageCard remote={remote} />}
                {route === "settings" && remote !== undefined && (
                  <BackupCard
                    remote={remote}
                    collection={data.state.status === "ready" ? data.state.collection : undefined}
                    onRestored={reloadFrom(remote, data)}
                  />
                )}
                {route === "settings" && <p class="version">{TEXTS.version(APP_VERSION)}</p>}
                {route === "dioramas" && (
                  <DioramasPage
                    data={data}
                    query={dioramaSearch.query}
                    onShowWithoutDiorama={showWithoutDiorama}
                  />
                )}
                {route === "wishlist" &&
                  (series ? (
                    <SeriesPage data={data} builder={seriesBuilder} />
                  ) : (
                    <WishlistPage data={data} remote={remote} />
                  ))}
                {route === "dashboard" && (
                  <DashboardPage
                    data={data}
                    today={today()}
                    onShowWithoutDiorama={showWithoutDiorama}
                  />
                )}
              </>
            )}
          </main>
          {removal.pending && (
            <Toast
              message={TEXTS.remove.done(removal.pending.name)}
              action={TEXTS.remove.undo}
              onAction={removal.undo}
            />
          )}
          {removal.failed && <Toast message={TEXTS.remove.failed} />}
          {route !== "settings" &&
            !form &&
            !catalogSearch &&
            !photo &&
            !link &&
            (!diorama || diorama.kind === "detail") && <PhoneNavigation current={route} />}
        </div>
      </WritableContext.Provider>
    </PhotoSourceContext.Provider>
  );
}

/**
 * What the settings call after a backup was imported: the collection is read from the server
 * again and shown (the demo has its collection in the page, so it is replaced instead of loaded).
 */
function reloadFrom(remote: Remote, data: LoadedCollection): () => void {
  return () => {
    remote.load().then(
      (fresh) => data.update(() => fresh),
      () => data.retry(),
    );
  };
}

/**
 * The price runner of the shell. The demo has no server and shows its example collection from
 * memory, so its runner reads that collection and writes the new price points into it.
 */
function useDemoPriceRunner(
  given: PriceRunner | undefined,
  demo: Collection | undefined,
  data: LoadedCollection,
): PriceRunner | undefined {
  // Read through refs: the runner must stay the same object while the collection changes.
  const state = useRef(data.state);
  state.current = data.state;
  const change = useRef(data.update);
  change.current = data.update;
  return useMemo(() => {
    if (given || !demo) return given;
    return new FakePriceRunner({
      load: async () => {
        const current = state.current;
        if (current.status !== "ready") throw new Error("Die Beispielsammlung lädt noch");
        return current.collection;
      },
      savePrice: async (point) =>
        change.current((collection) => ({
          ...collection,
          prices: recordPriceRun(
            collection.prices,
            [{ ...point, ok: true, cents: point.cents }],
            point.date,
          ),
        })),
    });
  }, [given, demo]);
}

/** Stands in for a session in the demo, which has no sign-in. */
const DEMO_SESSION: Session = { userId: "demo", email: "" };

/**
 * Sign-in first (P4b), then the shell. `auth` is `null` in the demo: no sign-in. The session is
 * read from the device, so a reload stays signed in; when it ends (signed out here, or refused by
 * the server) the sign-in page comes back.
 */
export function App({
  auth,
  remote,
  catalog,
  recognizer,
  previewer,
  priceRunner,
  seriesBuilder,
  demo,
  snapshots,
}: {
  readonly auth: Auth | null;
  readonly remote?: Remote | undefined;
  readonly catalog?: Catalog | undefined;
  readonly recognizer?: Recognizer | undefined;
  readonly previewer?: LinkPreviewer | undefined;
  readonly priceRunner?: PriceRunner | undefined;
  readonly seriesBuilder?: SeriesBuilder | undefined;
  /** The example collection; only the demo has one. */
  readonly demo?: Collection | undefined;
  /** The copy of the collection for reading offline (P15); it leaves the device on signing out. */
  readonly snapshots?: SnapshotStore | undefined;
}) {
  return (
    <>
      <UpdateNotice />
      <Signed
        auth={auth}
        remote={remote}
        catalog={catalog}
        recognizer={recognizer}
        previewer={previewer}
        priceRunner={priceRunner}
        seriesBuilder={seriesBuilder}
        demo={demo}
        snapshots={snapshots}
      />
    </>
  );
}

function Signed({
  auth,
  remote,
  catalog,
  recognizer,
  previewer,
  priceRunner,
  seriesBuilder,
  demo,
  snapshots,
}: Parameters<typeof App>[0]) {
  /** `undefined` while it is read from the device, `null` when signed out. */
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  /** Whether the session changed while the app ran (then the new page takes the focus). */
  const changed = useRef(false);

  useEffect(() => {
    if (auth === null) return;
    let active = true;
    void auth.session().then((remembered) => {
      if (active) setSession((current) => (current === undefined ? remembered : current));
    });
    const stop = auth.onChange((next) => {
      changed.current = true;
      // Signed out (here or refused by the server): the copy of the collection leaves the device.
      if (next === null) void snapshots?.clear();
      setSession(next);
    });
    return () => {
      active = false;
      stop();
    };
  }, [auth]);

  if (auth === null) {
    return (
      <Shell
        session={DEMO_SESSION}
        remote={remote}
        catalog={catalog}
        recognizer={recognizer}
        previewer={previewer}
        priceRunner={priceRunner}
        seriesBuilder={seriesBuilder}
        demo={demo}
        focusOnMount={false}
      />
    );
  }
  if (session === undefined) return null;
  if (session === null) {
    return (
      <SignInPage
        auth={auth}
        focusOnMount={changed.current}
        onSignedIn={(signedIn) => {
          changed.current = true;
          setSession(signedIn);
        }}
      />
    );
  }

  const signOut = async () => {
    // After signing in again the app starts at the showcase, not at the settings.
    history.replaceState(null, "", routeHash(DEFAULT_ROUTE));
    changed.current = true;
    await snapshots?.clear();
    await auth.signOut();
    setSession(null);
  };

  return (
    <Shell
      session={session}
      remote={remote}
      catalog={catalog}
      recognizer={recognizer}
      previewer={previewer}
      priceRunner={priceRunner}
      seriesBuilder={seriesBuilder}
      snapshots={snapshots}
      onSignOut={() => void signOut()}
      focusOnMount={changed.current}
    />
  );
}
