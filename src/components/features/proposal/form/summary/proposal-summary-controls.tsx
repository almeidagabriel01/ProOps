import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProposalStatus } from "@/types/proposal";
import { Percent, Tag } from "lucide-react";

interface ProposalSummaryControlsProps {
  discount: number;
  status: ProposalStatus;
  customNotes: string;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  statusOptions: { value: ProposalStatus; label: string }[];
}

export function ProposalSummaryControls({
  discount,
  status,
  customNotes,
  onFormChange,
  statusOptions,
}: ProposalSummaryControlsProps) {
  return (
    <>
      <div className="flex justify-between">
        {/* Discount */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="discount">Desconto:</Label>
          </div>
          <Input
            id="discount"
            name="discount"
            type="number"
            min={0}
            max={100}
            value={discount || 0}
            onChange={onFormChange}
            className="w-24"
          />
          <span className="text-muted-foreground">%</span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="status">Status:</Label>
          </div>
          <Select
            id="status"
            name="status"
            value={status || "draft"}
            onChange={onFormChange}
            className="w-40"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Custom Notes */}
      <div className="grid gap-2">
        <Label htmlFor="customNotes">Observações Adicionais</Label>
        <Textarea
          id="customNotes"
          name="customNotes"
          value={customNotes || ""}
          onChange={onFormChange}
          placeholder="Notas ou condições especiais para esta proposta..."
          rows={3}
        />
      </div>
    </>
  );
}
