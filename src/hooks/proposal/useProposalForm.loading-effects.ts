import * as React from "react";
import {
  Proposal,
  ProposalAmbienteInstance,
  ProposalProduct,
  ProposalService,
} from "@/services/proposal-service";
import { Product, ProductService } from "@/services/product-service";
import { Service, ServiceService } from "@/services/service-service";
import { ProposalTemplate, ProposalStatus } from "@/types";
import { ProposalTemplateService } from "@/services/proposal-template-service";
import { AmbienteService, Ambiente } from "@/services/ambiente-service";
import { SistemaService } from "@/services/sistema-service";
import { Sistema, ProposalSistema } from "@/types/automation";
import { mergePdfDisplaySettings } from "@/types/pdf-display-settings";
import { toast } from "@/lib/toast";
import { buildFullFormSnapshot } from "./useProposalForm.helpers";

interface UseProposalFormLoadingEffectsContext {
  tenant: { id: string; proposalDefaults?: Record<string, unknown> } | null;
  proposalId?: string;
  products: Array<Product | Service>;
  proposalFetchedRef: React.MutableRefObject<boolean>;
  setLocalAmbientes: (ambientes: Ambiente[]) => void;
  setLocalSistemas: (sistemas: Sistema[]) => void;
  setProducts: React.Dispatch<React.SetStateAction<Array<Product | Service>>>;
  setTemplate: React.Dispatch<React.SetStateAction<ProposalTemplate | null>>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  setSelectedClientId: React.Dispatch<React.SetStateAction<string | undefined>>;
  setIsNewClient: React.Dispatch<React.SetStateAction<boolean>>;
  initialClientIdRef: React.MutableRefObject<string | undefined>;
  initialIsNewClientRef: React.MutableRefObject<boolean>;
  setSelectedSistemas: React.Dispatch<React.SetStateAction<ProposalSistema[]>>;
  setSystemProductIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  initialSistemasRef: React.MutableRefObject<string | null>;
  initialFormDataRef: React.MutableRefObject<string | null>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  // Transactional Data passed from parent to avoid refetching
  mergedAmbientes: Ambiente[];
  mergedSistemas: Sistema[];
}

export function useProposalFormLoadingEffects(
  ctx: UseProposalFormLoadingEffectsContext,
): void {
  const {
    tenant,
    proposalId,
    products,
    proposalFetchedRef,
    setLocalAmbientes,
    setLocalSistemas,
    setProducts,
    setTemplate,
    setFormData,
    setSelectedClientId,
    setIsNewClient,
    initialClientIdRef,
    initialIsNewClientRef,
    setSelectedSistemas,
    setSystemProductIds,
    initialSistemasRef,
    initialFormDataRef,
    setIsLoading,
    mergedAmbientes,
    mergedSistemas,
  } = ctx;

  const isFetchingRef = React.useRef(false);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Pure function to apply master data sync to a list of sistemas
  const applySyncToSistemas = React.useCallback(
    (
      sistemas: ProposalSistema[],
      freshAmbientes: Ambiente[],
      freshSistemas: Sistema[],
    ): ProposalSistema[] => {
      return sistemas.map((s) => {
        const currentAmbientes =
          s.ambientes && s.ambientes.length > 0
            ? s.ambientes
            : [
                {
                  ambienteId: s.ambienteId || "",
                  ambienteName: s.ambienteName || "",
                  description: s.description || "",
                  products: s.products || [],
                },
              ];

        const updatedAmbientes = currentAmbientes.map((env) => {
          const masterAmbiente =
            freshAmbientes.find((a) => a.id === env.ambienteId) ||
            freshAmbientes.find((a) => a.name === env.ambienteName);
          const masterSistema =
            freshSistemas.find((sys) => sys.id === s.sistemaId) ||
            freshSistemas.find((sys) => sys.name === s.sistemaName);
          const systemEnvConfig = masterSistema?.ambientes?.find(
            (a) => a.ambienteId === (masterAmbiente?.id || env.ambienteId),
          );

          return {
            ...env,
            ambienteName: masterAmbiente?.name || env.ambienteName,
            description:
              systemEnvConfig || masterAmbiente
                ? systemEnvConfig?.description ||
                  masterAmbiente?.description ||
                  ""
                : env.description || "",
          };
        });

        const masterSistema =
          freshSistemas.find((sys) => sys.id === s.sistemaId) ||
          freshSistemas.find((sys) => sys.name === s.sistemaName);
        const primaryEnv = updatedAmbientes[0];

        // Maintain the user's customized names if they exist; fallback to master data
        return {
          ...s,
          sistemaName: s.sistemaName || masterSistema?.name || "",
          description:
            s.description ||
            (masterSistema ? masterSistema.description || "" : ""),
          ambientes: updatedAmbientes,
          ambienteName: s.ambienteName || primaryEnv?.ambienteName || "",
          ambienteId: primaryEnv?.ambienteId || s.ambienteId || "",
        };
      });
    },
    [],
  );

  // Helper to sync selected systems with fresh master data
  const syncSystemsWithMasterData = React.useCallback(
    (freshAmbientes: Ambiente[], freshSistemas: Sistema[]) => {
      setSelectedSistemas((prevSistemas) => {
        const updated = applySyncToSistemas(
          prevSistemas,
          freshAmbientes,
          freshSistemas,
        );
        return updated;
      });

      // Also update the initial snapshot so dirty detection doesn't false-fire
      if (initialSistemasRef.current !== null) {
        try {
          const initialSistemas = JSON.parse(
            initialSistemasRef.current,
          ) as ProposalSistema[];
          const updatedInitial = applySyncToSistemas(
            initialSistemas,
            freshAmbientes,
            freshSistemas,
          );
          initialSistemasRef.current = JSON.stringify(updatedInitial);
        } catch {
          // ignore parse errors
        }
      }
    },
    [setSelectedSistemas, applySyncToSistemas, initialSistemasRef],
  );

  React.useEffect(() => {
    const loadInitData = async () => {
      if (!tenant?.id) return;
      try {
        // Parallel fetch for speed
        const [ambs, siss] = await Promise.all([
          AmbienteService.getAmbientes(tenant.id),
          SistemaService.getSistemas(tenant.id),
        ]);

        if (!isMountedRef.current) return;

        setLocalAmbientes(ambs);
        setLocalSistemas(siss);

        // Apply updates to any systems already loaded (e.g. from fast proposal fetch)
        syncSystemsWithMasterData(ambs, siss);
      } catch (e) {
        console.error("Error loading initial master data", e);
        // Do not block UI with error toast here, fail silently or log
      }
    };
    loadInitData();
  }, [tenant, setLocalAmbientes, setLocalSistemas, syncSystemsWithMasterData]);

  React.useEffect(() => {
    const fetchInitialData = async () => {
      if (!tenant) return;
      try {
        // Parallel fetch: products, services, and templates are independent reads
        const [loadedProducts, loadedServices, templates] = await Promise.all([
          ProductService.getProducts(tenant.id),
          ServiceService.getServices(tenant.id),
          ProposalTemplateService.getTemplates(tenant.id),
        ]);

        const mergedCatalog = [
          ...loadedProducts.map((item) => ({
            ...item,
            itemType: "product" as const,
          })),
          ...loadedServices.map((item) => ({
            ...item,
            itemType: "service" as const,
          })),
        ];
        setProducts(mergedCatalog);

        const defaultTemplate =
          templates.find((t) => t.isDefault) || templates[0];
        setTemplate(defaultTemplate || null);
      } catch (error) {
        console.error("Error loading products", error);
        toast.error("Erro ao carregar produtos e templates");
      }
    };
    fetchInitialData();
  }, [tenant, setProducts, setTemplate]);

  React.useEffect(() => {
    if (!proposalId && tenant?.proposalDefaults) {
      setFormData((prev) => ({
        ...prev,
        pdfSettings: mergePdfDisplaySettings({
          ...prev.pdfSettings,
          ...tenant.proposalDefaults,
        }),
      }));
    }
  }, [tenant, proposalId, setFormData]);

  const refreshMasterData = React.useCallback(async () => {
    if (!tenant?.id || isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      const [freshAmbientes, freshSistemas] = await Promise.all([
        AmbienteService.getAmbientes(tenant.id),
        SistemaService.getSistemas(tenant.id),
      ]);

      if (!isMountedRef.current) return;

      if (freshAmbientes.length === 0 && freshSistemas.length === 0) {
        return;
      }

      setLocalAmbientes(freshAmbientes);
      setLocalSistemas(freshSistemas);

      syncSystemsWithMasterData(freshAmbientes, freshSistemas);
    } catch (err) {
      console.error("Silent refresh failed", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [tenant, setLocalAmbientes, setLocalSistemas, syncSystemsWithMasterData]);

  React.useEffect(() => {
    const fetchProposal = async () => {
      if (proposalFetchedRef.current) return;
      if (!proposalId || products.length === 0) return;

      try {
        proposalFetchedRef.current = true;
        const proposal = await ProposalService.getProposalById(proposalId);
        if (!proposal) return;

        const syncedClientName = proposal.clientName || "";
        const syncedClientEmail = proposal.clientEmail || "";
        const syncedClientPhone = proposal.clientPhone || "";
        const syncedClientAddress = proposal.clientAddress || "";

        if (proposal.clientId) {
          setSelectedClientId(proposal.clientId);
          setIsNewClient(false);
          initialClientIdRef.current = proposal.clientId;
          initialIsNewClientRef.current = false;
        } else {
          initialClientIdRef.current = undefined;
          initialIsNewClientRef.current = true;
        }

        const syncedProducts = (proposal.products || []).map((pp) => {
          let targetType = pp.itemType || "product";
          const freshProduct = products.find((p) => p.id === pp.productId);

          if (!freshProduct) return pp;

          // If legacy data had the wrong type, update "targetType" to the real one
          targetType = freshProduct.itemType || "product";

          const isService = (freshProduct.itemType || targetType) === "service";

          // To allow custom prices on proposals, prioritize the proposal's saved unitPrice.
          // Only use the fresh master product price if the proposal unitPrice is undefined.
          const price =
            pp.unitPrice !== undefined
              ? pp.unitPrice
              : parseFloat(freshProduct.price) || 0;

          const resolvedProposalMarkup = (() => {
            if (isService) return 0;
            if (pp.markup !== undefined) return pp.markup;
            const qty = Number(pp.quantity || 0);
            const unit = Number(price || 0);
            const total = Number(pp.total || 0);
            if (qty > 0 && unit > 0) {
              const sellingPerUnit = total / qty;
              return Math.max(0, ((sellingPerUnit / unit) - 1) * 100);
            }
            return 0;
          })();

          const markup = isService
            ? 0
            : resolvedProposalMarkup;
          const sellingPrice = price * (1 + markup / 100);

          return {
            ...pp,
            itemType: (freshProduct.itemType || targetType) as
              | "product"
              | "service",
            productName: freshProduct.name,
            productImage:
              freshProduct.images?.[0] ||
              freshProduct.image ||
              pp.productImage ||
              "",
            productImages: freshProduct.images || pp.productImages || [],
            productDescription:
              freshProduct.description || pp.productDescription || "",
            unitPrice: price,
            markup,
            total: pp.quantity * sellingPrice,
            manufacturer:
              ((freshProduct as Record<string, unknown>).manufacturer as
                | string
                | undefined) || pp.manufacturer,
            category:
              ((freshProduct as Record<string, unknown>).category as
                | string
                | undefined) || pp.category,
          };
        });

        const loadedFormData: Partial<Proposal> = {
          title: proposal.title || "",
          clientName: syncedClientName,
          clientEmail: syncedClientEmail,
          clientPhone: syncedClientPhone,
          clientAddress: syncedClientAddress,
          validUntil: proposal.validUntil || "",
          customNotes: proposal.customNotes || "",
          discount: proposal.discount || 0,
          extraExpense: proposal.extraExpense || 0,
          products: syncedProducts,
          status: (proposal.status as ProposalStatus) || "in_progress",
          downPaymentEnabled: proposal.downPaymentEnabled || false,
          downPaymentType: proposal.downPaymentType || "value",
          downPaymentPercentage: proposal.downPaymentPercentage,
          downPaymentValue: proposal.downPaymentValue || 0,
          downPaymentWallet: proposal.downPaymentWallet || "",
          downPaymentDueDate: proposal.downPaymentDueDate || "",
          installmentsEnabled: proposal.installmentsEnabled || false,
          installmentsCount: proposal.installmentsCount || 1,
          installmentValue: proposal.installmentValue || 0,
          installmentsWallet: proposal.installmentsWallet || "",
          firstInstallmentDate: proposal.firstInstallmentDate || "",
          pdfSettings: mergePdfDisplaySettings(proposal.pdfSettings),
        };

        setFormData(loadedFormData);

        if (proposal.sistemas && proposal.sistemas.length > 0) {
          // Use available merged data immediately if present (Optimistic Load)
          const availableAmbientes =
            mergedAmbientes.length > 0 ? mergedAmbientes : [];
          const availableSistemas =
            mergedSistemas.length > 0 ? mergedSistemas : [];

          const sistemas: ProposalSistema[] = proposal.sistemas.map((s) => {
            const primaryAmbienteId =
              s.ambientes?.[0]?.ambienteId || s.ambienteId;
            const primaryAmbienteName =
              s.ambientes?.[0]?.ambienteName || s.ambienteName;

            const masterAmbiente =
              availableAmbientes.find((a) => a.id === primaryAmbienteId) ||
              availableAmbientes.find((a) => a.name === primaryAmbienteName);

            const masterSistema =
              availableSistemas.find((sys) => sys.id === s.sistemaId) ||
              availableSistemas.find((sys) => sys.name === s.sistemaName);

            const productIds =
              s.ambientes?.[0]?.productIds || s.productIds || [];
            const systemEnvConfig = masterSistema?.ambientes?.find(
              (a) => a.ambienteId === (masterAmbiente?.id || primaryAmbienteId),
            );

            const sistemaProducts = syncedProducts
              .filter((p: ProposalProduct) => productIds.includes(p.productId))
              .map((p: ProposalProduct) => ({
                productId: p.productId,
                productName: p.productName,
                quantity: p.quantity,
              }));

            return {
              sistemaId: masterSistema?.id || (s.sistemaId as string) || "",
              sistemaName:
                masterSistema?.name || (s.sistemaName as string) || "",
              description: masterSistema
                ? masterSistema.description || ""
                : (s.description as string) || "",
              ambientes:
                s.ambientes && s.ambientes.length > 0
                  ? s.ambientes.map((env: ProposalAmbienteInstance) => {
                      const envMasterAmbiente =
                        availableAmbientes.find(
                          (a) => a.id === env.ambienteId,
                        ) ||
                        availableAmbientes.find(
                          (a) => a.name === env.ambienteName,
                        );

                      const envProductIds: string[] = env.productIds || [];
                      const envProducts = syncedProducts
                        .filter((p: ProposalProduct) =>
                          envProductIds.includes(p.productId),
                        )
                        .map((p: ProposalProduct) => ({
                          productId: p.productId,
                          productName: p.productName,
                          quantity: p.quantity,
                          status: p.status,
                        }));

                      return {
                        ambienteId:
                          envMasterAmbiente?.id ||
                          env.ambienteId ||
                          (env.ambienteId ===
                          (masterAmbiente?.id || primaryAmbienteId)
                            ? masterAmbiente?.id || primaryAmbienteId
                            : "") ||
                          "",
                        ambienteName:
                          envMasterAmbiente?.name ||
                          env.ambienteName ||
                          (env.ambienteName ===
                          (masterAmbiente?.name || primaryAmbienteName)
                            ? masterAmbiente?.name || primaryAmbienteName
                            : "") ||
                          "",
                        description: envMasterAmbiente
                          ? envMasterAmbiente.description || ""
                          : env.description || "",
                        products: envProducts,
                      };
                    })
                  : [
                      {
                        ambienteId:
                          masterAmbiente?.id || primaryAmbienteId || "",
                        ambienteName:
                          masterAmbiente?.name || primaryAmbienteName || "",
                        description:
                          systemEnvConfig || masterAmbiente
                            ? systemEnvConfig?.description ||
                              masterAmbiente?.description ||
                              ""
                            : s.ambientes?.[0]?.description || "",
                        products: sistemaProducts,
                      },
                    ],
              ambienteId: masterAmbiente?.id || primaryAmbienteId || "",
              ambienteName: masterAmbiente?.name || primaryAmbienteName || "",
              products: sistemaProducts,
            };
          });

          setSelectedSistemas(sistemas);
          const sysProductIds = new Set(
            proposal.sistemas.flatMap(
              (s) => (s.productIds as string[] | undefined) || [],
            ),
          );
          setSystemProductIds(sysProductIds);
          initialSistemasRef.current = JSON.stringify(sistemas);
        } else {
          // systems empty
        }

        initialFormDataRef.current = buildFullFormSnapshot(loadedFormData);
        if (!initialSistemasRef.current) {
          initialSistemasRef.current = JSON.stringify([]);
        }

        // Fire and forget: trigger refresh to update descriptions if they were stale
        // This ensures that if we loaded with stale or empty merged data, it gets updated shortly
        refreshMasterData();
      } catch (error) {
        console.error("Error loading proposal", error);
        toast.error("Erro ao carregar proposta");
      }

      setIsLoading(false);
    };

    fetchProposal();
  }, [
    proposalId,
    products,
    tenant,
    proposalFetchedRef,
    setFormData,
    setIsLoading,
    setIsNewClient,
    setLocalAmbientes,
    setLocalSistemas,
    setSelectedClientId,
    setSelectedSistemas,
    setSystemProductIds,
    initialClientIdRef,
    initialFormDataRef,
    initialIsNewClientRef,
    initialSistemasRef,
    mergedAmbientes,
    mergedSistemas,
    refreshMasterData,
  ]);

  React.useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        refreshMasterData();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshMasterData]);
}
