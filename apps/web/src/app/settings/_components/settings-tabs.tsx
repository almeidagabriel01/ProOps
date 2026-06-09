"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SETTINGS_TABS = [
  { value: "team", label: "Equipe", href: "/settings/team" },
  {
    value: "security",
    label: "Verificação em dois fatores",
    href: "/settings/security",
  },
  { value: "payments", label: "Pagamento Online", href: "/settings/payments" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab =
    SETTINGS_TABS.find((tab) => pathname.startsWith(tab.href))?.value ?? "team";

  const handleTabChange = (value: string) => {
    const tab = SETTINGS_TABS.find((t) => t.value === value);
    if (tab) router.push(tab.href);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex justify-center pb-2">
          <TabsList className="flex-wrap h-auto">
            {SETTINGS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
    </div>
  );
}
