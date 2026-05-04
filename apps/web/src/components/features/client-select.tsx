"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Client, ClientService } from "@/services/client-service";
import { useTenant } from "@/providers/tenant-provider";
import { compareDisplayText, normalizeSortText } from "@/lib/sort-text";
import { normalize } from "@/utils/text";
import { Loader } from "@/components/ui/loader";

interface ClientSelectProps {
  value: string; // client name
  clientId?: string; // client id if selected from existing
  onChange: (data: {
    clientId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    isNew: boolean;
  }) => void;
  disabled?: boolean;
  error?: boolean;
}

export function ClientSelect({
  value,
  clientId,
  onChange,
  disabled,
  error,
}: ClientSelectProps) {
  const { tenant } = useTenant();
  const [open, setOpen] = React.useState(false);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync input value with external value
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Load clients on mount
  React.useEffect(() => {
    const loadClients = async () => {
      if (!tenant) return;
      setIsLoading(true);
      try {
        const data = await ClientService.getClients(tenant.id);
        setClients(data);
      } catch (error) {
        console.error("Error loading clients:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (tenant) {
      loadClients();
    }
  }, [tenant]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectClient = (client: Client) => {
    setInputValue(client.name);
    // Always call onChange to ensure the selection is registered
    // The parent component will decide whether to update fields based on whether it's the same client
    onChange({
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      clientAddress: client.address,
      isNew: false,
    });
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setOpen(true);

    // If typing, mark as new client
    onChange({
      clientId: undefined,
      clientName: newValue,
      clientEmail: undefined,
      clientPhone: undefined,
      clientAddress: undefined,
      isNew: true,
    });
  };

  const handleClear = () => {
    setInputValue("");
    onChange({
      clientId: undefined,
      clientName: "",
      clientEmail: undefined,
      clientPhone: undefined,
      clientAddress: undefined,
      isNew: true,
    });
    inputRef.current?.focus();
  };

  const filteredClients = React.useMemo(() => {
    const sortedClients = [...clients].sort((a, b) =>
      compareDisplayText(a.name, b.name),
    );
    if (!inputValue.trim()) return sortedClients;
    const term = normalize(inputValue.trim());
    return sortedClients.filter(
      (client) =>
        normalize(client.name).includes(term) ||
        (client.email && normalize(client.email).includes(term)),
    );
  }, [clients, inputValue]);

  const exactMatch = clients.find(
    (c) => normalizeSortText(c.name) === normalizeSortText(inputValue),
  );

  const showCreateOption = inputValue.trim() && !exactMatch;

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder="Digite ou selecione um cliente..."
        disabled={disabled}
        icon={<User className="w-4 h-4" />}
        suffix={
          <div className="flex items-center gap-1">
            {inputValue && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setOpen(!open)}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  open && "rotate-180",
                )}
              />
            </Button>
            {clientId && (
              <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                cadastrado
              </span>
            )}
          </div>
        }
        className={cn(error && "border-destructive")}
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[300px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader size="md" />
            </div>
          ) : (
            <>
              {/* Create new option */}
              {showCreateOption && (
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted border-b"
                  onClick={() => {
                    onChange({
                      clientId: undefined,
                      clientName: inputValue.trim(),
                      clientEmail: undefined,
                      clientPhone: undefined,
                      clientAddress: undefined,
                      isNew: true,
                    });
                    setOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    Criar novo cliente: <strong>{inputValue.trim()}</strong>
                  </span>
                </div>
              )}

              {/* Existing clients */}
              {filteredClients.length > 0 ? (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    Clientes cadastrados
                  </div>
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted",
                        clientId === client.id && "bg-muted",
                      )}
                      onClick={() => handleSelectClient(client)}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          clientId === client.id
                            ? "text-primary"
                            : "text-transparent",
                        )}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {client.name}
                        </span>
                        {(client.email || client.phone) && (
                          <span className="text-xs text-muted-foreground truncate">
                            {[client.email, client.phone]
                              .filter(Boolean)
                              .join(" • ")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !showCreateOption ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {inputValue.trim()
                    ? "Nenhum cliente encontrado."
                    : "Nenhum cliente cadastrado ainda."}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
