import { getSuggestions } from "@/actions/suggestion.actions";
import { SuggestionsInbox } from "@/components/suggestions/SuggestionsInbox";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const res = await getSuggestions();
  const suggestions = (res?.success ? res.data : []) ?? [];
  return (
    <div className="col-span-3 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Suggestions</h1>
        <p className="text-sm text-muted-foreground">
          Jobs your partner sent you. Triage each one — they&apos;ll see your
          verdict on their page.
        </p>
      </div>
      <SuggestionsInbox suggestions={suggestions} />
    </div>
  );
}
