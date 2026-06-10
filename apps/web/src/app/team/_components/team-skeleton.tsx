import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FormContainer,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";

export function TeamSkeleton() {
  return (
    <FormContainer>
      {/* Header + "Adicionar Membro" — same row as the loaded content */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 [&>div]:mb-0">
          <FormHeaderSkeleton />
        </div>
        <Skeleton className="h-10 w-full shrink-0 rounded-md sm:mt-1 sm:w-44" />
      </div>

      {/* Members section */}
      <div className="flex flex-col gap-4 flex-1">
        <div className="space-y-4">
          {/* Section title ("Membros (N)") with bottom border */}
          <div className="border-b pb-2">
            <Skeleton className="h-6 w-36" />
          </div>

          {/* Member cards — mirror MemberCard layout */}
          <div className="grid gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="flex items-center p-2 pr-4">
                  <div className="flex-1 p-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <Skeleton className="h-12 w-12 rounded-full" />
                      {/* Name + email */}
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <div className="flex items-center gap-1">
                          <Skeleton className="h-3 w-3 rounded-sm" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side: role badge + action buttons */}
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <div className="flex items-center gap-1 border-l pl-3 ml-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </FormContainer>
  );
}
