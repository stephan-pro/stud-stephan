/** The four studs (DESIGN.md section 5: only above "Hey Stephan" and on the sign-in page). */
export function Studs({ large = false }: { readonly large?: boolean }) {
  const stud = large ? "stud stud--large" : "stud";
  return (
    <div class="studs" aria-hidden="true">
      <span class={stud} />
      <span class={stud} />
      <span class={stud} />
      <span class={stud} />
    </div>
  );
}
