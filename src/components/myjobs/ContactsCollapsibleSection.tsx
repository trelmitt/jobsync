"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Contact } from "@/models/contact.model";
import {
  getContactsByJobId,
  addContact,
  touchContact,
  deleteContact,
} from "@/actions/contact.actions";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  ChevronDown,
  Loader,
  PlusCircle,
  Trash,
  UserRound,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { toastActionResult } from "@/lib/toast";
import { formatDistanceToNow } from "date-fns";

type ContactsCollapsibleSectionProps = {
  jobId: string;
};

export function ContactsCollapsibleSection({
  jobId,
}: ContactsCollapsibleSectionProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadContacts = useCallback(async () => {
    const result = await getContactsByJobId(jobId);
    if (result.success) {
      setContacts(result.data);
    }
  }, [jobId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleCancel = () => {
    setIsAdding(false);
    setName("");
    setEmail("");
  };

  const handleSave = () => {
    if (!name.trim() || !email.trim()) return;

    startTransition(async () => {
      const result = await addContact({ jobId, name, email });
      toastActionResult(result, {
        success: "Contact added successfully",
        onSuccess: () => {
          handleCancel();
          loadContacts();
        },
      });
    });
  };

  const handleTouch = (contactId: string) => {
    startTransition(async () => {
      const result = await touchContact(contactId);
      toastActionResult(result, {
        success: "Marked as followed up",
        onSuccess: () => loadContacts(),
      });
    });
  };

  const handleDelete = (contactId: string) => {
    startTransition(async () => {
      const result = await deleteContact(contactId);
      toastActionResult(result, {
        success: "Contact deleted",
        onSuccess: () => loadContacts(),
      });
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mx-4 mb-4">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
          <UserRound className="h-4 w-4" />
          <span className="font-medium">Contacts</span>
          {contacts.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {contacts.length}
            </Badge>
          )}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="h-7 gap-1"
          onClick={() => {
            setIsAdding(true);
            setIsOpen(true);
          }}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          New Contact
        </Button>
      </div>
      <CollapsibleContent className="mt-3 space-y-3">
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Add Contact</p>
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isPending || !name.trim() || !email.trim()}
              >
                Save
                {isPending && <Loader className="ml-2 h-4 w-4 shrink-0 spinner" />}
              </Button>
            </div>
          </div>
        )}
        {contacts.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="border rounded-lg p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {contact.name}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {contact.email}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last touch {formatDistanceToNow(contact.lastTouchedAt, { addSuffix: true })}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={isPending}
                  onClick={() => handleTouch(contact.id)}
                >
                  Mark followed up
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  disabled={isPending}
                  onClick={() => handleDelete(contact.id)}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
