import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormContainer, FormHeaderSkeleton } from "@/components/ui/form-components";

export function TeamSkeleton() {
  return (
    <FormContainer>
      <FormHeaderSkeleton />

      <div className="flex justify-end">
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>

      {/* Members List */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="flex items-center p-2 pr-4">
              {/* Main Content Area (matches the button click area) */}
              <div className="flex-1 p-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <Skeleton className="w-12 h-12" />

                  {/* Name and Email */}
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-center gap-1">
                      <Skeleton className="w-3 h-3" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side Actions */}
              <div className="flex items-center gap-3">
                {/* Role Badge */}
                <Skeleton className="h-6 w-20" />

                {/* Vertical Divider */}
                <div className="h-8 w-px bg-border mx-2" />

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>

                {/* Chevron */}
                <Skeleton className="h-5 w-5 ml-1" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </FormContainer>
  );
}
