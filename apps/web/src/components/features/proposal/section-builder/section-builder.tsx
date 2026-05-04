"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProposalSection } from "@/types";
import { ProposalSectionType } from "@/types";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { sectionTypes, getDefaultTitle, getDefaultContent } from "./constants";
import { SectionEditor } from "./section-editor";

interface SectionBuilderProps {
  sections: ProposalSection[];
  onChange: (sections: ProposalSection[]) => void;
}

export function SectionBuilder({ sections, onChange }: SectionBuilderProps) {
  const addSection = (type: ProposalSectionType) => {
    const newSection: ProposalSection = {
      id: crypto.randomUUID(),
      type,
      title: getDefaultTitle(type),
      content: getDefaultContent(type),
      order: sections.length,
    };
    onChange([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<ProposalSection>) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteSection = (id: string) => {
    onChange(
      sections.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }))
    );
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sections.length - 1) return;

    const newSections = [...sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    [newSections[index], newSections[swapIndex]] = [
      newSections[swapIndex],
      newSections[index],
    ];

    onChange(newSections.map((s, i) => ({ ...s, order: i })));
  };

  return (
    <div className="space-y-4">
      {/* Add Section Buttons */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Adicionar Seção</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {sectionTypes.map(({ type, label, icon }) => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                onClick={() => addSection(type)}
                className="gap-2"
              >
                {icon}
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section List */}
      <div className="space-y-3">
        {sections.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plus className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">
                Adicione seções para construir sua proposta
              </p>
            </CardContent>
          </Card>
        )}

        {sections.map((section, index) => (
          <Card key={section.id} className="group">
            <CardHeader className="py-3 flex flex-row items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <Input
                  value={section.title}
                  onChange={(e) =>
                    updateSection(section.id, { title: e.target.value })
                  }
                  className="h-8 text-sm font-medium bg-transparent border-none px-0 focus-visible:ring-0"
                  placeholder="Título da seção"
                />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveSection(section.id, "up")}
                  disabled={index === 0}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveSection(section.id, "down")}
                  disabled={index === sections.length - 1}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteSection(section.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <SectionEditor
                section={section}
                onUpdate={(updates) => updateSection(section.id, updates)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
