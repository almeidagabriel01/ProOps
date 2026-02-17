"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Plus, Trash2, Settings2, Loader2 } from "lucide-react";
import {
  ReconciliationRule,
  ReconciliationRuleService,
} from "@/services/reconciliation-rule-service";
import { toast } from "react-toastify";

export function ReconciliationRulesDialog() {
  const [open, setOpen] = React.useState(false);
  const [rules, setRules] = React.useState<ReconciliationRule[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  // New rule state
  const [keyword, setKeyword] = React.useState("");
  const [targetCategory, setTargetCategory] = React.useState("");
  const [targetType, setTargetType] = React.useState<"income" | "expense">(
    "expense",
  );

  const fetchRules = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await ReconciliationRuleService.getRules();
      setRules(data);
    } catch (error) {
      console.error("Failed to fetch rules", error);
      toast.error("Erro ao carregar regras");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchRules();
    }
  }, [open, fetchRules]);

  const handleAddRule = async () => {
    if (!keyword.trim() || !targetCategory.trim()) {
      toast.warning("Preencha a palavra-chave e a categoria");
      return;
    }

    try {
      setAdding(true);
      await ReconciliationRuleService.createRule({
        keyword: keyword.trim(),
        targetCategory: targetCategory.trim(),
        targetType,
        isActive: true,
      });

      toast.success("Regra criada com sucesso!");
      setKeyword("");
      setTargetCategory("");
      // Refresh list
      await fetchRules();
    } catch (error) {
      console.error("Failed to create rule", error);
      toast.error("Erro ao criar regra");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      // Optimistic update
      setRules((prev) => prev.filter((r) => r.id !== id));
      await ReconciliationRuleService.deleteRule(id);
      toast.success("Regra removida");
    } catch (error) {
      console.error("Failed to delete rule", error);
      toast.error("Erro ao remover regra");
      // Rollback
      fetchRules();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Regras de Conciliação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Regras de Conciliação (De/Para)</DialogTitle>
          <DialogDescription>
            Defina regras para categorizar automaticamente as transações
            importadas do banco.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
          {/* Add New Rule Form */}
          <div className="p-4 bg-muted/50 rounded-lg flex flex-col md:flex-row gap-3 items-end border">
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-medium">
                Se a descrição conter:
              </label>
              <Input
                placeholder="Ex: Uber, Padaria, Posto"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="md:w-32 space-y-2 w-full">
              <label className="text-xs font-medium">Tipo:</label>
              <Select
                value={targetType}
                onChange={(e) =>
                  setTargetType(e.target.value as "income" | "expense")
                }
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </Select>
            </div>
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-medium">Categorizar como:</label>
              <Input
                placeholder="Ex: Transporte, Alimentação"
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddRule}
              disabled={adding}
              className="w-full md:w-auto"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Rules List */}
          <div className="flex-1 overflow-y-auto min-h-[200px] border rounded-md">
            {loading && rules.length === 0 ? (
              <div className="flex items-center justify-center h-full p-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando regras...
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground text-center">
                <Settings2 className="w-10 h-10 mb-3 opacity-20" />
                <p>Nenhuma regra definida.</p>
                <p className="text-sm">
                  Crie regras acima para automatizar sua conciliação.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex justify-between items-center p-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium bg-secondary px-2 py-0.5 rounded border">
                          Contains: "{rule.keyword}"
                        </span>
                      </div>
                      <span className="hidden md:inline text-muted-foreground">
                        →
                      </span>
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={`w-2 h-2 rounded-full ${rule.targetType === "income" ? "bg-green-500" : "bg-red-500"}`}
                        />
                        <span>{rule.targetCategory}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-muted-foreground hover:text-destructive h-8 w-8 ml-2 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
