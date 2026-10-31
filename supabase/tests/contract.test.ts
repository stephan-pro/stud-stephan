import { describeRemoteContract } from "../../src/backend/remote.contract";
import { SupabaseRemote } from "../../src/backend/supabaseRemote";
import { signedIn } from "./setup";

// The same series of tests as for the fakes (`FakeRemote`, fake server), with the app's own
// `SupabaseRemote` against the real database functions, row level security and storage policies.
describeRemoteContract("SupabaseRemote (lokale Supabase-Instanz)", async () => {
  const [a, b] = await Promise.all([signedIn(), signedIn()]);
  return { a: new SupabaseRemote(a.client), b: new SupabaseRemote(b.client) };
});
